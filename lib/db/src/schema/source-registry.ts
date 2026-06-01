import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Entity types — aligned with lib/db/src/entity-taxonomy.ts
// The DB column is plain text; this list is for validation and documentation only.
export const ENTITY_TYPES = [
  // State level
  "secretary-of-state",
  "state-elections-office",
  "state-legislature",
  "governor-office",
  "attorney-general",
  "state-auditor",
  "state-treasurer",
  "ethics-commission",
  "campaign-finance",
  "dept-revenue",
  "dept-transportation",
  "dept-education",
  "dept-health",
  "environmental-quality",
  "state-police",
  // County / Parish level
  "county-government",
  "parish-government",       // alias kept for backwards compat
  "county-council",
  "clerk-of-court",
  "registrar-of-voters",
  "election-office",         // alias kept for backwards compat
  "sheriff-office",
  "district-attorney",
  "tax-assessor",
  "tax-collector",
  "county-treasurer",
  "public-works",
  "planning-zoning",
  "permits-inspections",
  "code-enforcement",
  "emergency-management",
  "coroner",
  "animal-control",
  "parish-jail",
  // City / Municipal level
  "city-government",
  "city-council",
  "city-clerk",
  "police-department",
  "fire-department",
  "city-public-works",
  "city-planning-zoning",
  "city-permits",
  "city-code-enforcement",
  "municipal-court",
  "city-finance",
  // School / Education
  "school-board",
  "school-district",
  "superintendent-office",
  // Special Districts
  "fire-district",
  "water-district",
  "sewer-district",
  "drainage-district",
  "levee-district",
  "recreation-district",
  "library-board",
  "hospital-district",
  "port-authority",
  "airport-authority",
  "transit-authority",
  "mosquito-abatement",
  "housing-authority",
  "utility-district",
  "special-district",        // generic fallback
  // Courts
  "district-court",
  "justice-of-peace",
  "constable",
] as const;

export const SOURCE_CATEGORIES = [
  "agenda-page",
  "minutes-page",
  "budget-page",
  "audit-page",
  "election-page",
  "public-notice-page",
  "contract-page",
  "bid-page",
  "news-page",
  "report-page",
  "financial-page",
  "planning-page",
  "permit-page",
] as const;

export const SOURCE_PLATFORMS = [
  "Granicus",
  "CivicPlus",
  "Legistar",
  "GovOS",
  "Custom Website",
  "PDF Repository",
  "Other",
] as const;

export const VERIFICATION_STATUSES = [
  "verified",
  "pending",
  "inactive",
  "broken",
] as const;

export const COVERAGE_LEVELS = [
  "full",
  "partial",
  "election-only",
  "budget-only",
  "none",
] as const;

export const sourceRegistryTable = pgTable("source_registry", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  county: text("county"),
  city: text("city"),
  entityName: text("entity_name").notNull(),
  entityType: text("entity_type").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceCategory: text("source_category").notNull(),
  sourcePlatform: text("source_platform").notNull().default("Other"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  lastSuccessfulUpdate: timestamp("last_successful_update", { withTimezone: true }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSourceRegistrySchema = createInsertSchema(sourceRegistryTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertSourceRegistry = z.infer<typeof insertSourceRegistrySchema>;
export type SourceRegistry = typeof sourceRegistryTable.$inferSelect;
