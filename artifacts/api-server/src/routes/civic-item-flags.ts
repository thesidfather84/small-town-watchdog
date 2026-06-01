import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { db, civicItemFlagsTable, civicItemsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../lib/requireAdmin";

const router = Router();

function getIpHash(req: import("express").Request): string {
  const raw =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  return createHash("sha256").update(raw).digest("hex");
}

// Public: flag a civic item
router.post("/civic-item-flags", asyncHandler(async (req, res): Promise<void> => {
  const { civicItemId, reason, notes, flaggedBy } = req.body as {
    civicItemId?: number;
    reason?: string;
    notes?: string;
    flaggedBy?: string;
  };

  if (!civicItemId || typeof civicItemId !== "number") {
    res.status(400).json({ error: "civicItemId is required" });
    return;
  }

  const validReasons = ["inaccurate", "outdated", "broken_link", "inappropriate", "other"];
  const safeReason = reason && validReasons.includes(reason) ? reason : "other";

  const ipHash = getIpHash(req);

  await db.insert(civicItemFlagsTable).values({
    civicItemId,
    reason: safeReason,
    notes: notes?.slice(0, 500) ?? null,
    flaggedBy: flaggedBy?.slice(0, 100) ?? "public",
    ipHash,
    status: "open",
  });

  res.status(201).json({ success: true });
}));

// Admin: list flags (open by default, or filter by status)
router.get("/admin/civic-item-flags", requireAdmin, asyncHandler(async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  const rows = await db
    .select({
      id: civicItemFlagsTable.id,
      civicItemId: civicItemFlagsTable.civicItemId,
      reason: civicItemFlagsTable.reason,
      notes: civicItemFlagsTable.notes,
      flaggedBy: civicItemFlagsTable.flaggedBy,
      status: civicItemFlagsTable.status,
      resolvedBy: civicItemFlagsTable.resolvedBy,
      resolvedAt: civicItemFlagsTable.resolvedAt,
      createdAt: civicItemFlagsTable.createdAt,
      updatedAt: civicItemFlagsTable.updatedAt,
      itemTitle: civicItemsTable.title,
      itemSourceUrl: civicItemsTable.sourceUrl,
    })
    .from(civicItemFlagsTable)
    .leftJoin(civicItemsTable, eq(civicItemFlagsTable.civicItemId, civicItemsTable.id))
    .where(status ? eq(civicItemFlagsTable.status, status) : eq(civicItemFlagsTable.status, "open"))
    .orderBy(desc(civicItemFlagsTable.createdAt))
    .limit(200);

  res.json(rows.map((r) => ({
    ...r,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
}));

// Admin: resolve or dismiss a flag
router.patch("/admin/civic-item-flags/:id", requireAdmin, asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { status, resolvedBy } = req.body as { status?: string; resolvedBy?: string };
  const validStatuses = ["open", "resolved", "dismissed"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(civicItemFlagsTable)
    .set({
      status,
      resolvedBy: resolvedBy ?? "admin",
      resolvedAt: status !== "open" ? now : null,
    })
    .where(eq(civicItemFlagsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Flag not found" });
    return;
  }

  res.json({
    ...updated,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}));

export default router;
