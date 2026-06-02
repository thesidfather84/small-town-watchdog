// Vercel serverless entry point — @vercel/node compiles and bundles this.
// app.ts no longer imports pino-http (no worker threads), so bundling works cleanly.
export { default } from "../artifacts/api-server/src/app.js";
