// Vercel serverless entry point — @vercel/node compiles this with esbuild.
// Does NOT call app.listen() — Vercel manages the server lifecycle.
import app from "../artifacts/api-server/src/app";

export default app;
