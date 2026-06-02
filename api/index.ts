/* eslint-disable */
// Vercel serverless entry point — compiled by @vercel/node (esbuild + node runtime)
export default function handler(req: any, res: any) {
  const dbSet = !!process.env.DATABASE_URL;
  const dbHost = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)?.[1] ?? "not-set";
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, db_set: dbSet, db_host: dbHost }));
}
