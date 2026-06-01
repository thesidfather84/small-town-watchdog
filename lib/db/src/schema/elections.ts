import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const electionsTable = pgTable("elections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  electionDate: date("election_date").notNull(),
  earlyVotingStart: date("early_voting_start"),
  earlyVotingEnd: date("early_voting_end"),
  description: text("description"),
  entityId: integer("entity_id"),
  electionType: text("election_type").notNull().default("general"),
  electionState: text("election_state").notNull().default("upcoming"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ballotItemsTable = pgTable("ballot_items", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull(),
  title: text("title").notNull(),
  itemType: text("item_type").notNull().default("amendment"),
  description: text("description"),
  officialText: text("official_text"),
  yesMeans: text("yes_means"),
  noMeans: text("no_means"),
  whoPays: text("who_pays"),
  amountInvolved: text("amount_involved"),
  duration: text("duration"),
  receivingBody: text("receiving_body"),
  changeType: text("change_type"),
  sourceUrl: text("source_url"),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertElectionSchema = createInsertSchema(electionsTable);
export const selectElectionSchema = createSelectSchema(electionsTable);

export const insertBallotItemSchema = createInsertSchema(ballotItemsTable);
export const selectBallotItemSchema = createSelectSchema(ballotItemsTable);

export type Election = typeof electionsTable.$inferSelect;
export type NewElection = typeof electionsTable.$inferInsert;
export type BallotItem = typeof ballotItemsTable.$inferSelect;
export type NewBallotItem = typeof ballotItemsTable.$inferInsert;
