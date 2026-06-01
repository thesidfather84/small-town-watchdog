import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { civicItemsTable } from "./civic-items";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userDeviceId: text("user_device_id").notNull(),
  civicItemId: integer("civic_item_id").references(() => civicItemsTable.id, { onDelete: "cascade" }),
  reminderType: text("reminder_type").notNull().default("general"),
  remindEarlyVoting: boolean("remind_early_voting").notNull().default(false),
  remindDayBefore: boolean("remind_day_before").notNull().default(false),
  remindTwoHoursBefore: boolean("remind_two_hours_before").notNull().default(false),
  remindPollClosing: boolean("remind_poll_closing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({ id: true, createdAt: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;
