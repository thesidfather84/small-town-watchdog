import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, documentsTable, entitiesTable } from "@workspace/db";
import { ListAlertsQueryParams } from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/alerts", asyncHandler(async (req, res): Promise<void> => {
  const queryParams = ListAlertsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { entityId, category, redFlagLevel, limit } = queryParams.data;

  const conditions = [
    sql`${documentsTable.alertCategory} IS NOT NULL`,
  ];
  if (entityId) conditions.push(eq(documentsTable.entityId, entityId));
  if (category) conditions.push(eq(documentsTable.alertCategory, category));
  if (redFlagLevel) conditions.push(eq(documentsTable.redFlagLevel, redFlagLevel));

  const docs = await db
    .select({
      doc: documentsTable,
      entityName: entitiesTable.name,
    })
    .from(documentsTable)
    .leftJoin(entitiesTable, eq(documentsTable.entityId, entitiesTable.id))
    .where(and(...conditions))
    .orderBy(desc(documentsTable.createdAt))
    .limit(limit ?? 50);

  const alerts = docs.map(({ doc, entityName }) => ({
    id: doc.id,
    documentId: doc.id,
    entityId: doc.entityId,
    entityName: entityName ?? "Unknown",
    title: doc.title,
    plainSummary: doc.plainSummary,
    category: doc.alertCategory ?? "general",
    redFlagLevel: doc.redFlagLevel ?? "green",
    sourceUrl: doc.sourceUrl,
    isAiGenerated: doc.isAiGenerated ?? false,
    year: doc.year,
    createdAt: doc.createdAt.toISOString(),
  }));

  res.json(alerts);
}));

export default router;
