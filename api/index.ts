// Test: dynamic import of express inside handler (not bundled at module init)
export default async function handler(req: any, res: any) {
  try {
    const { default: express } = await import("express");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, express_type: typeof express }));
  } catch (e: any) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message, stack: e.stack?.slice(0, 500) }));
  }
}
