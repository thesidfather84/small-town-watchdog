import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, documentsTable, entitiesTable } from "@workspace/db";
import { CompareYearsQueryParams } from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/compare", asyncHandler(async (req, res): Promise<void> => {
  const queryParams = CompareYearsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { entityId, year1, year2 } = queryParams.data;

  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId));
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const year1Docs = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.entityId, entityId), eq(documentsTable.year, year1)));

  const year2Docs = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.entityId, entityId), eq(documentsTable.year, year2)));

  const year1Map = new Map<string, number>();
  const year2Map = new Map<string, number>();

  for (const doc of year1Docs) {
    const existing = year1Map.get(doc.docType) ?? 0;
    year1Map.set(doc.docType, existing + Number(doc.amountInvolved ?? 0));
  }
  for (const doc of year2Docs) {
    const existing = year2Map.get(doc.docType) ?? 0;
    year2Map.set(doc.docType, existing + Number(doc.amountInvolved ?? 0));
  }

  const allTypes = new Set([...year1Map.keys(), ...year2Map.keys()]);

  const changes = Array.from(allTypes).map((docType) => {
    const v1 = year1Map.get(docType) ?? null;
    const v2 = year2Map.get(docType) ?? null;

    let changePercent: number | null = null;
    let changeDescription: string | null = null;
    let redFlagLevel = "green";

    if (v1 != null && v2 != null && v1 > 0) {
      changePercent = ((v2 - v1) / v1) * 100;
      const diff = v2 - v1;
      const sign = diff >= 0 ? "up" : "down";
      changeDescription = `${docType} spending went ${sign} by $${Math.abs(diff).toLocaleString()}, about ${Math.abs(changePercent).toFixed(1)}% ${sign === "up" ? "more" : "less"} than ${year1}.`;

      if (changePercent >= 25) redFlagLevel = "red";
      else if (changePercent >= 10) redFlagLevel = "yellow";
    } else if (v1 == null && v2 != null) {
      changeDescription = `New ${docType} records added in ${year2}.`;
      redFlagLevel = "yellow";
    } else if (v1 != null && v2 == null) {
      changeDescription = `No ${docType} records found in ${year2}.`;
    }

    return {
      category: docType,
      label: capitalize(docType),
      year1Value: v1,
      year2Value: v2,
      changePercent,
      changeDescription,
      redFlagLevel,
    };
  });

  const docCountChangePct =
    year1Docs.length > 0
      ? ((year2Docs.length - year1Docs.length) / year1Docs.length) * 100
      : null;

  const countChange = {
    category: "total-documents",
    label: "Total Documents",
    year1Value: year1Docs.length,
    year2Value: year2Docs.length,
    changePercent: docCountChangePct,
    changeDescription:
      docCountChangePct != null
        ? `Total records went from ${year1Docs.length} in ${year1} to ${year2Docs.length} in ${year2}.`
        : `No records in ${year1} to compare against.`,
    redFlagLevel:
      docCountChangePct != null && docCountChangePct >= 25
        ? "red"
        : docCountChangePct != null && docCountChangePct >= 10
          ? "yellow"
          : "green",
  };

  const allChanges = [countChange, ...changes];

  const redFlags = allChanges.filter((c) => c.redFlagLevel === "red").length;
  const aiSummary =
    redFlags > 0
      ? `Comparing ${year1} to ${year2} for ${entity.name}: ${redFlags} possible red flag${redFlags > 1 ? "s" : ""} detected. ${allChanges
          .filter((c) => c.changeDescription)
          .map((c) => c.changeDescription)
          .join(" ")}`
      : `Comparing ${year1} to ${year2} for ${entity.name}: No major red flags found. ${allChanges
          .filter((c) => c.changeDescription)
          .map((c) => c.changeDescription)
          .join(" ")}`;

  res.json({
    entityId: entity.id,
    entityName: entity.name,
    year1,
    year2,
    changes: allChanges,
    aiSummary,
    year1DocumentCount: year1Docs.length,
    year2DocumentCount: year2Docs.length,
  });
}));

router.get("/multi-year-timeline", asyncHandler(async (req, res): Promise<void> => {
  const entityId = parseInt(String(req.query.entityId), 10);
  if (!entityId || isNaN(entityId)) {
    res.status(400).json({ error: "entityId is required" });
    return;
  }

  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId));
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const currentYear = new Date().getFullYear();
  const START_YEAR = 2023;
  const yearRange: number[] = [];
  for (let y = START_YEAR; y <= currentYear; y++) yearRange.push(y);

  const allDocs = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.entityId, entityId), inArray(documentsTable.year, yearRange)));

  const docsByYear = new Map<number, typeof allDocs>();
  for (const y of yearRange) docsByYear.set(y, []);
  for (const doc of allDocs) {
    const list = docsByYear.get(doc.year) ?? [];
    list.push(doc);
    docsByYear.set(doc.year, list);
  }

  const years = yearRange.map((year) => {
    const docs = docsByYear.get(year) ?? [];
    const totalAmount = docs.reduce((sum, d) => sum + (d.amountInvolved ? Number(d.amountInvolved) : 0), 0) || null;
    return {
      year,
      documentCount: docs.length,
      hasData: docs.length > 0,
      totalAmount: totalAmount && totalAmount > 0 ? totalAmount : null,
      brokenSourceCount: docs.filter((d) => d.sourceStatus === "broken").length,
      missingSourceCount: docs.filter((d) => d.sourceStatus === "missing").length,
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        docType: d.docType,
        amountInvolved: d.amountInvolved != null ? Number(d.amountInvolved) : null,
        sourceStatus: d.sourceStatus ?? "pending_review",
        sourceUrl: d.sourceUrl ?? null,
      })),
    };
  });

  res.json({ entityId: entity.id, entityName: entity.name, years });
}));

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default router;
