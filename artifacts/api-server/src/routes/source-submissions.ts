import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, sourceSubmissionsTable, sourceRegistryTable } from "@workspace/db";
import {
  CreateSourceSubmissionBody,
  UpdateSourceSubmissionBody,
  UpdateSourceSubmissionParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

function formatRow(row: typeof sourceSubmissionsTable.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/source-submissions", asyncHandler(async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  const rows = status
    ? await db.select().from(sourceSubmissionsTable).where(eq(sourceSubmissionsTable.status, status)).orderBy(sourceSubmissionsTable.createdAt)
    : await db.select().from(sourceSubmissionsTable).orderBy(sourceSubmissionsTable.createdAt);

  res.json(rows.map(formatRow));
}));

router.post("/source-submissions", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateSourceSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const [row] = await db.insert(sourceSubmissionsTable).values({
    state: d.state.toUpperCase(),
    county: d.county ?? null,
    city: d.city,
    entityName: d.entityName,
    entityType: d.entityType,
    sourceUrl: d.sourceUrl,
    sourceCategory: d.sourceCategory,
    submitterNote: d.submitterNote ?? null,
    status: "pending",
  }).returning();

  res.status(201).json(formatRow(row));
}));

router.patch("/source-submissions/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = UpdateSourceSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSourceSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(sourceSubmissionsTable)
    .set(parsed.data)
    .where(eq(sourceSubmissionsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (parsed.data.status === "approved") {
    const existing = await db
      .select({ id: sourceRegistryTable.id })
      .from(sourceRegistryTable)
      .where(eq(sourceRegistryTable.sourceUrl, updated.sourceUrl));

    if (existing.length === 0) {
      await db.insert(sourceRegistryTable).values({
        state: updated.state,
        county: updated.county ?? null,
        city: updated.city,
        entityName: updated.entityName,
        entityType: updated.entityType,
        sourceUrl: updated.sourceUrl,
        sourceCategory: updated.sourceCategory,
        sourcePlatform: "Other",
        verificationStatus: "verified",
        notes: updated.submitterNote ?? null,
        isActive: true,
      });
    }
  }

  res.json(formatRow(updated));
}));

export default router;
