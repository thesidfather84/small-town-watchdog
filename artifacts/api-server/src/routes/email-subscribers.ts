import { Router } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, emailSubscribersTable } from "@workspace/db";
import { CreateEmailSubscriberBody, UnsubscribeEmailBody } from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../lib/requireAdmin";

const router = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

router.post("/email-subscribers", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateEmailSubscriberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const email = normalizeEmail(d.email);
  const stateCode = d.stateCode ? d.stateCode.toUpperCase() : null;
  const countyParish = d.countyParish ?? null;
  const signupSource = d.signupSource ?? "home_page";

  // Upsert on the unique email so signing up again refreshes location and
  // re-activates a previously unsubscribed address without creating duplicates.
  await db
    .insert(emailSubscribersTable)
    .values({ email, stateCode, countyParish, signupSource, isActive: true })
    .onConflictDoUpdate({
      target: emailSubscribersTable.email,
      set: { stateCode, countyParish, signupSource, isActive: true, unsubscribedAt: null },
    });

  // Generic response — do not reveal whether the email already existed.
  res.status(201).json({ success: true });
}));

router.post("/email-subscribers/unsubscribe", asyncHandler(async (req, res): Promise<void> => {
  const parsed = UnsubscribeEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  await db
    .update(emailSubscribersTable)
    .set({ isActive: false, unsubscribedAt: new Date() })
    .where(eq(emailSubscribersTable.email, email));

  // Always respond success so the endpoint does not reveal whether an email exists.
  res.json({ success: true });
}));

router.get("/admin/email-subscribers/counts", requireAdmin, asyncHandler(async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      stateCode: emailSubscribersTable.stateCode,
      countyParish: emailSubscribersTable.countyParish,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(emailSubscribersTable)
    .where(and(eq(emailSubscribersTable.isActive, true), isNull(emailSubscribersTable.unsubscribedAt)))
    .groupBy(emailSubscribersTable.stateCode, emailSubscribersTable.countyParish)
    .orderBy(emailSubscribersTable.stateCode, emailSubscribersTable.countyParish);

  res.json(rows);
}));

export default router;
