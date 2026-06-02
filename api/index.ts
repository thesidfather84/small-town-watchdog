// Vercel serverless entry point.
// Imports the pre-compiled bundle (built by artifacts/api-server/build.mjs via buildCommand).
// All npm deps including express are compiled into dist/app.mjs — no external resolution needed.
// @ts-ignore — .mjs has no type declarations
import app from "../artifacts/api-server/dist/app.mjs";
export default app;
