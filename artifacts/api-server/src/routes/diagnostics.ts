import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  civicItemsTable,
  locationsTable,
  entitiesTable,
  sourceRegistryTable,
  scraperRunsTable,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/diagnostics", asyncHandler(async (req, res): Promise<void> => {
  const stateCode = typeof req.query.stateCode === "string" ? req.query.stateCode.trim() : "";
  const countyParish = typeof req.query.countyParish === "string" ? req.query.countyParish.trim() : "";

  const [locCount] = await db.select({ count: sql<number>`count(*)` }).from(locationsTable);
  const [entCount] = await db.select({ count: sql<number>`count(*)` }).from(entitiesTable);

  // Count from source_registry — the SAME table the scraper engine reads/writes.
  // (The legacy `sources` table is unused by the pipeline and was reporting 0.)
  const [srcCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sourceRegistryTable);
  const [validSrc] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sourceRegistryTable)
    .where(eq(sourceRegistryTable.verificationStatus, "verified"));
  const [brokenSrc] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sourceRegistryTable)
    .where(eq(sourceRegistryTable.verificationStatus, "broken"));
  const sourcesTotal = Number(srcCount?.count ?? 0);
  const validSources = Number(validSrc?.count ?? 0);
  const brokenSources = Number(brokenSrc?.count ?? 0);

  const [totalItems] = await db.select({ count: sql<number>`count(*)` }).from(civicItemsTable);
  const [approvedItems] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(eq(civicItemsTable.adminReviewStatus, "approved"));
  const [pendingItems] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(eq(civicItemsTable.adminReviewStatus, "needs_review"));
  const [redItems] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(eq(civicItemsTable.redFlagLevel, "red"));
  const [yellowItems] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(eq(civicItemsTable.redFlagLevel, "yellow"));
  const [greenItems] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(eq(civicItemsTable.redFlagLevel, "green"));

  // Last scraper run — read from the dedicated scraper_runs table that the
  // pipeline writes when it completes; fall back to civic_items.updated_at.
  let lastScraperRun: string | null = null;
  const [lastRun] = await db
    .select({ finishedAt: scraperRunsTable.finishedAt })
    .from(scraperRunsTable)
    .orderBy(desc(scraperRunsTable.finishedAt))
    .limit(1);
  if (lastRun?.finishedAt) {
    lastScraperRun = lastRun.finishedAt.toISOString();
  } else {
    const [lastItem] = await db
      .select({ updatedAt: civicItemsTable.updatedAt })
      .from(civicItemsTable)
      .orderBy(desc(civicItemsTable.updatedAt))
      .limit(1);
    if (lastItem?.updatedAt) lastScraperRun = lastItem.updatedAt.toISOString();
  }

  res.json({
    locationsCount: Number(locCount?.count ?? 0),
    entitiesCount: Number(entCount?.count ?? 0),
    sourcesCount: sourcesTotal,
    validSources,
    brokenSources,
    civicItemsTotal: Number(totalItems?.count ?? 0),
    civicItemsApproved: Number(approvedItems?.count ?? 0),
    civicItemsPending: Number(pendingItems?.count ?? 0),
    civicItemsRed: Number(redItems?.count ?? 0),
    civicItemsYellow: Number(yellowItems?.count ?? 0),
    civicItemsGreen: Number(greenItems?.count ?? 0),
    lastScraperRun,
  });
}));

/**
 * GET /admin/scraper-runs
 * Returns the last 50 crawler run records with full log details.
 */
router.get("/admin/scraper-runs", asyncHandler(async (req, res): Promise<void> => {
  const runs = await db
    .select()
    .from(scraperRunsTable)
    .orderBy(desc(scraperRunsTable.startedAt))
    .limit(50);

  res.json(
    runs.map((r) => ({
      ...r,
      startedAt:  r.startedAt.toISOString(),
      finishedAt: r.finishedAt.toISOString(),
      durationSeconds: Math.round(
        (r.finishedAt.getTime() - r.startedAt.getTime()) / 1000
      ),
    }))
  );
}));

export default router;
