import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const COUNTY_TYPES = ["parish", "county", "borough", "independent city"] as const;
export const COVERAGE_STATUSES = ["full", "partial", "election-only", "budget-only", "none"] as const;

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  stateCode: text("state_code").notNull(),
  stateName: text("state_name").notNull(),
  countyParish: text("county_parish").notNull(),
  countyType: text("county_type").notNull().default("parish"),
  isActive: boolean("is_active").notNull().default(true),
  coverageStatus: text("coverage_status").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;
