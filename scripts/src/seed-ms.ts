/**
 * Seed verified Mississippi starter data for Bay St. Louis / Hancock County.
 * Run: pnpm --filter @workspace/scripts run seed-ms
 * Idempotent — skips rows that already exist by name.
 */
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------- helpers ----------
async function run(sql: string, params: unknown[] = []) {
  return pool.query(sql, params);
}

async function getOrCreateEntity(
  name: string,
  type: string,
  state: string,
  city: string,
  county: string,
  website: string,
): Promise<number> {
  const existing = await run(
    `SELECT id FROM entities WHERE name = $1 AND state = $2 LIMIT 1`,
    [name, state],
  );
  if (existing.rows.length > 0) {
    console.log(`  • Entity already exists: ${name}`);
    return existing.rows[0].id as number;
  }
  const inserted = await run(
    `INSERT INTO entities (name, type, state, city, county, website, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,true,now(),now()) RETURNING id`,
    [name, type, state, city, county, website],
  );
  console.log(`  + Created entity: ${name}`);
  return inserted.rows[0].id as number;
}

async function upsertSourceRegistry(row: {
  entityName: string;
  entityType: string;
  state: string;
  city: string;
  county: string;
  sourceCategory: string;
  sourcePlatform: string;
  sourceUrl: string;
  verificationStatus: string;
  notes: string;
}) {
  const existing = await run(
    `SELECT id FROM source_registry WHERE source_url = $1 LIMIT 1`,
    [row.sourceUrl],
  );
  if (existing.rows.length > 0) {
    console.log(`  • Source already exists: ${row.sourceUrl}`);
    return;
  }
  await run(
    `INSERT INTO source_registry
       (entity_name, entity_type, state, city, county, source_category, source_platform, source_url, verification_status, notes, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,now(),now())`,
    [
      row.entityName,
      row.entityType,
      row.state,
      row.city,
      row.county,
      row.sourceCategory,
      row.sourcePlatform,
      row.sourceUrl,
      row.verificationStatus,
      row.notes,
    ],
  );
  console.log(`  + Created source: ${row.sourceUrl}`);
}

async function upsertAlertDoc(entityId: number, row: {
  title: string;
  docType: string;
  year: number;
  plainSummary: string;
  alertCategory: string;
  sourceUrl: string;
  sourceStatus: string;
}) {
  const existing = await run(
    `SELECT id FROM documents WHERE title = $1 AND entity_id = $2 LIMIT 1`,
    [row.title, entityId],
  );
  if (existing.rows.length > 0) {
    console.log(`  • Alert already exists: ${row.title}`);
    return;
  }
  await run(
    `INSERT INTO documents
       (entity_id, title, doc_type, year, plain_summary, alert_category, source_url,
        source_status, red_flag_level, is_ai_generated, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'green',false,now(),now())`,
    [
      entityId,
      row.title,
      row.docType,
      row.year,
      row.plainSummary,
      row.alertCategory,
      row.sourceUrl,
      row.sourceStatus,
    ],
  );
  console.log(`  + Created alert: ${row.title}`);
}

// ---------- main ----------
async function main() {
  console.log("\n=== Seeding Mississippi: Bay St. Louis / Hancock County ===\n");

  console.log("--- Entities ---");
  const cityBSL = await getOrCreateEntity(
    "City of Bay St. Louis",
    "city-government",
    "MS",
    "Bay St. Louis",
    "Hancock County",
    "https://www.baystlouis-ms.gov",
  );
  const hancockCounty = await getOrCreateEntity(
    "Hancock County",
    "county-government",
    "MS",
    "Bay St. Louis",
    "Hancock County",
    "https://www.hancockcounty.ms.gov",
  );
  const hancockBoard = await getOrCreateEntity(
    "Hancock County Board of Supervisors",
    "county-government",
    "MS",
    "Bay St. Louis",
    "Hancock County",
    "https://hancockcoms.portal.civicclerk.com/",
  );
  const hancockElection = await getOrCreateEntity(
    "Hancock County Election Office",
    "election-office",
    "MS",
    "Bay St. Louis",
    "Hancock County",
    "https://www.hancockcounty.ms.gov/215/Elections-Voting",
  );
  await getOrCreateEntity(
    "Hancock County School District",
    "school-board",
    "MS",
    "Bay St. Louis",
    "Hancock County",
    "https://www.osa.ms.gov/taxonomy/term/150",
  );
  await getOrCreateEntity(
    "Bay St. Louis-Waveland School District",
    "school-board",
    "MS",
    "Bay St. Louis",
    "Hancock County",
    "https://www.osa.ms.gov/node/18916",
  );

  console.log("\n--- Source Registry ---");
  const sources = [
    {
      entityName: "City of Bay St. Louis",
      entityType: "city-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "agenda-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.baystlouis-ms.gov/city-council",
      verificationStatus: "verified",
      notes: "City council agendas and minutes — partial coverage",
    },
    {
      entityName: "City of Bay St. Louis",
      entityType: "city-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "minutes-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.baystlouis-ms.gov/meetings",
      verificationStatus: "verified",
      notes: "Meeting listings — partial coverage",
    },
    {
      entityName: "City of Bay St. Louis",
      entityType: "city-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "minutes-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.baystlouis-ms.gov/meetings/recent",
      verificationStatus: "verified",
      notes: "Recent meetings — partial coverage",
    },
    {
      entityName: "City of Bay St. Louis",
      entityType: "city-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "budget-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.baystlouis-ms.gov/mayor/page/budget-and-audited-financial-statements",
      verificationStatus: "verified",
      notes: "Budget and audited financial statements",
    },
    {
      entityName: "City of Bay St. Louis",
      entityType: "city-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "election-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.baystlouis-ms.gov/city-clerk/page/election-voting",
      verificationStatus: "verified",
      notes: "Election and voting information",
    },
    {
      entityName: "Hancock County",
      entityType: "county-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "agenda-page",
      sourcePlatform: "CivicPlus",
      sourceUrl: "https://www.hancockcounty.ms.gov/agendacenter",
      verificationStatus: "verified",
      notes: "Hancock County Agenda Center — CivicPlus platform",
    },
    {
      entityName: "Hancock County Board of Supervisors",
      entityType: "county-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "minutes-page",
      sourcePlatform: "CivicPlus",
      sourceUrl: "https://hancockcoms.portal.civicclerk.com/",
      verificationStatus: "verified",
      notes: "CivicClerk meeting portal",
    },
    {
      entityName: "Hancock County Election Office",
      entityType: "election-office",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "election-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.hancockcounty.ms.gov/215/Elections-Voting",
      verificationStatus: "verified",
      notes: "Elections and voting information",
    },
    {
      entityName: "Hancock County",
      entityType: "county-government",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "public-notice-page",
      sourcePlatform: "Custom Website",
      sourceUrl: "https://www.hancockcounty.ms.gov/AlertCenter.aspx?CID=Important-Public-Notice-11",
      verificationStatus: "verified",
      notes: "Public notices",
    },
    {
      entityName: "Hancock County School District",
      entityType: "school-board",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "audit-page",
      sourcePlatform: "Other",
      sourceUrl: "https://www.osa.ms.gov/taxonomy/term/150",
      verificationStatus: "verified",
      notes: "Mississippi Office of the State Auditor — Hancock County School District",
    },
    {
      entityName: "Bay St. Louis-Waveland School District",
      entityType: "school-board",
      state: "MS", city: "Bay St. Louis", county: "Hancock County",
      sourceCategory: "audit-page",
      sourcePlatform: "Other",
      sourceUrl: "https://www.osa.ms.gov/node/18916",
      verificationStatus: "verified",
      notes: "Mississippi Office of the State Auditor — Bay St. Louis-Waveland School District",
    },
  ];

  for (const s of sources) {
    await upsertSourceRegistry(s);
  }

  console.log("\n--- Alert Documents ---");

  await upsertAlertDoc(cityBSL, {
    title: "Bay St. Louis City Council Meetings Available",
    docType: "minutes",
    year: 2026,
    plainSummary:
      "Bay St. Louis posts city council meeting agendas and meeting information online. Residents can access current and past meeting details through the city website.",
    alertCategory: "Meeting",
    sourceUrl: "https://www.baystlouis-ms.gov/meetings",
    sourceStatus: "valid",
  });

  await upsertAlertDoc(cityBSL, {
    title: "Bay St. Louis Budget and Audits Available",
    docType: "budget",
    year: 2026,
    plainSummary:
      "Bay St. Louis provides budget and audited financial statement documents online, including prior fiscal years. These records detail how public funds are collected and spent.",
    alertCategory: "Budget",
    sourceUrl: "https://www.baystlouis-ms.gov/mayor/page/budget-and-audited-financial-statements",
    sourceStatus: "valid",
  });

  await upsertAlertDoc(hancockCounty, {
    title: "Hancock County Agendas and Minutes Available",
    docType: "agenda",
    year: 2026,
    plainSummary:
      "Hancock County provides current agendas and minutes for boards and commissions online through the CivicPlus Agenda Center. Residents can review upcoming and past meeting materials.",
    alertCategory: "Agenda",
    sourceUrl: "https://www.hancockcounty.ms.gov/agendacenter",
    sourceStatus: "valid",
  });

  await upsertAlertDoc(hancockElection, {
    title: "Hancock County Election Information Available",
    docType: "election",
    year: 2026,
    plainSummary:
      "Hancock County provides election and voting information through the county website. Residents can find registration details, polling locations, and election results.",
    alertCategory: "Election",
    sourceUrl: "https://www.hancockcounty.ms.gov/215/Elections-Voting",
    sourceStatus: "valid",
  });

  await upsertAlertDoc(cityBSL, {
    title: "Bay St. Louis Election Information Available",
    docType: "election",
    year: 2026,
    plainSummary:
      "Bay St. Louis provides local election and voting information, including voting precinct details and city clerk resources, through the official city website.",
    alertCategory: "Election",
    sourceUrl: "https://www.baystlouis-ms.gov/city-clerk/page/election-voting",
    sourceStatus: "valid",
  });

  console.log("\n=== Done ===\n");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
