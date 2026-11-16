// The shapes the API sends and the game reads. Shared so both sides agree at compile time.
import type { PreparedMove } from "./gestures/move.ts";
import type { PreparedPractice } from "./gestures/practice.ts";
import type { unlocks } from "./levels/progress.ts";
import type { Rank, Stamp } from "./levels/types.ts";
import type { Site } from "./site.ts";

export interface SiteResponse {
  site: Site;
  viewer: { login: string; avatarUrl: string };
  mode: "live" | "demo";
  demoReason: "asked" | "no-github-access" | null;
}

export type ApplyResponse =
  /** site is null when the move landed on GitHub but the site could not be rebuilt; the game reloads it. */
  | { ok: true; site: Site | null }
  | { ok: false; reason: "stale"; current: { status: string | null; updatedAt: string } }
  | { ok: false; reason: "github"; message: string };

export interface LoggedActionView {
  id: number;
  playerLogin: string;
  gesture: string;
  target: string;
  result: "applied" | "stale" | "failed";
  createdAt: string;
}

export type ApiError =
  | { error: "github-auth" | "github-scope"; hint: string }
  | { error: "board" | "gesture" | "server" | "practice-missing"; message: string };

/** Where the player stands in the levels. Only ever the viewer's own. */
export interface LevelsView {
  /** The player these levels belong to. */
  login: string;
  /** False on the demo site: gestures are shown, never sent. */
  canWrite: boolean;
  stamps: Stamp[];
  /** The next level to play, null when every level is stamped. */
  current: string | null;
  rank: Rank | null;
  unlocks: ReturnType<typeof unlocks>;
  practice: { name: string; exists: boolean };
}

export type PracticeApplyResponse =
  | { ok: true; levels: LevelsView }
  | { ok: false; reason: "github"; message: string; applied: string[] };

export type { PreparedMove, PreparedPractice };
