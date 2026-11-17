// What the game keeps that GitHub does not. GitHub stays the truth about the project.
import { integer, jsonb, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  githubLogin: text("github_login").notNull().unique(),
  language: text("language").notNull().default("en"),
  /** The practice repository the player founded in their own account (levels). */
  practiceRepo: text("practice_repo"),
  /** The path the player chose: "volunteer" or "lead". */
  path: text("path"),
  /** The points a sprint can carry, declared by the lead: the game's rule, GitHub has none. */
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One stamp per level and player, with its proof on GitHub (or "tutorial"). Logins are stored lower-case. */
export const progress = pgTable("progress", {
  playerLogin: text("player_login").notNull(),
  levelId: text("level_id").notNull(),
  proof: text("proof").notNull(),
  stampedAt: timestamp("stamped_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerLogin, t.levelId] })]);

/** What the player did on the tutorial site; nothing there is sent to GitHub. */
export const tutorialEvents = pgTable("tutorial_events", {
  playerLogin: text("player_login").notNull(),
  event: text("event").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerLogin, t.event] })]);

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
