import { Router } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, sourceRegistryTable } from "@workspace/db";
import {
  CreateSourceRegistryBody,
  UpdateSourceRegistryBody,
  UpdateSourceRegistryParams,
  DeleteSourceRegistryParams,
  GetSourceRegistryParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

function formatRow(row: typeof sourceRegistryTable.$inferSelect) {
  return {
    ...row,
    isActive: row.isActive ?? true,
    createdAt: row.createdAt.toISOString(),
    lastChecked: row.lastChecked?.toISOString() ?? null,
    lastSuccessfulUpdate: row.lastSuccessfulUpdate?.toISOString() ?? null,
  };
}

router.get("/source-registry", asyncHandler(async (req, res): Promise<void> => {
  const { state, city, entityType, verificationStatus } = req.query as Record<string, string | undefined>;

  const conditions = [];
  if (state) conditions.push(eq(sourceRegistryTable.state, state.toUpperCase()));
  if (city) conditions.push(ilike(sourceRegistryTable.city, city));
  if (entityType) conditions.push(eq(sourceRegistryTable.entityType, entityType));
  if (verificationStatus) conditions.push(eq(sourceRegistryTable.verificationStatus, verificationStatus));

  const rows = await db
    .select()
    .from(sourceRegistryTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sourceRegistryTable.state, sourceRegistryTable.city, sourceRegistryTable.entityName);

  res.json(rows.map(formatRow));
}));

router.post("/source-registry", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateSourceRegistryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const [row] = await db.insert(sourceRegistryTable).values({
    state: d.state.toUpperCase(),
    county: d.county ?? null,
    city: d.city ?? null,
    entityName: d.entityName,
    entityType: d.entityType,
    sourceUrl: d.sourceUrl,
    sourceCategory: d.sourceCategory,
    sourcePlatform: d.sourcePlatform,
    verificationStatus: d.verificationStatus ?? "pending",
    notes: d.notes ?? null,
    isActive: d.isActive ?? true,
  }).returning();

  res.status(201).json(formatRow(row));
}));

router.get("/source-registry/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = GetSourceRegistryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.select().from(sourceRegistryTable).where(eq(sourceRegistryTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(formatRow(row));
}));

router.patch("/source-registry/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = UpdateSourceRegistryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSourceRegistryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data as Record<string, unknown>;
  if (typeof d["state"] === "string") d["state"] = (d["state"] as string).toUpperCase();
  if (typeof d["lastChecked"] === "string") d["lastChecked"] = new Date(d["lastChecked"] as string);
  if (typeof d["lastSuccessfulUpdate"] === "string") d["lastSuccessfulUpdate"] = new Date(d["lastSuccessfulUpdate"] as string);

  const [row] = await db
    .update(sourceRegistryTable)
    .set(d as Parameters<typeof db.update>[0] extends { set: (v: infer V) => unknown } ? V : never)
    .where(eq(sourceRegistryTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(formatRow(row));
}));

router.delete("/source-registry/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = DeleteSourceRegistryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.delete(sourceRegistryTable).where(eq(sourceRegistryTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendStatus(204);
}));

export default router;
