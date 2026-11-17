import { describe, expect, it } from "vitest";
import { TEAM_LEADER } from "./team-leader.ts";
import type { Observed, PracticePull, PracticeSnapshot } from "./types.ts";

const level = (id: string) => TEAM_LEADER.find((l) => l.id === id)!;
const VIEWER = "fictif-volunteer";
const MAIN = { name: "main", oid: "m1", committedDate: "2026-11-17T08:00:00Z" };

type Branch = PracticeSnapshot["branches"][number];
const branch = (o: Partial<Branch> = {}): Branch => ({
  name: "work-3", oid: "w1", author: VIEWER, url: "c-w1", readme: null, viaWeb: false,
  history: [{ oid: "w1", committedDate: "2026-11-17T09:00:00Z", viaWeb: false }, { oid: "m1", committedDate: MAIN.committedDate, viaWeb: true }],
  ...o,
});
const pull = (o: Partial<PracticePull> = {}): PracticePull => ({
  id: "PR_4", number: 4, url: "p4", author: VIEWER, state: "OPEN", createdAt: "2026-11-17T10:00:00Z",
  headRefName: "work-3", headRefOid: "w1", closes: [3], closesElsewhere: [],
  commits: [{ oid: "w1", url: "c-w1", committedDate: "2026-11-17T09:00:00Z", viaWeb: false }], ...o,
});
const snapshot = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R", nameWithOwner: "fictif-volunteer/my-first-site", url: "r" },
  board: { id: "PVT", number: 1, url: "b", columns: ["Todo", "In Progress", "Done"] },
  issues: [], defaultBranch: MAIN, readme: null, branches: [], pulls: [], plan: null, mainHistory: ["m1"], ...o,
});
const seen = (practice: PracticeSnapshot): Observed => ({ viewer: VIEWER, events: [], practice });

describe("the Team leader levels", () => {
  it("are the four of the spec, in order", () => {
    expect(TEAM_LEADER.map((l) => l.id)).toEqual(["a12-push-branch", "a13-bring-main", "a14-fix-from-machine", "a15-clean-up"]);
    expect(TEAM_LEADER.every((l) => l.rank === "team-leader" && l.where === "practice")).toBe(true);
  });
});

describe("a12-push-branch", () => {
  it("passes on a branch pushed with a commit made on the machine, proof the commit", () => {
    expect(level("a12-push-branch").check(seen(snapshot({ branches: [branch()] })))).toEqual({ done: true, proof: "c-w1" });
  });
  it("a12 needs a commit beyond main", () => {
    expect(level("a12-push-branch").check(seen(snapshot({ branches: [branch({ oid: "m1" })] }))).done).toBe(false);
  });
  it("a12 ignores a commit made through GitHub, and the game's practice branches", () => {
    expect(level("a12-push-branch").check(seen(snapshot({ branches: [branch({ viaWeb: true })] }))).done).toBe(false);
    expect(level("a12-push-branch").check(seen(snapshot({ branches: [branch({ name: "practice-1" })] }))).done).toBe(false);
  });
  it("any branch name of the player's counts", () => {
    expect(level("a12-push-branch").check(seen(snapshot({ branches: [branch({ name: "my-gate" })] }))).done).toBe(true);
  });
});

describe("a13-bring-main", () => {
  const moved = { ...MAIN, oid: "m2", committedDate: "2026-11-17T11:00:00Z" };
  it("passes once main moved after the branch began, and came into it", () => {
    const merged = branch({ oid: "w2", history: [
      { oid: "w2", committedDate: "2026-11-17T11:05:00Z", viaWeb: false }, { oid: "m2", committedDate: moved.committedDate, viaWeb: true },
      { oid: "w1", committedDate: "2026-11-17T09:00:00Z", viaWeb: false }, { oid: "m1", committedDate: MAIN.committedDate, viaWeb: true },
    ] });
    expect(level("a13-bring-main").check(seen(snapshot({ defaultBranch: moved, branches: [merged], mainHistory: ["m2", "m1"] })))).toEqual({ done: true, proof: "c-w1" });
  });
  it("a13 needs main to have moved, then come in", () => {
    expect(level("a13-bring-main").check(seen(snapshot({ branches: [branch()] }))).done).toBe(false);
    expect(level("a13-bring-main").check(seen(snapshot({ defaultBranch: moved, branches: [branch()], mainHistory: ["m2", "m1"] }))).done).toBe(false);
  });
});

describe("a13 and main's own past", () => {
  it("ignores main's old commits made on a machine (the foundation stone), counting only the branch's own", () => {
    // Main's history: a merge (m1, through GitHub) over the REST foundation stone (f0, reads like a machine commit).
    const fresh = branch({ history: [
      { oid: "w1", committedDate: "2026-11-17T09:00:00Z", viaWeb: false },
      { oid: "m1", committedDate: MAIN.committedDate, viaWeb: true },
      { oid: "f0", committedDate: "2026-11-17T07:00:00Z", viaWeb: false },
    ] });
    const o = seen(snapshot({ branches: [fresh], mainHistory: ["m1", "f0"] }));
    expect(level("a13-bring-main").check(o).done).toBe(false);
  });
});

describe("what a12 must not take for a push", () => {
  it("a12 refuses a branch whose head is an old commit of main", () => {
    const o = seen(snapshot({ branches: [branch({ oid: "f0" })], mainHistory: ["m1", "f0"] }));
    expect(level("a12-push-branch").check(o).done).toBe(false);
  });
  it("an unlinked git email still counts: it is the player's own repository", () => {
    expect(level("a12-push-branch").check(seen(snapshot({ branches: [branch({ author: "ghost" })] }))).done).toBe(true);
  });
});

describe("a14-fix-from-machine", () => {
  const fix = { oid: "w3", url: "c-w3", committedDate: "2026-11-17T10:30:00Z", viaWeb: false };
  it("passes on a commit pushed from the machine after the pull request opened", () => {
    expect(level("a14-fix-from-machine").check(seen(snapshot({ pulls: [pull({ commits: [...pull().commits, fix] })] }))))
      .toEqual({ done: true, proof: "c-w3" });
  });
  it("a14 ignores a fix made on the web", () => {
    expect(level("a14-fix-from-machine").check(seen(snapshot({ pulls: [pull({ commits: [{ ...fix, viaWeb: true }] })] }))).done).toBe(false);
  });
  it("a14 ignores the game's practice branches", () => {
    expect(level("a14-fix-from-machine").check(seen(snapshot({ pulls: [pull({ headRefName: "practice-1", commits: [fix] })] }))).done).toBe(false);
  });
});

describe("a15-clean-up", () => {
  it("a15 passes when the branch is gone, however it went", () => {
    expect(level("a15-clean-up").check(seen(snapshot({ pulls: [pull({ state: "MERGED" })] })))).toEqual({ done: true, proof: "p4" });
  });
  it("waits for the merge, and for the branch to go", () => {
    expect(level("a15-clean-up").check(seen(snapshot({ pulls: [pull()] }))).done).toBe(false);
    expect(level("a15-clean-up").check(seen(snapshot({ pulls: [pull({ state: "MERGED" })], branches: [branch()] }))).done).toBe(false);
  });
});
