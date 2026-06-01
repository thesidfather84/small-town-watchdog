import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, civicItemsTable, entitiesTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { civicLocationConditions } from "../lib/locationFilter";

const router = Router();

router.get("/stats", asyncHandler(async (req, res): Promise<void> => {
  const stateCode = typeof req.query.stateCode === "string" ? req.query.stateCode.trim() : "";
  const countyParish = typeof req.query.countyParish === "string" ? req.query.countyParish.trim() : "";

  const hasLocation = !!stateCode;

  // Publication rule: only approved items count
  const approvedCondition = eq(civicItemsTable.adminReviewStatus, "approved");

  // Location filtering by denormalized state/county columns (shared rule).
  // Selecting a county also includes statewide items (county_parish IS NULL)
  // so the dashboard counts e.g. Legislative Auditor items alongside
  // parish-specific ones.
  const locationFilter = and(
    approvedCondition,
    ...civicLocationConditions(stateCode, countyParish)
  );

  // Count approved civic_items for location
  const [docCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(locationFilter);

  const [redCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(and(locationFilter, eq(civicItemsTable.redFlagLevel, "red")));

  const [yellowCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(and(locationFilter, eq(civicItemsTable.redFlagLevel, "yellow")));

  // Count distinct entities that have approved items for this location
  const entityRows = await db
    .selectDistinct({ entityId: civicItemsTable.entityId })
    .from(civicItemsTable)
    .where(and(locationFilter, sql`${civicItemsTable.entityId} IS NOT NULL`));
  const entityCount = entityRows.length;

  const totalDocs = Number(docCount?.count ?? 0);
  const totalRed = Number(redCount?.count ?? 0);
  const totalYellow = Number(yellowCount?.count ?? 0);

  // Recent flagged items as alerts feed
  const recentItems = await db
    .select({
      item: civicItemsTable,
      entityName: entitiesTable.name,
    })
    .from(civicItemsTable)
    .leftJoin(entitiesTable, eq(civicItemsTable.entityId, entitiesTable.id))
    .where(
      and(
        locationFilter,
        sql`${civicItemsTable.redFlagLevel} IN ('red', 'yellow')`
      )
    )
    .orderBy(desc(civicItemsTable.createdAt))
    .limit(5);

  const recentAlerts = recentItems.map(({ item, entityName }) => ({
    id: item.id,
    documentId: item.id,
    entityId: item.entityId ?? 0,
    entityName: entityName ?? item.sourceAgency ?? "Unknown",
    title: item.title,
    plainSummary: item.aiSummary ?? null,
    category: item.itemType ?? "general",
    redFlagLevel: item.redFlagLevel ?? "green",
    sourceUrl: item.sourceUrl ?? null,
    isAiGenerated: !!item.aiSummary,
    year: item.eventDate ? new Date(item.eventDate).getFullYear() : null,
    createdAt: item.createdAt.toISOString(),
  }));

  // Breakdown by type
  const byType = await db
    .select({ label: civicItemsTable.itemType, count: sql<number>`count(*)` })
    .from(civicItemsTable)
    .where(locationFilter)
    .groupBy(civicItemsTable.itemType)
    .orderBy(sql`count(*) DESC`);

  // Breakdown by year (from event_date)
  const byYear = await db
    .select({
      label: sql<string>`EXTRACT(YEAR FROM ${civicItemsTable.eventDate})::text`,
      count: sql<number>`count(*)`,
    })
    .from(civicItemsTable)
    .where(and(locationFilter, sql`${civicItemsTable.eventDate} IS NOT NULL`))
    .groupBy(sql`EXTRACT(YEAR FROM ${civicItemsTable.eventDate})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${civicItemsTable.eventDate})`);

  res.json({
    totalEntities: entityCount,
    totalDocuments: totalDocs,
    totalAlerts: totalRed + totalYellow,
    redFlagCount: totalRed,
    yellowFlagCount: totalYellow,
    hasLocation,
    recentAlerts,
    documentsByType: byType.map((r) => ({ label: r.label ?? "unknown", count: Number(r.count) })),
    documentsByYear: byYear.map((r) => ({ label: r.label ?? "unknown", count: Number(r.count) })),
  });
}));

export default router;
