// The shapes the API sends and the game reads. Shared so both sides agree at compile time.
import type { PreparedMove } from "./gestures/move.ts";
import type { Site } from "./site.ts";

export interface SiteResponse {
  site: Site;
  viewer: { login: string; avatarUrl: string };
  mode: "live" | "demo";
  demoReason: "asked" | "no-github-access" | null;
}

export type ApplyResponse =
  | { ok: true; site: Site }
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

export type ApiError = { error: "github-auth"; hint: string } | { error: "board" | "gesture" | "server"; message: string };

export type { PreparedMove };
