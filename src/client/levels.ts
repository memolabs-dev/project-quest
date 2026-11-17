// What the mentor offers next, decided from the levels and the site being played. Pure.
import type { LevelsView } from "../shared/api.ts";
import type { PreparedPractice } from "../shared/gestures/practice.ts";
import type { PreparedAsk } from "../shared/gestures/real.ts";
import type { PreparedTeam, TeamKind } from "../shared/gestures/team.ts";
import { LEVELS } from "../shared/levels/index.ts";

/** main: the configured board; demo: the fictitious site (the tutorial); practice: the player's own site; team: the lead's. */
export type SiteKind = "main" | "demo" | "practice" | "team";
export type MentorAction =
  | "to-tutorial" | "to-practice" | "to-main" | "to-team" | "found" | "write" | "take" | "move" | "edit" | "pull" | "merge" | "mayor"
  | "commands" | "found-team" | "parcels" | "sprint-field" | "capacity" | "milestone"
  | "bulletin" | "wip-limit" | "team-day" | "visit";

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
    // A sprint needs a week running, then the capacity the team can carry; the loading is on the cards.
    if (level.id === "l5-sprint") return !view.team.sprint.current ? "sprint-field" : view.team.sprint.capacity === null ? "capacity" : null;
    if (level.id === "l6-milestone") return "milestone";
    if (level.id === "l9-bulletin") return "bulletin";
    // The limit first, then the team's day pushes it over; bringing it back under is done on the cards' moves.
    if (level.id === "l10-wip") return view.team.wip.limit === null ? "wip-limit" : !view.team.teamDay ? "team-day" : null;
    if (level.id === "l11-visit") return view.team.milestones.length > 0 ? "visit" : null;
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

export type Speaker = "meme" | "mayor" | "inspector" | "crane" | "radio";
const SPEAKERS: Record<string, Speaker> = {
  "l2-sort-parcels": "mayor", "l3-ready": "inspector", "l4-size": "inspector",
  "l6-milestone": "mayor", "l7-split": "crane", "l8-rope": "crane", "l9-bulletin": "radio", "l11-visit": "mayor",
};
/** Who teaches a level: Mémé by default; the mayor, the inspector and Gérard on the lead's path (lead's path spec, section 6). */
export const speakerOf = (levelId: string): Speaker => SPEAKERS[levelId] ?? "meme";

/** The parcels exist but GitHub has not listed them on the board yet (seen in the real run: about a minute). */
export const boardCatchingUp = (view: LevelsView, kind: SiteKind, pallets: number) =>
  kind === "team" && view.team.parcels && pallets === 0;

/** The skill book offers to follow a path the player is not on. */
export const canFollow = (view: LevelsView, path: "volunteer" | "lead") => (view.path ?? "volunteer") !== path;

/** The gestures an open pallet's card offers the lead, for the level being played. */
export function cardGestures(view: LevelsView, pallet: number): TeamKind[] {
  switch (view.current) {
    case "l2-sort-parcels": return ["label", "duplicate"];
    case "l3-ready": return ["checklist"];
    case "l4-size": return ["size"];
    case "l5-sprint": return !view.team.sprint.current ? [] : view.team.sprint.loaded.includes(pallet) ? ["unload"] : ["load"];
    case "l6-milestone": return view.team.milestones.length > 0 ? ["attach"] : [];
    case "l7-split": return ["split"];
    case "l8-rope": return ["rope"];
    case "l11-visit": return view.team.visitJobs.includes(pallet) ? ["finish"] : [];
    default: return [];
  }
}

/** The Site manager's rewards on the team site: the sprint truck while a sprint runs, the mayor's ribbon on her next visit. */
export function teamRewards(view: LevelsView, kind: SiteKind) {
  const s = view.team.sprint;
  const next = view.team.milestones.filter((m) => m.dueOn).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];
  return {
    truck: kind === "team" && s.current ? { title: s.current, points: s.points, capacity: s.capacity } : null,
    ribbon: kind === "team" && next ? { title: next.title, dueOn: next.dueOn!.slice(0, 10) } : null,
    // The Project director's reward: the radio mast broadcasts the last bulletin's status and first line.
    mast: kind === "team" && view.team.bulletin
      ? { status: view.team.bulletin.status, line: view.team.bulletin.body.split("\n")[0] } : null,
  };
}

/** While the sprint is planned, the lead can change the capacity they declared: a mistaken 1 must never lock the level. */
export const capacityEditable = (view: LevelsView) => view.current === "l5-sprint" && view.team.sprint.current !== null;

/** Until the team's day, the lead can change the limit they wrote: one too high would leave the team's day impossible. */
export const limitEditable = (view: LevelsView) => view.current === "l10-wip" && view.team.wip.limit !== null && !view.team.teamDay;

/** At the mayor's visit with no open milestone (closed on GitHub, jobs still open): the mayor says what to do. */
export const noOpenVisit = (view: LevelsView) => view.current === "l11-visit" && view.team.milestones.length === 0;

/** The site radio's draft of the evening bulletin, from the board as the game sees it, in the player's language. */
export function radioDraft(view: LevelsView, today: string, say: (key: string, o?: Record<string, unknown>) => string): string {
  const t = view.team;
  const lines = [say("radio.title", { date: today })];
  if (t.sprint.current) lines.push(say("radio.sprint", { sprint: t.sprint.current, points: t.sprint.points, capacity: t.sprint.capacity ?? "?" }));
  if (t.wip.limit !== null) lines.push(say("radio.wip", { count: t.wip.count, limit: t.wip.limit }));
  const visit = t.milestones.filter((m) => m.dueOn).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];
  if (visit) {
    lines.push(say("radio.visit", { title: visit.title, date: visit.dueOn!.slice(0, 10), done: visit.closedIssues, total: visit.openIssues + visit.closedIssues }));
  }
  return lines.join("\n");
}

/** Each request of a gesture as it goes to GitHub: a GraphQL mutation, or a REST path where GraphQL has none. */
export function requestsOf(p: PreparedPractice | PreparedAsk | PreparedTeam): string[] {
  const repo = p.kind === "found" ? `${p.owner}/${p.name}` : p.repo;
  return p.mutations.map((m) => {
    const input = m.input as { path?: string; number?: number };
    if (m.name === "createOrUpdateFileContents") return `PUT /repos/${repo}/contents/${input.path}`;
    if (m.name === "createMilestone") return `POST /repos/${repo}/milestones`;
    if (m.name === "updateMilestone") return `PATCH /repos/${repo}/milestones/${input.number}`;
    return `POST /graphql  mutation ${m.name}`;
  });
}
