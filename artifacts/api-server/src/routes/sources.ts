import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, sourcesTable } from "@workspace/db";
import {
  CreateSourceBody,
  UpdateSourceBody,
  UpdateSourceParams,
  DeleteSourceParams,
  ListSourcesQueryParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/sources", asyncHandler(async (req, res): Promise<void> => {
  const queryParams = ListSourcesQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  let query = db.select().from(sourcesTable).$dynamic();
  if (queryParams.data.entityId) {
    query = query.where(eq(sourcesTable.entityId, queryParams.data.entityId));
  }

  const sources = await query.orderBy(sourcesTable.name);
  res.json(
    sources.map((s) => ({
      ...s,
      isActive: s.isActive ?? true,
      createdAt: s.createdAt.toISOString(),
      lastChecked: s.lastChecked ? s.lastChecked.toISOString() : null,
    }))
  );
}));

router.post("/sources", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [source] = await db.insert(sourcesTable).values(parsed.data).returning();
  res.status(201).json({
    ...source,
    isActive: source.isActive ?? true,
    createdAt: source.createdAt.toISOString(),
    lastChecked: source.lastChecked ? source.lastChecked.toISOString() : null,
  });
}));

router.patch("/sources/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = UpdateSourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [source] = await db
    .update(sourcesTable)
    .set(parsed.data)
    .where(eq(sourcesTable.id, params.data.id))
    .returning();

  if (!source) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  res.json({
    ...source,
    isActive: source.isActive ?? true,
    createdAt: source.createdAt.toISOString(),
    lastChecked: source.lastChecked ? source.lastChecked.toISOString() : null,
  });
}));

router.delete("/sources/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = DeleteSourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [source] = await db
    .delete(sourcesTable)
    .where(eq(sourcesTable.id, params.data.id))
    .returning();

  if (!source) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  res.sendStatus(204);
}));

export default router;
