import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { civicItemsTable } from "./civic-items";

export const FLAG_REASONS = [
  "inaccurate", "outdated", "broken_link", "inappropriate", "other",
] as const;

export const FLAG_STATUSES = [
  "open", "resolved", "dismissed",
] as const;

export const civicItemFlagsTable = pgTable("civic_item_flags", {
  id: serial("id").primaryKey(),
  civicItemId: integer("civic_item_id").notNull().references(() => civicItemsTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull().default("other"),
  notes: text("notes"),
  flaggedBy: text("flagged_by"),
  ipHash: text("ip_hash"),
  status: text("status").notNull().default("open"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCivicItemFlagSchema = createInsertSchema(civicItemFlagsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCivicItemFlag = z.infer<typeof insertCivicItemFlagSchema>;
export type CivicItemFlag = typeof civicItemFlagsTable.$inferSelect;
