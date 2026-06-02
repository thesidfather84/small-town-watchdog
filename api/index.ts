// Isolation test: express + DB only, no routes
import express from "express";
import { db, civicItemsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = express();

app.use("/api/diagnostics", async (_req: any, res: any) => {
  try {
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(civicItemsTable);
    res.json({ ok: true, count: Number(r.count) });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use("/api/healthz", (_req: any, res: any) => {
  res.json({ ok: true, db_set: !!process.env.DATABASE_URL });
});

export default app;
