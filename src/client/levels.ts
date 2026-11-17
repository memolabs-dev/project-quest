// What the mentor offers next, decided from the levels and the site being played. Pure.
import type { LevelsView } from "../shared/api.ts";
import { LEVELS } from "../shared/levels/index.ts";

/** main: the configured board; demo: the fictitious site (the tutorial); practice: the player's own site; team: the lead's. */
export type SiteKind = "main" | "demo" | "practice" | "team";
export type MentorAction =
  | "to-tutorial" | "to-practice" | "to-main" | "to-team" | "found" | "write" | "take" | "move" | "edit" | "pull" | "merge" | "mayor"
  | "commands" | "found-team" | "parcels";

export function siteKindFromUrl(search: string): SiteKind {
  const q = new URLSearchParams(search);
  // A page marked demo is the demo, whatever else it asks for: nothing is ever sent from it.
  if (q.has("demo")) return "demo";
  const site = q.get("site");
  return site === "practice" || site === "team" ? site : "main";
}

const GESTURES: Record<string, MentorAction> = {
  "a4-found-site": "found", "a5-write-issue": "write", "a6-take-issue": "take", "a7-move-issue": "move",
  "a8-edit-file": "edit", "a9-open-pull": "pull", "a10-answer-review": "edit", "a11-merge": "merge",
};

export function mentorAction(view: LevelsView, kind: SiteKind): MentorAction | null {
  const level = LEVELS.find((l) => l.id === view.current);
  if (!level) return null;
  // The lead plays on their team site; on the cards there, the sorting, ready and size gestures.
  if (level.path === "lead") {
    if (kind !== "team") return "to-team";
    if (level.id === "l1-found-team") return "found-team";
    if (level.id === "l2-sort-parcels" && !view.team.parcels) return "parcels";
    return null;
  }
  if (level.where === "tutorial") return kind === "demo" ? null : "to-tutorial";
  // The real project is the board the game is set up on: there, the player opens a pallet marked for newcomers.
  if (level.where === "real") return kind === "main" ? null : "to-main";
  if (kind !== "practice") return "to-practice";
  if (!view.practice.exists) return "found";
  const p = view.practice;
  const needIssue: MentorAction = p.unassigned === null ? "write" : "take";
  // The Team leader works on their machine: the game offers what it does itself first, then the commands.
  switch (level.id) {
    case "a12-push-branch": return p.issue === null ? needIssue : "commands";
    case "a13-bring-main": return p.mainMoved ? "commands" : "mayor";
    case "a14-fix-from-machine": return p.pull !== null ? "commands" : p.issue === null ? needIssue : "pull";
    case "a15-clean-up": return p.pull === null ? "commands" : "merge";
    default: return GESTURES[level.id] ?? null;
  }
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

/** At the last level, the real site shows no open pallet marked for newcomers: the mentor says so instead of a dead end. */
export const noGoodFirst = (view: LevelsView, pallets: { goodFirst: boolean; closed: boolean }[]) =>
  view.current === "a16-ask-good-first" && !pallets.some((p) => p.goodFirst && !p.closed);

/** Before anything else, a new player says which path they are on; someone already playing keeps the volunteer's. */
export const needsPath = (view: LevelsView) => view.path === null && view.stamps.length === 0;

export type Speaker = "meme" | "mayor" | "inspector";
const SPEAKERS: Record<string, Speaker> = { "l2-sort-parcels": "mayor", "l3-ready": "inspector", "l4-size": "inspector" };
/** Who teaches a level: Mémé by default; the mayor and the inspector on the lead's path (lead's path spec, section 6). */
export const speakerOf = (levelId: string): Speaker => SPEAKERS[levelId] ?? "meme";
