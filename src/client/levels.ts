// What the mentor offers next, decided from the levels and the site being played. Pure.
import type { LevelsView } from "../shared/api.ts";
import { APPRENTICE } from "../shared/levels/apprentice.ts";

/** main: the configured board; demo: the fictitious site (the tutorial); practice: the player's own site. */
export type SiteKind = "main" | "demo" | "practice";
export type MentorAction = "to-tutorial" | "to-practice" | "found" | "write" | "take" | "move";

export function siteKindFromUrl(search: string): SiteKind {
  const q = new URLSearchParams(search);
  if (q.get("site") === "practice") return "practice";
  return q.has("demo") ? "demo" : "main";
}

const GESTURES: Record<string, MentorAction> = { "a4-found-site": "found", "a5-write-issue": "write", "a6-take-issue": "take", "a7-move-issue": "move" };

export function mentorAction(view: LevelsView, kind: SiteKind): MentorAction | null {
  const level = APPRENTICE.find((l) => l.id === view.current);
  if (!level) return null;
  if (level.where === "tutorial") return kind === "demo" ? null : "to-tutorial";
  if (kind !== "practice") return "to-practice";
  return view.practice.exists ? GESTURES[level.id] ?? null : "found";
}

/** Levels stamped since the previous view, in the order they were passed. */
export function newStamps(before: LevelsView | null, after: LevelsView): string[] {
  if (!before) return [];
  const had = new Set(before.stamps.map((s) => s.levelId));
  return after.stamps.map((s) => s.levelId).filter((id) => !had.has(id));
}
