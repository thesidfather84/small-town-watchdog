import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const dbSet = !!process.env.DATABASE_URL;
  const dbHost = process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "not-set";
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, db_set: dbSet, db_host: dbHost }));
}
