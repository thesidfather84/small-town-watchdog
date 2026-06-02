// Isolation test: bare express only, no DB
import express from "express";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = express();
app.use("/api/healthz", (_req: any, res: any) => res.json({ ok: true, step: "express-only" }));
export default app;
