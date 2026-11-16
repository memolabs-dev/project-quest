import { describe, expect, it } from "vitest";
import { APPRENTICE } from "./apprentice.ts";
import type { Observed, PracticeIssue, PracticeSnapshot, TutorialEvent } from "./types.ts";

const level = (id: string) => APPRENTICE.find((l) => l.id === id)!;
const VIEWER = "fictif-volunteer";

const issue = (o: Partial<PracticeIssue> = {}): PracticeIssue => ({
  id: "I_fictif_1", number: 1, url: "https://github.com/fictif-volunteer/my-first-site/issues/1", author: VIEWER,
  assignees: [], comments: [], status: "Todo", closed: false, ...o,
});
const snapshot = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "https://github.com/fictif-volunteer/my-first-site" },
  board: { id: "PVT_fictif", number: 1, url: "https://github.com/users/fictif-volunteer/projects/1", columns: ["Todo", "In Progress", "Done"] },
  issues: [], defaultBranch: null, readme: null, branches: [], pulls: [], ...o,
});
const seen = (o: Partial<Observed> = {}): Observed => ({ viewer: VIEWER, events: [], practice: null, ...o });
const events = (...e: TutorialEvent[]) => seen({ events: e });

describe("the Apprentice levels", () => {
  it("are the seven of the spec, in order", () => {
    expect(APPRENTICE.map((l) => l.id)).toEqual([
      "a1-walk", "a2-read-issue", "a3-read-board", "a4-found-site", "a5-write-issue", "a6-take-issue", "a7-move-issue",
    ]);
    expect(APPRENTICE.every((l) => l.rank === "apprentice")).toBe(true);
    expect(APPRENTICE.slice(0, 3).every((l) => l.where === "tutorial")).toBe(true);
    expect(APPRENTICE.slice(3).every((l) => l.where === "practice")).toBe(true);
  });
});

describe("a1-walk", () => {
  it("passes once the player has walked and opened a pallet", () => {
    expect(level("a1-walk").check(events("walked", "card-opened"))).toEqual({ done: true, proof: "tutorial" });
  });
  it("is not yet done after walking only", () => {
    expect(level("a1-walk").check(events("walked")).done).toBe(false);
  });
});

describe("a2-read-issue and a3-read-board", () => {
  it("pass on their tutorial event", () => {
    expect(level("a2-read-issue").check(events("card-read")).done).toBe(true);
    expect(level("a3-read-board").check(events("pallet-moved")).done).toBe(true);
  });
  it("are not done without it", () => {
    expect(level("a2-read-issue").check(events("card-opened")).done).toBe(false);
    expect(level("a3-read-board").check(events()).done).toBe(false);
  });
});

describe("a4-found-site", () => {
  it("passes when the practice repository has its board, with the board as proof", () => {
    expect(level("a4-found-site").check(seen({ practice: snapshot() }))).toEqual({ done: true, proof: "https://github.com/users/fictif-volunteer/projects/1" });
  });
  it("is not done without a repository, or without a board", () => {
    expect(level("a4-found-site").check(seen()).done).toBe(false);
    expect(level("a4-found-site").check(seen({ practice: snapshot({ board: null }) })).done).toBe(false);
  });
});

describe("a5-write-issue", () => {
  it("passes on an issue the viewer wrote, proof its address", () => {
    const r = level("a5-write-issue").check(seen({ practice: snapshot({ issues: [issue({ number: 3, url: "u3" }), issue({ number: 2, url: "u2" })] }) }));
    expect(r).toEqual({ done: true, proof: "u2" });
  });
  it("a5 ignores an issue written by someone else", () => {
    expect(level("a5-write-issue").check(seen({ practice: snapshot({ issues: [issue({ author: "someone-else" })] }) })).done).toBe(false);
  });
});

describe("a6-take-issue", () => {
  const comment = { author: VIEWER, url: "https://github.com/fictif-volunteer/my-first-site/issues/1#issuecomment-1" };
  it("passes on an open issue assigned to the viewer with their comment, proof the comment", () => {
    const r = level("a6-take-issue").check(seen({ practice: snapshot({ issues: [issue({ assignees: [VIEWER], comments: [comment] })] }) }));
    expect(r).toEqual({ done: true, proof: comment.url });
  });
  it("a6 needs both the assignment and the viewer's own comment", () => {
    const check = (o: Partial<PracticeIssue>) => level("a6-take-issue").check(seen({ practice: snapshot({ issues: [issue(o)] }) })).done;
    expect(check({ assignees: [VIEWER] })).toBe(false);
    expect(check({ comments: [comment] })).toBe(false);
    expect(check({ assignees: [VIEWER], comments: [{ author: "someone-else", url: "x" }] })).toBe(false);
    expect(check({ assignees: [VIEWER], comments: [comment], closed: true })).toBe(false);
  });
});

describe("a7-move-issue", () => {
  const moved = (status: string | null, columns = ["Todo", "In Progress", "Done"]) =>
    level("a7-move-issue").check(seen({ practice: snapshot({
      board: { id: "PVT_fictif", number: 1, url: "b", columns },
      issues: [issue({ assignees: [VIEWER], status })],
    }) })).done;
  it("passes when the viewer's issue has left the first column", () => {
    expect(moved("In Progress")).toBe(true);
    expect(moved("Todo")).toBe(false);
  });
  it("a7 passes on any column after the first", () => {
    const columns = ["Inbox", "Doing", "Shipped"];
    expect(moved("Doing", columns)).toBe(true);
    expect(moved("Inbox", columns)).toBe(false);
    expect(moved(null, columns)).toBe(false);
  });
});

describe("logins", () => {
  it("logins compare without case", () => {
    const o = seen({ viewer: "Fictif-Volunteer", practice: snapshot({ issues: [issue({ author: "fictif-volunteer" })] }) });
    expect(level("a5-write-issue").check(o).done).toBe(true);
  });
});
