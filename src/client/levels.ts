// What the mentor offers next, decided from the levels and the site being played. Pure.
import type { LevelsView } from "../shared/api.ts";
import { LEVELS } from "../shared/levels/index.ts";

/** main: the configured board; demo: the fictitious site (the tutorial); practice: the player's own site. */
export type SiteKind = "main" | "demo" | "practice";
export type MentorAction = "to-tutorial" | "to-practice" | "found" | "write" | "take" | "move" | "edit" | "pull" | "merge";

export function siteKindFromUrl(search: string): SiteKind {
  const q = new URLSearchParams(search);
  // A page marked demo is the demo, whatever else it asks for: nothing is ever sent from it.
  if (q.has("demo")) return "demo";
  return q.get("site") === "practice" ? "practice" : "main";
}

const GESTURES: Record<string, MentorAction> = {
  "a4-found-site": "found", "a5-write-issue": "write", "a6-take-issue": "take", "a7-move-issue": "move",
  "a8-edit-file": "edit", "a9-open-pull": "pull", "a10-answer-review": "edit", "a11-merge": "merge",
};

export function mentorAction(view: LevelsView, kind: SiteKind): MentorAction | null {
  const level = LEVELS.find((l) => l.id === view.current);
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

/** Answers can arrive out of order: a view with fewer stamps than the one shown is an older answer. */
export function laterView(shown: LevelsView | null, next: LevelsView): LevelsView {
  return shown && next.stamps.length < shown.stamps.length ? shown : next;
}
