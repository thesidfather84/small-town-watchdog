// Vercel serverless entry point.
// Uses a non-literal dynamic import so esbuild doesn't re-bundle dist/app.mjs.
// includeFiles in vercel.json copies dist/ (including pino workers) into the bundle.
export default async function handler(req: any, res: any) {
  try {
    // Non-literal path prevents esbuild static analysis — loaded from includeFiles at runtime
    const base = "../artifacts/api-server/dist";
    const { default: app } = await import(`${base}/app.mjs`);
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
