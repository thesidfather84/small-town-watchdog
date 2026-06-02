// Vercel serverless entry point.
// Imports the pre-compiled JS bundle (built by artifacts/api-server/build.mjs).
// @vercel/node never sees the TypeScript source — no compilation issues.
// @ts-ignore — .mjs has no type declarations; types not needed at runtime
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
