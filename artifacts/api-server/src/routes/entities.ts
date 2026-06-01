import { Router } from "express";
import { eq, sql, and, ilike } from "drizzle-orm";
import { db, entitiesTable, documentsTable } from "@workspace/db";
import {
  CreateEntityBody,
  UpdateEntityBody,
  UpdateEntityParams,
  DeleteEntityParams,
  GetEntityParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/entities", asyncHandler(async (req, res): Promise<void> => {
  const { state, city } = req.query as { state?: string; city?: string };

  const conditions = [];
  if (state) conditions.push(eq(entitiesTable.state, state.toUpperCase()));
  if (city) conditions.push(ilike(entitiesTable.city, city));

  const entities = await db
    .select()
    .from(entitiesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(entitiesTable.name);

  const counts = await db
    .select({ entityId: documentsTable.entityId, count: sql<number>`count(*)` })
    .from(documentsTable)
    .groupBy(documentsTable.entityId);

  const countMap = new Map(counts.map((c) => [c.entityId, Number(c.count)]));

  const result = entities.map((e) => ({
    ...e,
    isActive: e.isActive ?? true,
    createdAt: e.createdAt.toISOString(),
    documentCount: countMap.get(e.id) ?? 0,
  }));

  res.json(result);
}));

router.post("/entities", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entity] = await db.insert(entitiesTable).values(parsed.data).returning();
  res.status(201).json({
    ...entity,
    isActive: entity.isActive ?? true,
    createdAt: entity.createdAt.toISOString(),
    documentCount: 0,
  });
}));

router.get("/entities/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = GetEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, params.data.id));
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentsTable)
    .where(eq(documentsTable.entityId, entity.id));

  res.json({
    ...entity,
    isActive: entity.isActive ?? true,
    createdAt: entity.createdAt.toISOString(),
    documentCount: Number(countRow?.count ?? 0),
  });
}));

router.patch("/entities/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = UpdateEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entity] = await db
    .update(entitiesTable)
    .set(parsed.data)
    .where(eq(entitiesTable.id, params.data.id))
    .returning();

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  res.json({
    ...entity,
    isActive: entity.isActive ?? true,
    createdAt: entity.createdAt.toISOString(),
    documentCount: null,
  });
}));

router.delete("/entities/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = DeleteEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entity] = await db
    .delete(entitiesTable)
    .where(eq(entitiesTable.id, params.data.id))
    .returning();

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  res.sendStatus(204);
}));

export default router;
