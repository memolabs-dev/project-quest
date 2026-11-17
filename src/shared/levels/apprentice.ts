// The Apprentice rank: the tutorial on the fictitious site, then the practice site in the player's own account.
import type { Check, Level, Observed, PracticeIssue, TutorialEvent } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const byNumber = (a: PracticeIssue, b: PracticeIssue) => a.number - b.number;

const tutorial = (id: string, needs: TutorialEvent[]): Level => ({
  id, rank: "apprentice", path: "volunteer", where: "tutorial",
  check: (o) => (needs.every((e) => o.events.includes(e)) ? { done: true, proof: "tutorial" } : NOT_YET),
});

const practice = (id: string, check: (o: Observed) => Check): Level => ({ id, rank: "apprentice", path: "volunteer", where: "practice", check });

/** Open issues assigned to the viewer, lowest number first. */
const mine = (o: Observed) =>
  (o.practice?.issues ?? []).filter((i) => !i.closed && i.assignees.some((a) => same(a, o.viewer))).sort(byNumber);

export const APPRENTICE: Level[] = [
  tutorial("a1-walk", ["walked", "card-opened"]),
  tutorial("a2-read-issue", ["card-read"]),
  tutorial("a3-read-board", ["pallet-moved"]),
  practice("a4-found-site", (o) => (o.practice?.board ? { done: true, proof: o.practice.board.url } : NOT_YET)),
  practice("a5-write-issue", (o) => {
    const own = (o.practice?.issues ?? []).filter((i) => same(i.author, o.viewer)).sort(byNumber)[0];
    return own ? { done: true, proof: own.url } : NOT_YET;
  }),
  practice("a6-take-issue", (o) => {
    for (const i of mine(o)) {
      const said = i.comments.find((c) => same(c.author, o.viewer));
      if (said) return { done: true, proof: said.url };
    }
    return NOT_YET;
  }),
  practice("a7-move-issue", (o) => {
    const first = o.practice?.board?.columns[0];
    const moved = mine(o).find((i) => i.status !== null && i.status !== first);
    return moved ? { done: true, proof: moved.url } : NOT_YET;
  }),
];
