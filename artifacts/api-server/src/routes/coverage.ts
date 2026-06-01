import { Router } from "express";
import { and, eq, ilike } from "drizzle-orm";
import { db, sourceRegistryTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

const KEY_CATEGORIES = ["agenda-page", "minutes-page", "budget-page", "election-page", "audit-page"];

const ALL_ENTITY_TYPES = [
  "city-government",
  "county-government",
  "parish-government",
  "school-board",
  "sheriff-office",
  "police-department",
  "election-office",
  "planning-zoning",
  "special-district",
  "utility-district",
  "drainage-district",
  "fire-district",
];

function computeCoverageLevel(verifiedCategories: Set<string>): string {
  const verifiedKeyCount = KEY_CATEGORIES.filter((c) => verifiedCategories.has(c)).length;

  if (verifiedKeyCount >= 4) return "full";
  if (verifiedCategories.size === 0) return "none";

  const onlyElection =
    verifiedCategories.has("election-page") && verifiedCategories.size === 1;
  if (onlyElection) return "election-only";

  const onlyBudget =
    verifiedCategories.has("budget-page") && verifiedCategories.size === 1;
  if (onlyBudget) return "budget-only";

  return "partial";
}

router.get("/coverage/:state/:city", asyncHandler(async (req, res): Promise<void> => {
  const { state, city } = req.params as { state: string; city: string };

  const sources = await db
    .select()
    .from(sourceRegistryTable)
    .where(
      and(
        eq(sourceRegistryTable.state, state.toUpperCase()),
        ilike(sourceRegistryTable.city, decodeURIComponent(city))
      )
    );

  const verifiedSources = sources.filter((s) => s.verificationStatus === "verified");
  const verifiedCategories = new Set(verifiedSources.map((s) => s.sourceCategory));

  const entityTypeCoverage: Record<string, string> = {};
  for (const entityType of ALL_ENTITY_TYPES) {
    const typeSources = sources.filter((s) => s.entityType === entityType);
    const typeVerified = typeSources.filter((s) => s.verificationStatus === "verified");

    if (typeVerified.length >= 3) entityTypeCoverage[entityType] = "full";
    else if (typeVerified.length > 0) entityTypeCoverage[entityType] = "partial";
    else if (typeSources.length > 0) entityTypeCoverage[entityType] = "pending";
    else entityTypeCoverage[entityType] = "none";
  }

  res.json({
    state: state.toUpperCase(),
    city: decodeURIComponent(city),
    coverageLevel: computeCoverageLevel(verifiedCategories),
    verifiedSourceCount: verifiedSources.length,
    totalSourceCount: sources.length,
    categoriesCovered: Array.from(verifiedCategories),
    entityTypeCoverage,
  });
}));

export default router;
