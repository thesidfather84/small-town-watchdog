// Vercel serverless entry point.
// Loads the pre-compiled CJS bundle — require() can load .cjs files.
// includeFiles in vercel.json copies dist/ into the function bundle.
export default async function handler(req: any, res: any) {
  try {
    const base = "../artifacts/api-server/dist";
    const mod = await import(`${base}/app.cjs`);
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
