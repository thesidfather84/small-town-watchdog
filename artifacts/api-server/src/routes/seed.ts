import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, entitiesTable } from "@workspace/db";

const router = Router();

type SeedEntity = {
  name: string;
  type: string;
  state: string;
  city: string;
  location: string;
  description?: string;
  website?: string;
};

const PRIORITY_ENTITIES: SeedEntity[] = [
  // ─── Louisiana: Existing St. Tammany (update state/city) ─────────────────
  // These are tagged in the fixExisting helper below

  // ─── Louisiana: New Orleans ───────────────────────────────────────────────
  {
    name: "New Orleans City Council",
    type: "city-government",
    state: "LA",
    city: "New Orleans",
    location: "New Orleans, Orleans Parish, Louisiana",
    website: "https://council.nola.gov",
    description: "New Orleans City Council — budgets, ordinances, contracts",
  },
  {
    name: "Orleans Parish Government",
    type: "parish-government",
    state: "LA",
    city: "New Orleans",
    location: "New Orleans, Orleans Parish, Louisiana",
    website: "https://nola.gov",
    description: "City of New Orleans / Orleans Parish consolidated government",
  },
  {
    name: "Orleans Parish School Board",
    type: "school-board",
    state: "LA",
    city: "New Orleans",
    location: "New Orleans, Orleans Parish, Louisiana",
    website: "https://www.opsb.us",
    description: "Orleans Parish School Board — budgets, agendas, policies",
  },
  {
    name: "New Orleans Police Department",
    type: "sheriff",
    state: "LA",
    city: "New Orleans",
    location: "New Orleans, Orleans Parish, Louisiana",
    website: "https://nola.gov/nopd",
    description: "New Orleans Police Department — budget, contracts, public notices",
  },
  {
    name: "Orleans Parish Registrar of Voters",
    type: "election-office",
    state: "LA",
    city: "New Orleans",
    location: "New Orleans, Orleans Parish, Louisiana",
    website: "https://www.orleanscivilsheriff.com",
    description: "Orleans Parish Registrar of Voters — election notices, voter info",
  },

  // ─── Louisiana: Baton Rouge ───────────────────────────────────────────────
  {
    name: "Baton Rouge City-Parish Government",
    type: "city-government",
    state: "LA",
    city: "Baton Rouge",
    location: "Baton Rouge, East Baton Rouge Parish, Louisiana",
    website: "https://www.brla.gov",
    description: "East Baton Rouge consolidated city-parish government — Metro Council, mayor-president",
  },
  {
    name: "East Baton Rouge Parish Council",
    type: "parish-government",
    state: "LA",
    city: "Baton Rouge",
    location: "Baton Rouge, East Baton Rouge Parish, Louisiana",
    website: "https://www.brla.gov",
    description: "East Baton Rouge Parish Council — budgets, millages, zoning",
  },
  {
    name: "East Baton Rouge Parish School System",
    type: "school-board",
    state: "LA",
    city: "Baton Rouge",
    location: "Baton Rouge, East Baton Rouge Parish, Louisiana",
    website: "https://www.ebrschools.org",
    description: "EBR School District — budgets, board agendas, tax proposals",
  },
  {
    name: "East Baton Rouge Parish Sheriff",
    type: "sheriff",
    state: "LA",
    city: "Baton Rouge",
    location: "Baton Rouge, East Baton Rouge Parish, Louisiana",
    website: "https://www.ebrso.org",
    description: "East Baton Rouge Parish Sheriff's Office — budget, public notices",
  },
  {
    name: "East Baton Rouge Parish Registrar of Voters",
    type: "election-office",
    state: "LA",
    city: "Baton Rouge",
    location: "Baton Rouge, East Baton Rouge Parish, Louisiana",
    description: "EBR Registrar of Voters — election notices, voter registration",
  },

  // ─── Louisiana: Lafayette ─────────────────────────────────────────────────
  {
    name: "Lafayette City-Parish Government",
    type: "city-government",
    state: "LA",
    city: "Lafayette",
    location: "Lafayette, Lafayette Parish, Louisiana",
    website: "https://www.lafayettela.gov",
    description: "Lafayette consolidated city-parish government",
  },
  {
    name: "Lafayette Parish School System",
    type: "school-board",
    state: "LA",
    city: "Lafayette",
    location: "Lafayette, Lafayette Parish, Louisiana",
    website: "https://www.lpssonline.com",
    description: "Lafayette Parish School System",
  },

  // ─── Louisiana: Shreveport ────────────────────────────────────────────────
  {
    name: "City of Shreveport",
    type: "city-government",
    state: "LA",
    city: "Shreveport",
    location: "Shreveport, Caddo Parish, Louisiana",
    website: "https://www.shreveportla.gov",
    description: "City of Shreveport — mayor, council, budgets, contracts",
  },
  {
    name: "Caddo Parish Commission",
    type: "parish-government",
    state: "LA",
    city: "Shreveport",
    location: "Shreveport, Caddo Parish, Louisiana",
    website: "https://www.caddo.org",
    description: "Caddo Parish Commission — budgets, millages, ordinances",
  },
  {
    name: "Caddo Parish School Board",
    type: "school-board",
    state: "LA",
    city: "Shreveport",
    location: "Shreveport, Caddo Parish, Louisiana",
    website: "https://www.caddo.k12.la.us",
    description: "Caddo Parish School Board",
  },

  // ─── Mississippi: Jackson ─────────────────────────────────────────────────
  {
    name: "Jackson City Council",
    type: "city-government",
    state: "MS",
    city: "Jackson",
    location: "Jackson, Hinds County, Mississippi",
    website: "https://www.jacksonms.gov",
    description: "Jackson City Council — budgets, ordinances, contracts",
  },
  {
    name: "Hinds County Board of Supervisors",
    type: "parish-government",
    state: "MS",
    city: "Jackson",
    location: "Jackson, Hinds County, Mississippi",
    website: "https://www.hindscountyms.com",
    description: "Hinds County Board of Supervisors — county government, budgets",
  },
  {
    name: "Hinds County School District",
    type: "school-board",
    state: "MS",
    city: "Jackson",
    location: "Jackson, Hinds County, Mississippi",
    website: "https://www.hinds.k12.ms.us",
    description: "Hinds County School District",
  },

  // ─── Mississippi: Gulfport ────────────────────────────────────────────────
  {
    name: "City of Gulfport",
    type: "city-government",
    state: "MS",
    city: "Gulfport",
    location: "Gulfport, Harrison County, Mississippi",
    website: "https://www.gulfport-ms.gov",
    description: "City of Gulfport — mayor, council, budgets, contracts",
  },
  {
    name: "Harrison County Board of Supervisors",
    type: "parish-government",
    state: "MS",
    city: "Gulfport",
    location: "Gulfport, Harrison County, Mississippi",
    website: "https://www.co.harrison.ms.us",
    description: "Harrison County Board of Supervisors",
  },

  // ─── Mississippi: Bay St. Louis ───────────────────────────────────────────
  {
    name: "City of Bay St. Louis",
    type: "city-government",
    state: "MS",
    city: "Bay St. Louis",
    location: "Bay St. Louis, Hancock County, Mississippi",
    website: "https://www.cityofbaysaintlouis.com",
    description: "City of Bay St. Louis — mayor, council, budgets",
  },
  {
    name: "Hancock County Board of Supervisors",
    type: "parish-government",
    state: "MS",
    city: "Bay St. Louis",
    location: "Bay St. Louis, Hancock County, Mississippi",
    description: "Hancock County Board of Supervisors",
  },
  {
    name: "Hancock County School District",
    type: "school-board",
    state: "MS",
    city: "Bay St. Louis",
    location: "Bay St. Louis, Hancock County, Mississippi",
    description: "Hancock County School District",
  },
];

const EXISTING_ENTITY_UPDATES: Array<{ nameLike: string; state: string; city: string }> = [
  { nameLike: "St. Tammany Parish Government",     state: "LA", city: "Covington" },
  { nameLike: "City of Slidell",                   state: "LA", city: "Slidell" },
  { nameLike: "St. Tammany Parish School Board",   state: "LA", city: "Covington" },
  { nameLike: "St. Tammany Parish Sheriff",        state: "LA", city: "Covington" },
  { nameLike: "Louisiana Legislative Auditor",     state: "LA", city: "Baton Rouge" },
];

router.post("/admin/seed-priority-cities", async (req, res): Promise<void> => {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Update existing entities with state/city if missing
  for (const update of EXISTING_ENTITY_UPDATES) {
    const rows = await db
      .select({ id: entitiesTable.id, state: entitiesTable.state })
      .from(entitiesTable)
      .where(eq(entitiesTable.name, update.nameLike));

    for (const row of rows) {
      if (!row.state) {
        await db
          .update(entitiesTable)
          .set({ state: update.state, city: update.city })
          .where(eq(entitiesTable.id, row.id));
        updated++;
      } else {
        skipped++;
      }
    }
  }

  // Insert new priority city entities (idempotent by name+state+city)
  for (const entity of PRIORITY_ENTITIES) {
    const existing = await db
      .select({ id: entitiesTable.id })
      .from(entitiesTable)
      .where(
        and(
          eq(entitiesTable.name, entity.name),
          eq(entitiesTable.state, entity.state),
          eq(entitiesTable.city, entity.city),
        )
      );

    if (existing.length === 0) {
      await db.insert(entitiesTable).values({
        name: entity.name,
        type: entity.type,
        state: entity.state,
        city: entity.city,
        location: entity.location,
        description: entity.description ?? null,
        website: entity.website ?? null,
        isActive: true,
      });
      inserted++;
    } else {
      skipped++;
    }
  }

  res.json({ ok: true, inserted, updated, skipped });
});

export default router;
