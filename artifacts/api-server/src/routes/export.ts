import { Router } from "express";
import { desc } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db, scraperRunsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../lib/requireAdmin";

const router = Router();

// Walk up from the process cwd to find the workspace root (where
// pnpm-workspace.yaml lives) so file exports work regardless of where the
// server process was started from.
async function findRepoRoot(): Promise<string> {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    try {
      await fs.access(path.join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return process.cwd();
}

// Never include anything that could carry a secret.
const SECRET_PATTERNS = [
  /\.env/i, /\.key$/i, /\.pem$/i, /\.p12$/i, /\.pfx$/i,
  /secret/i, /credential/i, /\.crt$/i, /id_rsa/i,
];
function isSecretFile(name: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(name));
}

const SKIP_DIRS = new Set(["__pycache__", "node_modules", ".git", "dist", ".turbo"]);

async function collectDir(
  root: string,
  relDir: string,
  out: Record<string, string>
): Promise<void> {
  const abs = path.join(root, relDir);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.endsWith(".pyc") || isSecretFile(e.name)) {
      continue;
    }
    const childRel = `${relDir}/${e.name}`;
    if (e.isDirectory()) {
      await collectDir(root, childRel, out);
    } else {
      try {
        out[childRel] = await fs.readFile(path.join(root, childRel), "utf8");
      } catch {
        /* skip unreadable/binary file */
      }
    }
  }
}

function buildAppConfig(pkg: Record<string, unknown>): Record<string, unknown> {
  return {
    app_name: "Small Town Watchdog",
    version: typeof pkg.version === "string" ? pkg.version : "unknown",
    node_version: process.version,
    node_env: process.env.NODE_ENV ?? "unknown",
    generated_at: new Date().toISOString(),
    database_configured: Boolean(process.env.DATABASE_URL),
    note: "Contains no secrets, keys, or credentials. Boolean flags indicate configuration presence only.",
  };
}

// Pipeline runs (scraper_runs) for the export bundle / diagnostics.
router.get(
  "/admin/scraper-runs",
  requireAdmin,
  asyncHandler(async (_req, res): Promise<void> => {
    const runs = await db
      .select()
      .from(scraperRunsTable)
      .orderBy(desc(scraperRunsTable.finishedAt))
      .limit(200);
    res.json(
      runs.map((r) => ({
        ...r,
        startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
        finishedAt: r.finishedAt instanceof Date ? r.finishedAt.toISOString() : r.finishedAt,
      }))
    );
  })
);

// Server-side source files for the support export. `sets` selects which
// bundles to include: package, config, schema, python_engine.
router.get(
  "/admin/export/files",
  requireAdmin,
  asyncHandler(async (req, res): Promise<void> => {
    const setsParam =
      typeof req.query.sets === "string" && req.query.sets.trim()
        ? req.query.sets
        : "package,config,schema,python_engine";
    const sets = new Set(setsParam.split(",").map((s) => s.trim()).filter(Boolean));

    const root = await findRepoRoot();
    const files: Record<string, string> = {};

    let pkg: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(path.join(root, "package.json"), "utf8");
      pkg = JSON.parse(raw) as Record<string, unknown>;
      if (sets.has("package")) files["package.json"] = raw;
    } catch {
      /* no root package.json */
    }

    if (sets.has("config")) {
      files["app_config.json"] = JSON.stringify(buildAppConfig(pkg), null, 2);
    }
    if (sets.has("schema")) {
      await collectDir(root, "lib/db/src/schema", files);
    }
    if (sets.has("python_engine")) {
      await collectDir(root, "python_engine", files);
    }

    res.json({ files });
  })
);

export default router;
