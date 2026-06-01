import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sourceSubmissionsTable = pgTable("source_submissions", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  county: text("county"),
  city: text("city").notNull(),
  entityName: text("entity_name").notNull(),
  entityType: text("entity_type").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceCategory: text("source_category").notNull(),
  submitterNote: text("submitter_note"),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSourceSubmissionSchema = createInsertSchema(sourceSubmissionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertSourceSubmission = z.infer<typeof insertSourceSubmissionSchema>;
export type SourceSubmission = typeof sourceSubmissionsTable.$inferSelect;
