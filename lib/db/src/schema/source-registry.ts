import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ENTITY_TYPES = [
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
