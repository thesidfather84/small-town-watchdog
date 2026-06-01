/**
 * Vercel serverless entry point for the Small Town Watchdog API.
 *
 * Imports the Express app from source (Vercel's @vercel/node runtime
 * handles TypeScript + workspace package resolution automatically).
 * Does NOT call app.listen() — Vercel manages the server lifecycle.
 *
 * All /api/* requests are routed here by vercel.json rewrites.
 */
export { default } from "../artifacts/api-server/src/app";
