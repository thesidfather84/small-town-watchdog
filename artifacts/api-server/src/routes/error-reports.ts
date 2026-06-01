import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, errorReportsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

const VALID_REPORT_TYPES = [
  "wrong_info", "broken_source", "missing_source",
  "biased_language", "outdated", "other",
] as const;

// Public: submit an error report
router.post("/error-reports", asyncHandler(async (req, res): Promise<void> => {
  const { civicItemId, reportType, message } = req.body as {
    civicItemId?: number;
    reportType?: string;
    message?: string;
  };

  if (!reportType || !VALID_REPORT_TYPES.includes(reportType as typeof VALID_REPORT_TYPES[number])) {
    res.status(400).json({ error: `reportType must be one of: ${VALID_REPORT_TYPES.join(", ")}` });
    return;
  }

  const [report] = await db
    .insert(errorReportsTable)
    .values({
      civicItemId: civicItemId ?? null,
      reportType,
      message: message ?? null,
      status: "open",
    })
    .returning();

  res.status(201).json({
    ...report,
    createdAt: report.createdAt.toISOString(),
  });
}));

// Admin: list all error reports
router.get("/admin/error-reports", asyncHandler(async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  const reports = await db
    .select()
    .from(errorReportsTable)
    .where(status ? eq(errorReportsTable.status, status) : undefined)
    .orderBy(desc(errorReportsTable.createdAt))
    .limit(200);

  res.json(
    reports.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}));

// Admin: update report status
router.patch("/admin/error-reports/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { status } = req.body as { status?: string };
  const allowed = ["open", "reviewing", "resolved", "dismissed"];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    return;
  }

  const [updated] = await db
    .update(errorReportsTable)
    .set({ status })
    .where(eq(errorReportsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Error report not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
}));

export default router;
