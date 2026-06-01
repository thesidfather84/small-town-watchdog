import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, civicItemsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { civicLocationConditions } from "../lib/locationFilter";

const router = Router();

function formatItem(item: typeof civicItemsTable.$inferSelect) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    lastVerifiedAt: item.lastVerifiedAt?.toISOString() ?? null,
    meetingDate: item.meetingDate?.toISOString() ?? null,
  };
}

// Public: only approved items
router.get("/civic-items", asyncHandler(async (req, res): Promise<void> => {
  const { locationId, stateCode, countyParish, itemType, adminStatus } = req.query as {
    locationId?: string;
    stateCode?: string;
    countyParish?: string;
    itemType?: string;
    adminStatus?: string;
  };

  const conditions = [];

  // Default: only approved items for public feed
  const status = adminStatus ?? "approved";
  conditions.push(eq(civicItemsTable.adminReviewStatus, status));

  if (locationId) {
    const locId = parseInt(locationId, 10);
    if (!isNaN(locId)) conditions.push(eq(civicItemsTable.locationId, locId));
  }
  // Location filtering by denormalized state/county (works for statewide sources too)
  conditions.push(...civicLocationConditions(stateCode, countyParish));
  if (itemType) conditions.push(eq(civicItemsTable.itemType, itemType));

  const items = await db
    .select()
    .from(civicItemsTable)
    .where(and(...conditions))
    .orderBy(desc(civicItemsTable.createdAt))
    .limit(100);

  res.json(items.map(formatItem));
}));

// Admin: all items regardless of review status
router.get("/admin/civic-items", asyncHandler(async (req, res): Promise<void> => {
  const { locationId, stateCode, countyParish, adminReviewStatus } = req.query as {
    locationId?: string;
    stateCode?: string;
    countyParish?: string;
    adminReviewStatus?: string;
  };

  const conditions = [];
  if (locationId) {
    const locId = parseInt(locationId, 10);
    if (!isNaN(locId)) conditions.push(eq(civicItemsTable.locationId, locId));
  }
  conditions.push(...civicLocationConditions(stateCode, countyParish));
  if (adminReviewStatus) conditions.push(eq(civicItemsTable.adminReviewStatus, adminReviewStatus));

  const items = await db
    .select()
    .from(civicItemsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(civicItemsTable.createdAt))
    .limit(200);

  res.json(items.map(formatItem));
}));

// Admin: update review status
router.patch("/admin/civic-items/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { adminReviewStatus } = req.body as { adminReviewStatus?: string };
  const allowed = ["draft", "needs_review", "approved", "rejected", "broken_source"];
  if (!adminReviewStatus || !allowed.includes(adminReviewStatus)) {
    res.status(400).json({ error: `adminReviewStatus must be one of: ${allowed.join(", ")}` });
    return;
  }

  const [updated] = await db
    .update(civicItemsTable)
    .set({ adminReviewStatus })
    .where(eq(civicItemsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Civic item not found" });
    return;
  }

  res.json(formatItem(updated));
}));

export default router;
