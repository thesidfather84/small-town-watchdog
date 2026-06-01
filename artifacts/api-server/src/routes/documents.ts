import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, documentsTable, entitiesTable } from "@workspace/db";
import {
  CreateDocumentBody,
  UpdateDocumentBody,
  UpdateDocumentParams,
  DeleteDocumentParams,
  GetDocumentParams,
  ListDocumentsQueryParams,
  SummarizeDocumentParams,
} from "@workspace/api-zod";
import { generateSummary } from "../lib/ai";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

function formatDoc(doc: typeof documentsTable.$inferSelect, entityName?: string | null) {
  return {
    ...doc,
    entityName: entityName ?? null,
    isAiGenerated: doc.isAiGenerated ?? false,
    redFlagLevel: doc.redFlagLevel ?? "green",
    amountInvolved: doc.amountInvolved != null ? Number(doc.amountInvolved) : null,
    sourceStatus: doc.sourceStatus ?? "pending_review",
    lastVerifiedAt: doc.lastVerifiedAt ? doc.lastVerifiedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    pulledAt: doc.pulledAt ? doc.pulledAt.toISOString() : null,
  };
}

router.get("/documents", asyncHandler(async (req, res): Promise<void> => {
  const queryParams = ListDocumentsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { entityId, year, type, alertCategory, redFlagLevel, limit, offset } = queryParams.data;

  const conditions = [];
  if (entityId) conditions.push(eq(documentsTable.entityId, entityId));
  if (year) conditions.push(eq(documentsTable.year, year));
  if (type) conditions.push(eq(documentsTable.docType, type));
  if (alertCategory) conditions.push(eq(documentsTable.alertCategory, alertCategory));
  if (redFlagLevel) conditions.push(eq(documentsTable.redFlagLevel, redFlagLevel));

  const docs = await db
    .select({
      doc: documentsTable,
      entityName: entitiesTable.name,
    })
    .from(documentsTable)
    .leftJoin(entitiesTable, eq(documentsTable.entityId, entitiesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${documentsTable.createdAt} DESC`)
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(docs.map(({ doc, entityName }) => formatDoc(doc, entityName)));
}));

router.post("/documents", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const insertValues = {
    ...parsed.data,
    amountInvolved: parsed.data.amountInvolved != null ? String(parsed.data.amountInvolved) : undefined,
  };
  const [doc] = await db.insert(documentsTable).values(insertValues).returning();

  const [entityRow] = await db.select({ name: entitiesTable.name }).from(entitiesTable).where(eq(entitiesTable.id, doc.entityId));

  res.status(201).json(formatDoc(doc, entityRow?.name));
}));

router.get("/documents/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ doc: documentsTable, entityName: entitiesTable.name })
    .from(documentsTable)
    .leftJoin(entitiesTable, eq(documentsTable.entityId, entitiesTable.id))
    .where(eq(documentsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(formatDoc(row.doc, row.entityName));
}));

router.patch("/documents/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateValues = {
    ...parsed.data,
    amountInvolved: parsed.data.amountInvolved != null ? String(parsed.data.amountInvolved) : undefined,
  };
  const [doc] = await db
    .update(documentsTable)
    .set(updateValues)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const [entityRow] = await db.select({ name: entitiesTable.name }).from(entitiesTable).where(eq(entitiesTable.id, doc.entityId));

  res.json(formatDoc(doc, entityRow?.name));
}));

router.delete("/documents/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.sendStatus(204);
}));

router.post("/documents/:id/summarize", asyncHandler(async (req, res): Promise<void> => {
  const params = SummarizeDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ doc: documentsTable, entityName: entitiesTable.name })
    .from(documentsTable)
    .leftJoin(entitiesTable, eq(documentsTable.entityId, entitiesTable.id))
    .where(eq(documentsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  let summaryResult: Awaited<ReturnType<typeof generateSummary>>;
  try {
    summaryResult = await generateSummary(
      row.doc.title,
      row.doc.content ?? "",
      row.entityName ?? "",
      row.doc.docType,
      row.doc.year
    );
  } catch (err) {
    req.log.error({ err }, "AI summary generation failed");
    res.status(502).json({ error: "AI summary generation failed. Please try again." });
    return;
  }

  const { plainSummary, eli12Summary, redFlagLevel, alertCategory } = summaryResult;

  const [updated] = await db
    .update(documentsTable)
    .set({ plainSummary, eli12Summary, redFlagLevel, alertCategory, isAiGenerated: true })
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  res.json(formatDoc(updated, row.entityName));
}));

export default router;
