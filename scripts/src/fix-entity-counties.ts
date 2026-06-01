/**
 * Back-fills the county column on entities that have a location string
 * but a null county. Uses location text pattern matching.
 */
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const mappings: Array<{ pattern: string; county: string }> = [
  { pattern: "Hancock County",          county: "Hancock County" },
  { pattern: "Hinds County",            county: "Hinds County" },
  { pattern: "Harrison County",         county: "Harrison County" },
  { pattern: "Orleans Parish",          county: "Orleans Parish" },
  { pattern: "East Baton Rouge Parish", county: "East Baton Rouge Parish" },
  { pattern: "Lafayette Parish",        county: "Lafayette Parish" },
  { pattern: "Caddo Parish",            county: "Caddo Parish" },
  { pattern: "St. Tammany Parish",      county: "St. Tammany Parish" },
];

async function main() {
  let total = 0;
  for (const m of mappings) {
    const r = await pool.query(
      `UPDATE entities SET county = $1
       WHERE county IS NULL AND location ILIKE $2`,
      [m.county, `%${m.pattern}%`],
    );
    if (r.rowCount && r.rowCount > 0) {
      console.log(`  Updated ${r.rowCount} entities → county="${m.county}"`);
      total += r.rowCount;
    }
  }
  console.log(`\nTotal updated: ${total}`);
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
