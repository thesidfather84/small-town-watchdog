import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { civicItemsTable } from "./civic-items";

export const ERROR_REPORT_TYPES = [
  "wrong_info",
  "broken_source",
  "missing_source",
  "biased_language",
  "outdated",
  "other",
] as const;

export const errorReportsTable = pgTable("error_reports", {
  id: serial("id").primaryKey(),
  civicItemId: integer("civic_item_id").references(() => civicItemsTable.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull().default("other"),
  message: text("message"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertErrorReportSchema = createInsertSchema(errorReportsTable).omit({ id: true, createdAt: true });
export type InsertErrorReport = z.infer<typeof insertErrorReportSchema>;
export type ErrorReport = typeof errorReportsTable.$inferSelect;
