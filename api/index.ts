/**
 * Vercel serverless entry point for the Small Town Watchdog API.
 * Wraps app startup so any boot error is returned as readable JSON.
 */
import type { IncomingMessage, ServerResponse } from "http";

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let bootError: string | null = null;

try {
  const mod = await import("../artifacts/api-server/src/app.js");
  handler = mod.default as (req: IncomingMessage, res: ServerResponse) => void;
} catch (err: unknown) {
  bootError = err instanceof Error ? err.message + "\n" + err.stack : String(err);
}

export default function (req: IncomingMessage, res: ServerResponse) {
  if (bootError || !handler) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ boot_error: bootError ?? "handler not loaded" }));
    return;
  }
  handler(req, res);
}
