// The Journeyman rank: a first contribution on the practice site, without a terminal.
import type { Check, Level, Observed, PracticePull } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The viewer's pull requests that close an issue, newest first (as read). */
const mine = (o: Observed): PracticePull[] =>
  (o.practice?.pulls ?? []).filter((p) => same(p.author, o.viewer) && p.closes.length > 0);

const level = (id: string, check: (o: Observed) => Check): Level => ({ id, rank: "journeyman", path: "volunteer", where: "practice", check });

export const JOURNEYMAN: Level[] = [
  level("a8-edit-file", (o) => {
    // A practice branch with a commit of the viewer's beyond the default branch: a real edit, not just a branch.
    const b = (o.practice?.branches ?? []).find((x) =>
      /^practice-\d+$/.test(x.name) && same(x.author, o.viewer) && x.oid !== o.practice?.defaultBranch?.oid);
    return b ? { done: true, proof: b.url } : NOT_YET;
  }),
  level("a9-open-pull", (o) => {
    const p = mine(o).find((x) => x.state !== "CLOSED");
    return p ? { done: true, proof: p.url } : NOT_YET;
  }),
  level("a10-answer-review", (o) => {
    for (const p of mine(o)) {
      const fix = p.commits.find((c) => c.committedDate > p.createdAt);
      if (fix) return { done: true, proof: fix.url };
    }
    return NOT_YET;
  }),
  level("a11-merge", (o) => {
    const closed = new Set((o.practice?.issues ?? []).filter((i) => i.closed).map((i) => i.number));
    const p = mine(o).find((x) => x.state === "MERGED" && x.closes.every((n) => closed.has(n)));
    return p ? { done: true, proof: p.url } : NOT_YET;
  }),
];
