import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = express();

// Simple request logger — no worker threads required
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({ method: req.method, url: req.url?.split("?")[0], status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, _req: any, res: any, _next: any) => {
  logger.error(err, "Unhandled route error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
