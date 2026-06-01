import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailSubscribersTable = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  stateCode: text("state_code"),
  countyParish: text("county_parish"),
  signupSource: text("signup_source").notNull().default("home_page"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
});

export const insertEmailSubscriberSchema = createInsertSchema(emailSubscribersTable).omit({
  id: true, isActive: true, createdAt: true, unsubscribedAt: true,
});
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;
export type EmailSubscriber = typeof emailSubscribersTable.$inferSelect;
