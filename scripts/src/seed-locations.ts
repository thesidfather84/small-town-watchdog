import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const locations = [
  { stateCode: "MS", stateName: "Mississippi",  countyParish: "Hancock County",           countyType: "county" },
  { stateCode: "MS", stateName: "Mississippi",  countyParish: "Hinds County",             countyType: "county" },
  { stateCode: "MS", stateName: "Mississippi",  countyParish: "Harrison County",          countyType: "county" },
  { stateCode: "LA", stateName: "Louisiana",    countyParish: "St. Tammany Parish",       countyType: "parish" },
  { stateCode: "LA", stateName: "Louisiana",    countyParish: "Orleans Parish",           countyType: "parish" },
  { stateCode: "LA", stateName: "Louisiana",    countyParish: "East Baton Rouge Parish",  countyType: "parish" },
  { stateCode: "LA", stateName: "Louisiana",    countyParish: "Lafayette Parish",         countyType: "parish" },
  { stateCode: "LA", stateName: "Louisiana",    countyParish: "Caddo Parish",             countyType: "parish" },
];

async function main() {
  console.log("Seeding locations...");
  for (const loc of locations) {
    const existing = await pool.query(
      "SELECT id FROM locations WHERE state_code=$1 AND county_parish=$2 LIMIT 1",
      [loc.stateCode, loc.countyParish],
    );
    if (existing.rows.length > 0) {
      console.log(`  • Already exists: ${loc.countyParish}, ${loc.stateName}`);
      continue;
    }
    await pool.query(
      `INSERT INTO locations (state_code, state_name, county_parish, county_type, is_active, coverage_status, created_at)
       VALUES ($1,$2,$3,$4,true,'partial',now())`,
      [loc.stateCode, loc.stateName, loc.countyParish, loc.countyType],
    );
    console.log(`  + Added: ${loc.countyParish}, ${loc.stateName}`);
  }
  const { rows } = await pool.query("SELECT state_code, county_parish FROM locations ORDER BY state_code, county_parish");
  console.log(`\nLocations in DB (${rows.length}):`);
  rows.forEach((r: { state_code: string; county_parish: string }) => console.log(`  ${r.state_code}  ${r.county_parish}`));
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
