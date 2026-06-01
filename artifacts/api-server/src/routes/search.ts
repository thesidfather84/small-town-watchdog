import { Router } from "express";
import { and, eq, ilike, or, desc, sql } from "drizzle-orm";
import { db, civicItemsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

/**
 * GET /search
 * Query params:
 *   q          - search terms (required)
 *   state      - filter by state code (optional)
 *   county     - filter by county/parish (optional)
 *   itemType   - filter by item type (optional)
 *   flagLevel  - red | yellow | green (optional)
 *   limit      - max results (default 50, max 100)
 *
 * Only searches approved items with real source URLs.
 */
router.get("/search", asyncHandler(async (req, res): Promise<void> => {
  const q         = typeof req.query.q      === "string" ? req.query.q.trim()      : "";
  const state     = typeof req.query.state  === "string" ? req.query.state.trim()  : "";
  const county    = typeof req.query.county === "string" ? req.query.county.trim() : "";
  const itemType  = typeof req.query.itemType  === "string" ? req.query.itemType.trim()  : "";
  const flagLevel = typeof req.query.flagLevel === "string" ? req.query.flagLevel.trim() : "";
  const rawLimit  = parseInt(String(req.query.limit ?? "50"), 10);
  const limit     = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100);

  if (!q || q.length < 2) {
    res.status(400).json({ error: "Search query must be at least 2 characters." });
    return;
  }

  const conditions = [
    // Only approved items with a verified source URL
    eq(civicItemsTable.adminReviewStatus, "approved"),
    sql`${civicItemsTable.sourceUrl} IS NOT NULL`,
    // Full-text search across title, AI summary, original text, and agency name
    or(
      ilike(civicItemsTable.title,        `%${q}%`),
      ilike(civicItemsTable.aiSummary,    `%${q}%`),
      ilike(civicItemsTable.originalText, `%${q}%`),
      ilike(civicItemsTable.sourceAgency, `%${q}%`),
    )!,
  ];

  if (state)     conditions.push(eq(civicItemsTable.stateCode,    state.toUpperCase()));
  if (county)    conditions.push(ilike(civicItemsTable.countyParish, `%${county}%`));
  if (itemType)  conditions.push(eq(civicItemsTable.itemType,     itemType));
  if (flagLevel) conditions.push(eq(civicItemsTable.redFlagLevel, flagLevel));

  const items = await db
    .select({
      id:            civicItemsTable.id,
      itemType:      civicItemsTable.itemType,
      title:         civicItemsTable.title,
      sourceAgency:  civicItemsTable.sourceAgency,
      sourceUrl:     civicItemsTable.sourceUrl,
      aiSummary:     civicItemsTable.aiSummary,
      redFlagLevel:  civicItemsTable.redFlagLevel,
      stateCode:     civicItemsTable.stateCode,
      countyParish:  civicItemsTable.countyParish,
      eventDate:     civicItemsTable.eventDate,
      createdAt:     civicItemsTable.createdAt,
      isAiGenerated: sql<boolean>`${civicItemsTable.aiSummary} IS NOT NULL`,
    })
    .from(civicItemsTable)
    .where(and(...conditions))
    .orderBy(desc(civicItemsTable.createdAt))
    .limit(limit);

  res.json({
    query: q,
    total: items.length,
    results: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}));

export default router;
