// The Team leader rank: git on the player's machine. GitHub sees that work only at the push, so each level
// passes on something GitHub shows (spec, "Why the Team leader rank is cut this way").
import type { Check, Level, Observed, PracticeSnapshot } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The player's own branch: neither the default nor one the game's trowel made. */
const isWork = (name: string, practice: PracticeSnapshot) =>
  name !== practice.defaultBranch?.name && !/^practice-\d+$/.test(name);

/**
 * Work branches whose head was committed on a machine, beyond main: not main's head, nor any commit of main's past
 * (a branch made on github.com from an old commit). The author is not checked: it is the player's own repository,
 * and a git email not linked to GitHub must not make a real push invisible.
 */
const pushed = (o: Observed) => {
  const p = o.practice;
  if (!p) return [];
  const inMain = new Set(p.mainHistory);
  return p.branches.filter((b) => isWork(b.name, p) && !b.viaWeb && b.oid !== p.defaultBranch?.oid && !inMain.has(b.oid));
};

/** The viewer's pull requests from a work branch that close an issue. */
const workPulls = (o: Observed) => {
  const p = o.practice;
  if (!p) return [];
  return p.pulls.filter((x) => same(x.author, o.viewer) && x.closes.length > 0 && isWork(x.headRefName, p));
};

/** The commits a commit is made of, within the history read (newest first, up to 30). */
export const ancestorsOf = (history: { oid: string; parents?: string[] }[]) => {
  const parents = new Map(history.map((h) => [h.oid, h.parents ?? []]));
  return (oid: string) => {
    const seen = new Set<string>();
    const stack = [...(parents.get(oid) ?? [])];
    while (stack.length) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(parents.get(next) ?? []));
    }
    return seen;
  };
};

const level = (id: string, check: (o: Observed) => Check): Level => ({ id, rank: "team-leader", path: "volunteer", where: "practice", check });

export const TEAM_LEADER: Level[] = [
  level("a12-push-branch", (o) => {
    const b = pushed(o)[0];
    return b ? { done: true, proof: b.url } : NOT_YET;
  }),
  level("a13-bring-main", (o) => {
    const main = o.practice?.defaultBranch;
    if (!main) return NOT_YET;
    // By ancestry, never by the machine's clock: the branch began before main's head (its first own commit does not
    // contain it), and main's head is now inside the branch. "Own": not in main's history, so main's past (the REST
    // foundation stone reads like a machine commit) never counts. A rebase rewrites the branch on the new main: it
    // reads as a branch begun there (level 13 teaches the merge).
    const inMain = new Set(o.practice?.mainHistory ?? []);
    const b = pushed(o).find((x) => {
      const own = x.history.filter((h) => !h.viaWeb && !inMain.has(h.oid));
      const firstOwn = own[own.length - 1];
      if (!firstOwn) return false;
      const ancestors = ancestorsOf(x.history);
      return !ancestors(firstOwn.oid).has(main.oid) && ancestors(x.oid).has(main.oid);
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
    // GitHub's word on the pull request itself when it has it; else the branch is not among those read.
    const p = workPulls(o).find((x) => x.state === "MERGED" && (x.branchGone ?? !names.has(x.headRefName)));
    return p ? { done: true, proof: p.url } : NOT_YET;
  }),
];
