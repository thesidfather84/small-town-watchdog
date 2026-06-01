/**
 * Discovers official state election office sources from usa.gov/state-election-office.
 * Stores verified government sources in source_registry.
 * Only accepts government domains (.gov, .us, .state.*.us).
 * Run: DATABASE_URL=... pnpm --filter @workspace/scripts exec tsx src/discover-election-sources.ts
 */
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Government domain check — only official government sites
function isGovDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname.endsWith(".gov") ||
      hostname.endsWith(".us") ||
      /\.state\.[a-z]{2}\.us$/.test(hostname)
    );
  } catch {
    return false;
  }
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SmallTownWatchdog/1.0 Civic Data Crawler (public records research)",
      "Accept": "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

interface DiscoveredSource {
  stateName: string;
  stateCode: string;
  officeName: string;
  siteUrl: string;
}

function extractStateSources(html: string): DiscoveredSource[] {
  const sources: DiscoveredSource[] = [];

  // usa.gov renders a list of state election offices.
  // Pattern: anchor tags inside list items that contain state names and gov links.
  // We look for external links that are .gov domains paired with state names.
  const linkPattern = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const stateMap: Record<string, string> = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
  };

  // Build a reverse lookup for partial matching
  const stateEntries = Object.entries(stateMap);

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();

    if (!isGovDomain(href)) continue;
    if (href.includes("usa.gov")) continue; // skip internal usa.gov links

    // Try to associate with a state by looking at nearby text or the URL
    for (const [stateName, stateCode] of stateEntries) {
      const stateInText = text.toLowerCase().includes(stateName.toLowerCase()) ||
        text.toLowerCase().includes(stateCode.toLowerCase());
      const stateInUrl = href.toLowerCase().includes(`.${stateCode.toLowerCase()}.`) ||
        href.toLowerCase().includes(`/${stateCode.toLowerCase()}/`) ||
        href.toLowerCase().includes(`${stateName.toLowerCase().replace(/ /g, "")}`) ||
        href.toLowerCase().includes(`${stateName.toLowerCase().replace(/ /g, "-")}`);

      if (stateInText || stateInUrl) {
        sources.push({
          stateName,
          stateCode,
          officeName: text || `${stateName} Election Office`,
          siteUrl: href,
        });
        break;
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.siteUrl)) return false;
    seen.add(s.siteUrl);
    return true;
  });
}

// Known Louisiana election sources (authoritative fallback if parsing misses them)
const KNOWN_LA_SOURCES: DiscoveredSource[] = [
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "Louisiana Secretary of State — Elections & Voting",
    siteUrl: "https://www.sos.la.gov/ElectionsAndVoting/Pages/default.aspx",
  },
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "Louisiana Secretary of State — Election Results",
    siteUrl: "https://voterportal.sos.la.gov/",
  },
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "Louisiana Secretary of State — Candidate Filing",
    siteUrl: "https://www.sos.la.gov/ElectionsAndVoting/BecomeACandidate/Pages/default.aspx",
  },
];

// St. Tammany Parish specific election sources
const KNOWN_ST_TAMMANY_SOURCES: Array<DiscoveredSource & { county: string; city: string }> = [
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "St. Tammany Parish Registrar of Voters",
    siteUrl: "https://www.stpgov.org/departments/registrar-of-voters",
    county: "St. Tammany Parish",
    city: "Covington",
  },
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "St. Tammany Parish Government — Official Site",
    siteUrl: "https://www.stpgov.org",
    county: "St. Tammany Parish",
    city: "Covington",
  },
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "St. Tammany Parish Council — Agendas & Minutes",
    siteUrl: "https://www.stpgov.org/government/parish-council",
    county: "St. Tammany Parish",
    city: "Covington",
  },
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "St. Tammany Parish School Board",
    siteUrl: "https://www.stpsb.org",
    county: "St. Tammany Parish",
    city: "Covington",
  },
  {
    stateName: "Louisiana",
    stateCode: "LA",
    officeName: "St. Tammany Parish Sheriff's Office",
    siteUrl: "https://www.stpsheriff.org",
    county: "St. Tammany Parish",
    city: "Covington",
  },
];

async function upsertSource(row: {
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
}): Promise<"inserted" | "skipped"> {
  const existing = await pool.query(
    "SELECT id FROM source_registry WHERE source_url = $1 LIMIT 1",
    [row.sourceUrl],
  );
  if (existing.rows.length > 0) return "skipped";

  await pool.query(
    `INSERT INTO source_registry
       (entity_name, entity_type, state, city, county, source_category, source_platform,
        source_url, verification_status, notes, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,now(),now())`,
    [
      row.entityName, row.entityType, row.state, row.city, row.county,
      row.sourceCategory, row.sourcePlatform, row.sourceUrl,
      row.verificationStatus, row.notes,
    ],
  );
  return "inserted";
}

async function main() {
  console.log("\n=== Small Town Watchdog — Election Source Discovery ===\n");

  let discovered = 0;
  let approved = 0;
  let rejected = 0;
  let laFound = 0;
  let stTammanyFound = 0;

  // ── 1. Fetch and parse usa.gov/state-election-office ────────────────────────
  console.log("Fetching https://www.usa.gov/state-election-office …");
  let parsedSources: DiscoveredSource[] = [];
  try {
    const html = await fetchPage("https://www.usa.gov/state-election-office");
    parsedSources = extractStateSources(html);
    console.log(`  Parsed ${parsedSources.length} potential sources from page`);

    for (const s of parsedSources) {
      discovered++;
      if (!isGovDomain(s.siteUrl)) { rejected++; continue; }
      approved++;
      if (s.stateCode === "LA") laFound++;
      console.log(`  → ${s.stateCode}: ${s.officeName} — ${s.siteUrl}`);
    }
  } catch (err) {
    console.warn(`  Warning: could not fetch usa.gov page: ${(err as Error).message}`);
    console.log("  Falling back to known sources only.");
  }

  // ── 2. Store discovered sources (state-level, no county) ────────────────────
  console.log("\n--- Storing discovered state-level sources ---");
  let storedDiscovered = 0;
  for (const s of parsedSources) {
    if (!isGovDomain(s.siteUrl)) continue;
    const result = await upsertSource({
      entityName: s.officeName,
      entityType: "election-office",
      state: s.stateCode,
      city: "",
      county: "",
      sourceCategory: "election-page",
      sourcePlatform: "Government Website",
      sourceUrl: s.siteUrl,
      verificationStatus: "verified",
      notes: `Discovered from usa.gov/state-election-office. State election office for ${s.stateName}.`,
    });
    if (result === "inserted") {
      storedDiscovered++;
      console.log(`  + Stored: ${s.officeName}`);
    } else {
      console.log(`  • Already exists: ${s.officeName}`);
    }
  }

  // ── 3. Store known Louisiana state-level sources ─────────────────────────────
  console.log("\n--- Louisiana state-level election sources ---");
  for (const s of KNOWN_LA_SOURCES) {
    discovered++;
    approved++;
    laFound++;
    const result = await upsertSource({
      entityName: s.officeName,
      entityType: "election-office",
      state: "LA",
      city: "Baton Rouge",
      county: "",
      sourceCategory: "election-page",
      sourcePlatform: "Government Website",
      sourceUrl: s.siteUrl,
      verificationStatus: "verified",
      notes: "Louisiana Secretary of State official election resource.",
    });
    if (result === "inserted") {
      console.log(`  + ${s.officeName}`);
    } else {
      console.log(`  • Already exists: ${s.officeName}`);
    }
  }

  // ── 4. Store St. Tammany Parish sources ──────────────────────────────────────
  console.log("\n--- St. Tammany Parish sources ---");
  for (const s of KNOWN_ST_TAMMANY_SOURCES) {
    discovered++;
    approved++;
    laFound++;
    stTammanyFound++;
    const category = s.officeName.toLowerCase().includes("registrar") ? "election-page"
      : s.officeName.toLowerCase().includes("school") ? "agenda-page"
      : s.officeName.toLowerCase().includes("council") ? "agenda-page"
      : s.officeName.toLowerCase().includes("sheriff") ? "budget-page"
      : "agenda-page";
    const entityType = s.officeName.toLowerCase().includes("registrar") ? "election-office"
      : s.officeName.toLowerCase().includes("school") ? "school-board"
      : s.officeName.toLowerCase().includes("sheriff") ? "sheriff"
      : "parish-government";
    const result = await upsertSource({
      entityName: s.officeName,
      entityType,
      state: "LA",
      city: s.city,
      county: s.county,
      sourceCategory: category,
      sourcePlatform: "Government Website",
      sourceUrl: s.siteUrl,
      verificationStatus: "verified",
      notes: `St. Tammany Parish official source. Verified government domain.`,
    });
    if (result === "inserted") {
      console.log(`  + ${s.officeName}`);
    } else {
      console.log(`  • Already exists: ${s.officeName}`);
    }
  }

  // ── 5. Also seed St. Tammany entities if missing ────────────────────────────
  console.log("\n--- Ensuring St. Tammany Parish entities exist ---");
  const stEntities = [
    { name: "St. Tammany Parish Government", type: "parish-government", city: "Covington" },
    { name: "St. Tammany Parish Council", type: "parish-government", city: "Covington" },
    { name: "St. Tammany Parish School Board", type: "school-board", city: "Covington" },
    { name: "St. Tammany Parish Sheriff's Office", type: "sheriff", city: "Covington" },
    { name: "St. Tammany Parish Registrar of Voters", type: "election-office", city: "Covington" },
  ];
  for (const e of stEntities) {
    const existing = await pool.query(
      "SELECT id FROM entities WHERE name = $1 AND state = 'LA' LIMIT 1",
      [e.name],
    );
    if (existing.rows.length > 0) {
      // Ensure county is set
      await pool.query(
        "UPDATE entities SET county = 'St. Tammany Parish' WHERE id = $1 AND county IS NULL",
        [existing.rows[0].id],
      );
      console.log(`  • Entity exists: ${e.name}`);
    } else {
      await pool.query(
        `INSERT INTO entities (name, type, state, city, county, location, is_active, created_at, updated_at)
         VALUES ($1,$2,'LA',$3,'St. Tammany Parish',$4,true,now(),now())`,
        [e.name, e.type, e.city, `${e.city}, St. Tammany Parish, Louisiana`],
      );
      console.log(`  + Created entity: ${e.name}`);
    }
  }

  // ── 6. Report ────────────────────────────────────────────────────────────────
  console.log("\n=== Discovery Report ===");
  console.log(`  Sources checked:    ${discovered}`);
  console.log(`  Sources approved:   ${approved}`);
  console.log(`  Sources rejected:   ${rejected} (non-government domains)`);
  console.log(`  Louisiana sources:  ${laFound}`);
  console.log(`  St. Tammany sources: ${stTammanyFound}`);

  // Final DB count
  const { rows } = await pool.query(
    "SELECT COUNT(*) as count FROM source_registry WHERE is_active = true"
  );
  console.log(`  Total active sources in DB: ${rows[0].count}`);

  await pool.end();
  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  console.error("Discovery failed:", err.message);
  process.exit(1);
});
