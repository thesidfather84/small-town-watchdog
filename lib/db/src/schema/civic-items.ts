import { pgTable, text, serial, timestamp, integer, numeric, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";
import { entitiesTable } from "./entities";

export const CIVIC_ITEM_TYPES = [
  "budget", "meeting", "election", "amendment", "audit", "contract",
  "spending", "notice", "tax", "zoning", "resolution", "ordinance",
] as const;

export const ADMIN_REVIEW_STATUSES = [
  "draft", "needs_review", "approved", "rejected", "broken_source",
] as const;

// Geographic scope of an item. Drives location filtering: a county/parish
// selection shows that county's `county_parish` items PLUS the state's
// `statewide` items.
export const CIVIC_ITEM_SCOPES = [
  "statewide", "county_parish", "city", "entity",
] as const;

export const AI_SUMMARY_NOTICE_DEFAULT =
  "AI-generated summary for convenience. Review the original source for complete information.";

export const civicItemsTable = pgTable("civic_items", {
  id: serial("id").primaryKey(),
  contentHash: text("content_hash"),
  locationId: integer("location_id").references(() => locationsTable.id, { onDelete: "set null" }),
  entityId: integer("entity_id").references(() => entitiesTable.id, { onDelete: "set null" }),
  stateCode: text("state_code"),
  countyParish: text("county_parish"),
  scope: text("scope").notNull().default("statewide"),
  itemType: text("item_type").notNull().default("notice"),
  title: text("title").notNull(),
  eventDate: date("event_date"),
  meetingDate: timestamp("meeting_date", { withTimezone: true }),
  electionDate: date("election_date"),
  deadlineDate: date("deadline_date"),
  amountInvolved: numeric("amount_involved", { precision: 15, scale: 2 }),
  voteResult: text("vote_result"),
  sourceTitle: text("source_title"),
  sourceAgency: text("source_agency"),
  sourceUrl: text("source_url"),
  sourceDate: date("source_date"),
  originalText: text("original_text"),
  aiSummary: text("ai_summary"),
  aiSummaryNotice: text("ai_summary_notice").default(AI_SUMMARY_NOTICE_DEFAULT),
  redFlagLevel: text("red_flag_level").notNull().default("green"),
  sourceStatus: text("source_status").notNull().default("pending_review"),
  adminReviewStatus: text("admin_review_status").notNull().default("needs_review"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("civic_items_content_hash_idx").on(table.contentHash),
]);

export const insertCivicItemSchema = createInsertSchema(civicItemsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCivicItem = z.infer<typeof insertCivicItemSchema>;
export type CivicItem = typeof civicItemsTable.$inferSelect;
