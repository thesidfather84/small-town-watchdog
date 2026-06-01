import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/locations", asyncHandler(async (req, res): Promise<void> => {
  const { state, county } = req.query as { state?: string; county?: string };

  const conditions = [];
  if (state) conditions.push(eq(locationsTable.stateCode, state.toUpperCase()));
  if (county) conditions.push(eq(locationsTable.countyParish, county));

  const locations = await db
    .select()
    .from(locationsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(locationsTable.stateName, locationsTable.countyParish);

  res.json(
    locations.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    }))
  );
}));

router.get("/locations/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, id));
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
}));

export default router;
