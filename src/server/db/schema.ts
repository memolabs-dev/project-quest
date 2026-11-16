// What the game keeps that GitHub does not. GitHub stays the truth about the project.
import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  githubLogin: text("github_login").notNull().unique(),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every gesture sent to GitHub, and what came of it. */
export const actionLog = pgTable("action_log", {
  id: serial("id").primaryKey(),
  playerLogin: text("player_login").notNull(),
  gesture: text("gesture").notNull(),
  target: text("target").notNull(),
  payload: jsonb("payload").notNull(),
  result: text("result").notNull(),
  githubResponse: jsonb("github_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
