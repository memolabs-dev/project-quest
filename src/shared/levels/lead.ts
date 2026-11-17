// The lead's path, rank Site foreman: get an incoming flow under control on the team site (lead's path spec, section 3).
import { parcelOf, PARCELS, SIZES, ZONES } from "./parcels.ts";
import type { Check, Level, Observed, PracticeSnapshot } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const TASK_LIST = /^\s*[-*] \[[ xX]\]/m;

const level = (id: string, check: (o: Observed) => Check): Level => ({ id, rank: "site-foreman", path: "lead", where: "practice", check });

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
