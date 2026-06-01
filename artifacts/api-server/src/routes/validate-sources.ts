import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

async function checkUrl(url: string): Promise<"valid" | "broken"> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    if (res.ok) return "valid";
    throw new Error(`HEAD ${res.status}`);
  } catch {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
      });
      clearTimeout(timeout);
      return res.ok || res.status === 206 || res.status === 416 ? "valid" : "broken";
    } catch {
      return "broken";
    }
  }
}

router.post("/validate-sources", asyncHandler(async (req, res): Promise<void> => {
  const docs = await db
    .select({ id: documentsTable.id, title: documentsTable.title, sourceUrl: documentsTable.sourceUrl })
    .from(documentsTable);

  let valid = 0, broken = 0, missing = 0;
  const results: Array<{ documentId: number; title: string; sourceUrl: string | null; status: string }> = [];

  for (const doc of docs) {
    const url = doc.sourceUrl?.trim();

    if (!url || !url.startsWith("http")) {
      missing++;
      await db.update(documentsTable).set({ sourceStatus: "missing", lastVerifiedAt: new Date() }).where(eq(documentsTable.id, doc.id));
      results.push({ documentId: doc.id, title: doc.title, sourceUrl: doc.sourceUrl, status: "missing" });
      continue;
    }

    const status = await checkUrl(url);
    if (status === "valid") valid++; else broken++;

    await db.update(documentsTable).set({ sourceStatus: status, lastVerifiedAt: new Date() }).where(eq(documentsTable.id, doc.id));
    results.push({ documentId: doc.id, title: doc.title, sourceUrl: doc.sourceUrl, status });
  }

  res.json({ checked: docs.length, valid, broken, missing, results });
}));

export default router;
