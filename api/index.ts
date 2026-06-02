// Vercel serverless entry — async handler so dynamic import errors are catchable
export default async function handler(req: any, res: any) {
  try {
    const { default: app } = await import("../artifacts/api-server/src/app");
    await new Promise<void>((resolve, reject) => {
      res.on("finish", resolve);
      res.on("error", reject);
      app(req, res);
    });
  } catch (e: any) {
    const msg = (e?.message ?? String(e)) + "\n" + (e?.stack ?? "");
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ boot_error: msg }));
    }
  }
}
