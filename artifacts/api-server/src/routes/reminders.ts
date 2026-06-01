import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, remindersTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/reminders", asyncHandler(async (req, res): Promise<void> => {
  const { deviceId } = req.query as { deviceId?: string };
  if (!deviceId) {
    res.status(400).json({ error: "deviceId query param is required" });
    return;
  }

  const rows = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.userDeviceId, deviceId))
    .orderBy(remindersTable.createdAt);

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}));

router.post("/reminders", asyncHandler(async (req, res): Promise<void> => {
  const {
    userDeviceId,
    civicItemId,
    reminderType,
    remindEarlyVoting,
    remindDayBefore,
    remindTwoHoursBefore,
    remindPollClosing,
  } = req.body as {
    userDeviceId?: string;
    civicItemId?: number;
    reminderType?: string;
    remindEarlyVoting?: boolean;
    remindDayBefore?: boolean;
    remindTwoHoursBefore?: boolean;
    remindPollClosing?: boolean;
  };

  if (!userDeviceId) {
    res.status(400).json({ error: "userDeviceId is required" });
    return;
  }

  const [created] = await db
    .insert(remindersTable)
    .values({
      userDeviceId,
      civicItemId: civicItemId ?? null,
      reminderType: reminderType ?? "general",
      remindEarlyVoting: remindEarlyVoting ?? false,
      remindDayBefore: remindDayBefore ?? false,
      remindTwoHoursBefore: remindTwoHoursBefore ?? false,
      remindPollClosing: remindPollClosing ?? false,
    })
    .returning();

  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
}));

router.delete("/reminders/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { deviceId } = req.query as { deviceId?: string };

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const conditions = [eq(remindersTable.id, id)];
  if (deviceId) conditions.push(eq(remindersTable.userDeviceId, deviceId));

  const [deleted] = await db
    .delete(remindersTable)
    .where(and(...conditions))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.json({ ...deleted, createdAt: deleted.createdAt.toISOString() });
}));

export default router;
