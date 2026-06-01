/**
 * Generate Location Checklist
 *
 * For a given state + county/parish, this script:
 *   1. Prints the full expected entity checklist from the taxonomy
 *   2. Queries the DB to see which entities already have sources
 *   3. Reports coverage gaps (what's missing)
 *   4. Optionally seeds placeholder "pending" rows in source_registry for missing entities
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @workspace/scripts exec tsx src/generate-location-checklist.ts \
 *     --state LA --county "St. Tammany Parish" [--seed]
 *
 * Options:
 *   --state     State code (e.g. LA, MS)
 *   --county    County or parish name (e.g. "St. Tammany Parish")
 *   --seed      If present, inserts pending placeholder rows for missing priority-1 and priority-2 entities
 *   --all       If present with --seed, also seeds priority-3 entities
 */

import pg from "pg";
import {
  getLocationChecklist,
  ALL_ENTITY_TYPE_KEYS,
  EntityTypeSpec,
} from "../../lib/db/src/entity-taxonomy.js";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag: string): string | null {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}
const FLAG_SEED = args.includes("--seed");
const FLAG_ALL  = args.includes("--all");

const STATE  = (getArg("--state")  ?? "LA").toUpperCase();
const COUNTY = getArg("--county")  ?? "St. Tammany Parish";
const COUNTY_TYPE = COUNTY.toLowerCase().includes("parish") ? "parish" : "county";

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n════════════════════════════════════════════════════`);
  console.log(` Small Town Watchdog — Location Coverage Checklist`);
  console.log(`════════════════════════════════════════════════════`);
  console.log(` State:  ${STATE}`);
  console.log(` Area:   ${COUNTY} (${COUNTY_TYPE})`);
  console.log(`════════════════════════════════════════════════════\n`);

  const checklist = getLocationChecklist(STATE, COUNTY, COUNTY_TYPE as "parish" | "county");

  console.log(`Expected entities: ${checklist.totalExpected}`);
  console.log(`  Priority 1 (essential):  ${checklist.priorityOneCount}`);
  console.log(`  Priority 2 (important):  ${checklist.priorityTwoCount}`);
  console.log(`  Priority 3 (nice-to-have): ${checklist.priorityThreeCount}\n`);

  // ── Query existing sources ────────────────────────────────────────────────

  const existing = await pool.query<{ entity_type: string; count: string; verified_count: string }>(
    `SELECT entity_type,
            COUNT(*) as count,
            SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verified_count
     FROM source_registry
     WHERE state = $1
       AND (county = $2 OR county IS NULL OR county = '')
     GROUP BY entity_type`,
    [STATE, COUNTY]
  );

  const coveredTypes = new Map<string, { total: number; verified: number }>(
    existing.rows.map((r) => [r.entity_type, {
      total:    Number(r.count),
      verified: Number(r.verified_count),
    }])
  );

  // ── Coverage report by level ───────────────────────────────────────────────

  const levels = ["state", "county", "city", "school", "special-district", "court"] as const;
  const levelLabels: Record<string, string> = {
    "state":            "STATE LEVEL",
    "county":           "COUNTY / PARISH LEVEL",
    "city":             "CITY / MUNICIPAL LEVEL",
    "school":           "SCHOOL / EDUCATION",
    "special-district": "SPECIAL DISTRICTS",
    "court":            "COURTS / JUSTICE",
  };

  let totalCovered   = 0;
  let totalMissing   = 0;
  const missingP1: EntityTypeSpec[] = [];
  const missingP2: EntityTypeSpec[] = [];
  const seedRows: Array<{ entityType: string; displayName: string; priority: number }> = [];

  for (const level of levels) {
    const entities = checklist.expectedEntities.filter((e) => e.level === level);
    if (entities.length === 0) continue;

    console.log(`── ${levelLabels[level]} ──────────────────────────`);

    for (const entity of entities) {
      const coverage = coveredTypes.get(entity.key);
      const total    = coverage?.total    ?? 0;
      const verified = coverage?.verified ?? 0;

      let status: string;
      if (verified >= 2)  { status = "✅ Covered";  totalCovered++; }
      else if (verified === 1) { status = "🟡 Partial";  totalCovered++; }
      else if (total > 0) { status = "⏳ Pending";  }
      else                { status = "❌ Missing";  totalMissing++; }

      const priorityTag = entity.priority === 1 ? " [P1]" : entity.priority === 2 ? " [P2]" : " [P3]";
      console.log(`  ${status}${priorityTag} ${entity.displayName} (${entity.key})`);
      if (total > 0) {
        console.log(`         ${total} source(s), ${verified} verified`);
      }

      if (total === 0) {
        if (entity.priority === 1) missingP1.push(entity);
        if (entity.priority === 2) missingP2.push(entity);
        if (FLAG_SEED && (entity.priority <= 2 || FLAG_ALL)) {
          seedRows.push({ entityType: entity.key, displayName: entity.displayName, priority: entity.priority });
        }
      }
    }
    console.log();
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const coveragePct = Math.round((totalCovered / checklist.totalExpected) * 100);

  console.log(`════════════════════════════════════════════════════`);
  console.log(` Coverage Summary for ${COUNTY}, ${STATE}`);
  console.log(`════════════════════════════════════════════════════`);
  console.log(` Total expected:   ${checklist.totalExpected}`);
  console.log(` Covered:          ${totalCovered} (${coveragePct}%)`);
  console.log(` Missing:          ${totalMissing}`);
  console.log(` Missing P1 (essential): ${missingP1.length}`);
  console.log(` Missing P2 (important): ${missingP2.length}`);
  console.log();

  if (missingP1.length > 0) {
    console.log(" ⚠️  Missing Priority-1 (essential) entities:");
    missingP1.forEach((e) => console.log(`    - ${e.displayName}`));
    console.log();
  }

  // ── Seed placeholder rows ─────────────────────────────────────────────────

  if (FLAG_SEED && seedRows.length > 0) {
    console.log(`Seeding ${seedRows.length} placeholder rows (verification_status = 'pending')…`);
    let seeded = 0;
    let skipped = 0;

    for (const row of seedRows) {
      // Use the entity's primary record type as the source category
      const spec = checklist.expectedEntities.find((e) => e.key === row.entityType);
      const primaryRecordType = spec?.recordTypes[0] ?? "agenda";
      // Map record type to source category
      const catMap: Record<string, string> = {
        agenda: "agenda-page", minutes: "minutes-page", budget: "budget-page",
        audit: "audit-page", election: "election-page", "public-notice": "public-notice-page",
        "bid-rfp": "bid-page", contract: "contract-page", "press-release": "news-page",
        report: "news-page", "financial-statement": "budget-page",
        ordinance: "minutes-page", resolution: "minutes-page",
        "tax-notice": "public-notice-page", "public-hearing": "public-notice-page",
        "planning-case": "public-notice-page", permit: "permit-page",
        "meeting-calendar": "agenda-page", "candidate-filing": "election-page",
        "ballot-measure": "election-page",
      };
      const sourceCategory = catMap[primaryRecordType] ?? "news-page";

      // Generate a placeholder URL (search query format so it's obvious it's not real)
      const searchQuery = [row.displayName, COUNTY, STATE].map((s) => encodeURIComponent(s)).join("+");
      const placeholderUrl = `https://PLACEHOLDER--${row.entityType}--${STATE.toLowerCase()}--${encodeURIComponent(COUNTY.toLowerCase().replace(/\s+/g, "-"))}`;

      // Skip if a row with this entity_type + state + county already exists
      const existing = await pool.query(
        "SELECT id FROM source_registry WHERE entity_type = $1 AND state = $2 AND (county = $3 OR county IS NULL) LIMIT 1",
        [row.entityType, STATE, COUNTY]
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      await pool.query(
        `INSERT INTO source_registry
           (entity_name, entity_type, state, county, source_category, source_platform,
            source_url, verification_status, notes, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'Other',$6,'pending',$7,true,now(),now())`,
        [
          row.displayName,
          row.entityType,
          STATE,
          COUNTY,
          sourceCategory,
          placeholderUrl,
          `Auto-generated checklist placeholder. Priority ${row.priority}. Source URL and details need manual discovery or crawler verification.`,
        ]
      );
      seeded++;
      console.log(`  + Seeded placeholder: ${row.displayName}`);
    }

    console.log(`\n  Seeded: ${seeded}, Skipped (already exists): ${skipped}`);
  } else if (!FLAG_SEED) {
    console.log(" Tip: Run with --seed to create placeholder entries for missing entities.");
    console.log("      Run with --seed --all to include priority-3 entities too.\n");
  }

  // ── Record type summary ──────────────────────────────────────────────────

  console.log(`════════════════════════════════════════════════════`);
  console.log(" Record Types to Search For (for all entities)");
  console.log(`════════════════════════════════════════════════════`);

  const allRecordTypes = new Set<string>();
  for (const e of checklist.expectedEntities) {
    e.recordTypes.forEach((r) => allRecordTypes.add(r));
  }
  const sorted = [...allRecordTypes].sort();
  sorted.forEach((r) => console.log(`  • ${r}`));
  console.log(`\n  Total unique record types: ${sorted.length}`);
  console.log();

  await pool.end();
  console.log("=== Done ===\n");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
