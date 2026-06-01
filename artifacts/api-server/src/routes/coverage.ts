import { Router } from "express";
import { and, eq, ilike, or, isNull } from "drizzle-orm";
import { db, sourceRegistryTable } from "@workspace/db";
import { getLocationChecklist } from "@workspace/db/taxonomy";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

/**
 * GET /coverage
 * Query params: state (required), county (required)
 *
 * Returns the full taxonomy checklist for the location, showing which entity
 * types are covered, partially covered, pending, or missing entirely.
 */
router.get("/coverage", asyncHandler(async (req, res): Promise<void> => {
  const state  = typeof req.query.state  === "string" ? req.query.state.toUpperCase().trim()  : "";
  const county = typeof req.query.county === "string" ? req.query.county.trim()               : "";

  if (!state || !county) {
    res.status(400).json({ error: "state and county query params are required" });
    return;
  }

  const countyType = county.toLowerCase().includes("parish") ? "parish" : "county";
  const checklist  = getLocationChecklist(state, county, countyType as "parish" | "county");

  // Fetch all source_registry rows for this location
  const sources = await db
    .select()
    .from(sourceRegistryTable)
    .where(
      and(
        eq(sourceRegistryTable.state, state),
        or(
          ilike(sourceRegistryTable.county, county),
          isNull(sourceRegistryTable.county),
        )
      )
    );

  // Build coverage map: entityType → { total, verified, pending, broken }
  type CoverageEntry = { total: number; verified: number; pending: number; broken: number; sourceIds: number[] };
  const coverageMap = new Map<string, CoverageEntry>();

  for (const src of sources) {
    const key = src.entityType;
    if (!coverageMap.has(key)) {
      coverageMap.set(key, { total: 0, verified: 0, pending: 0, broken: 0, sourceIds: [] });
    }
    const entry = coverageMap.get(key)!;
    entry.total++;
    entry.sourceIds.push(src.id);
    if (src.verificationStatus === "verified")  entry.verified++;
    if (src.verificationStatus === "pending")   entry.pending++;
    if (src.verificationStatus === "broken")    entry.broken++;
  }

  // Build the per-entity coverage result
  const entityCoverage = checklist.expectedEntities.map((spec) => {
    const c = coverageMap.get(spec.key);
    let status: "covered" | "partial" | "pending" | "missing";
    if (!c || c.total === 0)        status = "missing";
    else if (c.verified >= 2)       status = "covered";
    else if (c.verified === 1)      status = "partial";
    else                            status = "pending";

    return {
      key:         spec.key,
      displayName: spec.displayName,
      level:       spec.level,
      priority:    spec.priority,
      status,
      recordTypes: spec.recordTypes,
      sourceCount: c?.total    ?? 0,
      verifiedCount: c?.verified ?? 0,
      pendingCount:  c?.pending  ?? 0,
      brokenCount:   c?.broken   ?? 0,
    };
  });

  // Summary stats
  const totalExpected = checklist.totalExpected;
  const covered  = entityCoverage.filter((e) => e.status === "covered").length;
  const partial  = entityCoverage.filter((e) => e.status === "partial").length;
  const pending  = entityCoverage.filter((e) => e.status === "pending").length;
  const missing  = entityCoverage.filter((e) => e.status === "missing").length;

  const missingP1 = entityCoverage.filter((e) => e.status === "missing" && e.priority === 1);
  const missingP2 = entityCoverage.filter((e) => e.status === "missing" && e.priority === 2);

  const coveragePct = Math.round(((covered + partial) / totalExpected) * 100);

  // Coverage level descriptor
  let coverageLevel: string;
  if (coveragePct >= 80)       coverageLevel = "full";
  else if (coveragePct >= 40)  coverageLevel = "partial";
  else if (missingP1.length === 0) coverageLevel = "partial";
  else                             coverageLevel = "none";

  res.json({
    state,
    county,
    countyType,
    coverageLevel,
    coveragePct,
    totalExpected,
    covered,
    partial,
    pending,
    missing,
    missingEssential: missingP1.length,
    missingImportant: missingP2.length,
    entityCoverage,
    missingEssentialList: missingP1.map((e) => ({ key: e.key, displayName: e.displayName })),
  });
}));

/**
 * Legacy route kept for backwards compatibility.
 * GET /coverage/:state/:city
 */
router.get("/coverage/:state/:city", asyncHandler(async (req, res): Promise<void> => {
  const { state, city } = req.params as { state: string; city: string };
  res.redirect(`/coverage?state=${encodeURIComponent(state)}&county=${encodeURIComponent(decodeURIComponent(city))}`);
}));

export default router;
