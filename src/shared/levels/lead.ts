// The lead's path, rank Site foreman: get an incoming flow under control on the team site (lead's path spec, section 3).
import { parcelOf, PARCELS, SIZES, ZONES } from "./parcels.ts";
import type { BoardField, Check, Iteration, Level, Observed, PracticeSnapshot, Rank } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const TASK_LIST = /^\s*[-*] \[[ xX]\]/m;

const levelOf = (rank: Rank) => (id: string, check: (o: Observed) => Check): Level => ({ id, rank, path: "lead", where: "practice", check });
const level = levelOf("site-foreman");

/** The team site's issues that are the mayor's parcels, by their hidden marker. */
const parcels = (t: PracticeSnapshot) => t.issues.flatMap((i) => {
  const p = parcelOf(i.body);
  return p ? [{ issue: i, parcel: p }] : [];
});

export const SITE_FOREMAN: Level[] = [
  level("l1-found-team", (o) => {
    const b = o.team?.board;
    const size = b?.fields?.find((f) => f.name === "Size" && f.dataType === "SINGLE_SELECT");
    const zonesOk = JSON.stringify(b?.statusOptions ?? []) === JSON.stringify(ZONES);
    const sizesOk = SIZES.every((s) => size?.options?.some((x) => x.name === s));
    return b && zonesOk && sizesOk ? { done: true, proof: b.url } : NOT_YET;
  }),
  level("l2-sort-parcels", (o) => {
    if (!o.team) return NOT_YET;
    const found = parcels(o.team);
    if (new Set(found.map((f) => f.parcel.key)).size < PARCELS.length) return NOT_YET;
    const dup = found.find((f) => f.parcel.duplicateOf);
    const original = found.find((f) => f.parcel.key === dup?.parcel.duplicateOf)?.issue.number;
    const dupDone = dup && dup.issue.closed && dup.issue.stateReason === "DUPLICATE" && dup.issue.duplicateOf === original;
    const labelled = found.every((f) => f.issue.closed || (f.issue.labels ?? []).length > 0);
    return dupDone && labelled ? { done: true, proof: dup.issue.url } : NOT_YET;
  }),
  level("l3-ready", (o) => {
    const i = o.team?.issues.find((x) => !x.closed && x.status === "Ready" && TASK_LIST.test(x.body ?? ""));
    return i ? { done: true, proof: i.url } : NOT_YET;
  }),
  level("l4-size", (o) => {
    const t = o.team;
    const ready = (t?.issues ?? []).filter((i) => !i.closed && i.status === "Ready");
    return t?.board && ready.length > 0 && ready.every((i) => i.size) ? { done: true, proof: t.board.url } : NOT_YET;
  }),
];

/** Points per size: the game's rule for a sprint's capacity (lead's path spec, section 5), GitHub has none. */
export const SIZE_POINTS: Record<string, number> = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
/** The team board's sprint field, created by the game. */
export const SPRINT_FIELD = "Sprint";

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The iteration running today: from its start date, for its duration in days. */
export function currentIteration(field: BoardField | undefined, today: string): Iteration | null {
  return field?.iterations?.find((i) => i.startDate <= today && today < addDays(i.startDate, i.duration)) ?? null;
}

export const sprintFieldOf = (t: PracticeSnapshot | null | undefined) =>
  t?.board?.fields?.find((f) => f.name === SPRINT_FIELD && f.dataType === "ITERATION");

/** The current sprint's open pallets, their points, and those without a size. */
export function sprintLoad(t: PracticeSnapshot | null | undefined, today: string) {
  const iteration = currentIteration(sprintFieldOf(t), today);
  const pallets = iteration ? (t?.issues ?? []).filter((i) => !i.closed && i.iteration === iteration.id) : [];
  return {
    iteration,
    pallets,
    points: pallets.reduce((n, i) => n + (SIZE_POINTS[i.size ?? ""] ?? 0), 0),
    unsized: pallets.filter((i) => !SIZE_POINTS[i.size ?? ""]).map((i) => i.number),
  };
}

const manager = levelOf("site-manager");

export const SITE_MANAGER: Level[] = [
  manager("l5-sprint", (o) => {
    const load = sprintLoad(o.team, o.today ?? "");
    const fits = o.capacity != null && load.pallets.length > 0 && load.unsized.length === 0 && load.points <= o.capacity;
    return fits && o.team?.board ? { done: true, proof: o.team.board.url } : NOT_YET;
  }),
  manager("l6-milestone", (o) => {
    const m = (o.team?.milestones ?? []).find((x) => !x.closed && x.dueOn && o.team?.issues.some((i) => i.milestone === x.number));
    return m ? { done: true, proof: m.url } : NOT_YET;
  }),
  manager("l7-split", (o) => {
    const i = o.team?.issues.find((x) => (x.subIssues ?? []).length >= 2);
    return i ? { done: true, proof: i.url } : NOT_YET;
  }),
  manager("l8-rope", (o) => {
    const i = o.team?.issues.find((x) => !x.closed && (x.blockedBy ?? []).length > 0);
    return i ? { done: true, proof: i.url } : NOT_YET;
  }),
];
