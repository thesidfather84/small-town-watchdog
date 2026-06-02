// Vercel serverless entry point.
// Loads pre-compiled CJS bundle. includeFiles in vercel.json copies dist/.
export default async function handler(req: any, res: any) {
  // Debug route — shows what DATABASE_URL the function sees at runtime
  if (req.url?.includes("/_db_check")) {
    const raw = process.env.DATABASE_URL ?? "NOT_SET";
    const host = raw.match(/@([^/]+)\//)?.[1] ?? "parse_failed";
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ db_host: host, db_set: raw !== "NOT_SET" }));
    return;
  }

  try {
    const distDir = "../artifacts/api-server/dist";
    const mod = await import(`${distDir}/app.cjs`);
    const app = mod.default ?? mod;
    await new Promise<void>((resolve, reject) => {
      res.on("finish", resolve);
      res.on("error", reject);
      (app as any)(req, res);
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e) + "\n" + String(e?.stack ?? "");
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ boot_error: msg.slice(0, 2000) }));
    }
  }
}
