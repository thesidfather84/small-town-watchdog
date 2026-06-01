import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const SCRAPER_RUN_STATUSES = [
  "running", "completed", "failed",
] as const;

export const scraperRunsTable = pgTable("scraper_runs", {
  id: serial("id").primaryKey(),
  command: text("command").notNull().default("run-daily"),
  state: text("state"),
  status: text("status").notNull().default("completed"),
  sourcesChecked: integer("sources_checked").notNull().default(0),
  sourcesValid: integer("sources_valid").notNull().default(0),
  sourcesBroken: integer("sources_broken").notNull().default(0),
  itemsCreated: integer("items_created").notNull().default(0),
  itemsUpdated: integer("items_updated").notNull().default(0),
  itemsAutoApproved: integer("items_auto_approved").notNull().default(0),
  itemsPending: integer("items_pending").notNull().default(0),
  itemsDuplicateSkipped: integer("items_duplicate_skipped").notNull().default(0),
  itemsValidationFailed: integer("items_validation_failed").notNull().default(0),
  errors: text("errors"),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScraperRunSchema = createInsertSchema(scraperRunsTable).omit({
  id: true,
});
export type InsertScraperRun = z.infer<typeof insertScraperRunSchema>;
export type ScraperRun = typeof scraperRunsTable.$inferSelect;
