import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";
import { sourcesTable } from "./sources";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").references(() => sourcesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  docType: text("doc_type").notNull(),
  year: integer("year").notNull(),
  content: text("content"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  pulledAt: timestamp("pulled_at", { withTimezone: true }),
  plainSummary: text("plain_summary"),
  eli12Summary: text("eli12_summary"),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  alertCategory: text("alert_category"),
  redFlagLevel: text("red_flag_level").notNull().default("green"),
  amountInvolved: numeric("amount_involved", { precision: 15, scale: 2 }),
  sourceStatus: text("source_status").notNull().default("pending_review"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
