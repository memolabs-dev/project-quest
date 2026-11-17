// The Team leader rank: git on the player's machine. GitHub sees that work only at the push, so each level
// passes on something GitHub shows (spec, "Why the Team leader rank is cut this way").
import type { Check, Level, Observed, PracticeSnapshot } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The player's own branch: neither the default nor one the game's trowel made. */
const isWork = (name: string, practice: PracticeSnapshot) =>
  name !== practice.defaultBranch?.name && !/^practice-\d+$/.test(name);

/** Work branches whose head the viewer committed on their machine, beyond the default head. */
const pushed = (o: Observed) => {
  const p = o.practice;
  if (!p) return [];
  return p.branches.filter((b) => isWork(b.name, p) && !b.viaWeb && same(b.author, o.viewer) && b.oid !== p.defaultBranch?.oid);
};

/** The viewer's pull requests from a work branch that close an issue. */
const workPulls = (o: Observed) => {
  const p = o.practice;
  if (!p) return [];
  return p.pulls.filter((x) => same(x.author, o.viewer) && x.closes.length > 0 && isWork(x.headRefName, p));
};

const level = (id: string, check: (o: Observed) => Check): Level => ({ id, rank: "team-leader", where: "practice", check });

export const TEAM_LEADER: Level[] = [
  level("a12-push-branch", (o) => {
    const b = pushed(o)[0];
    return b ? { done: true, proof: b.url } : NOT_YET;
  }),
  level("a13-bring-main", (o) => {
    const main = o.practice?.defaultBranch;
    if (!main) return NOT_YET;
    // Main moved after the branch's first own commit from the machine, and its head is now inside the branch.
    // "Own": not in main's history, so main's past (the REST foundation stone reads like a machine commit) never counts.
    const inMain = new Set(o.practice?.mainHistory ?? []);
    const b = pushed(o).find((x) => {
      const firstOwn = x.history.filter((h) => !h.viaWeb && !inMain.has(h.oid)).map((h) => h.committedDate).sort()[0];
      return firstOwn !== undefined && main.committedDate > firstOwn && x.history.some((h) => h.oid === main.oid);
    });
    return b ? { done: true, proof: b.url } : NOT_YET;
  }),
  level("a14-fix-from-machine", (o) => {
    for (const p of workPulls(o)) {
      const fix = p.commits.find((c) => !c.viaWeb && c.committedDate > p.createdAt);
      if (fix) return { done: true, proof: fix.url };
    }
    return NOT_YET;
  }),
  level("a15-clean-up", (o) => {
    const names = new Set((o.practice?.branches ?? []).map((b) => b.name));
    const p = workPulls(o).find((x) => x.state === "MERGED" && !names.has(x.headRefName));
    return p ? { done: true, proof: p.url } : NOT_YET;
  }),
];
