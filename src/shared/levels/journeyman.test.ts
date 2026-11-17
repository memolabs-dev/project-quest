import { describe, expect, it } from "vitest";
import { JOURNEYMAN } from "./journeyman.ts";
import type { Observed, PracticeIssue, PracticePull, PracticeSnapshot } from "./types.ts";

const level = (id: string) => JOURNEYMAN.find((l) => l.id === id)!;
const VIEWER = "fictif-volunteer";

const issue = (o: Partial<PracticeIssue> = {}): PracticeIssue => ({
  id: "I_1", number: 1, url: "u1", author: VIEWER, assignees: [VIEWER], comments: [], status: "In Progress", closed: false, ...o,
});
const pull = (o: Partial<PracticePull> = {}): PracticePull => ({
  id: "PR_2", number: 2, url: "https://github.com/fictif-volunteer/my-first-site/pull/2", author: VIEWER, state: "OPEN",
  createdAt: "2026-11-17T10:00:00Z", headRefName: "practice-1", headRefOid: "b1", closes: [1], closesElsewhere: [],
  commits: [{ oid: "b1", url: "c-b1", committedDate: "2026-11-17T09:59:00Z" }], ...o,
});
const snapshot = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R", nameWithOwner: "fictif-volunteer/my-first-site", url: "r" },
  board: { id: "PVT", number: 1, url: "b", columns: ["Todo", "In Progress", "Done"] },
  issues: [issue()], defaultBranch: { name: "main", oid: "a1" }, readme: "# my-first-site\n", branches: [], pulls: [], ...o,
});
const seen = (practice: PracticeSnapshot | null, viewer = VIEWER): Observed => ({ viewer, events: [], practice });

describe("the Journeyman levels", () => {
  it("are the four of the spec, in order, on the practice site", () => {
    expect(JOURNEYMAN.map((l) => l.id)).toEqual(["a8-edit-file", "a9-open-pull", "a10-answer-review", "a11-merge"]);
    expect(JOURNEYMAN.every((l) => l.rank === "journeyman" && l.where === "practice")).toBe(true);
  });
});

describe("a8-edit-file", () => {
  it("passes on a branch whose head the viewer wrote, proof the commit", () => {
    const o = seen(snapshot({ branches: [{ name: "practice-1", oid: "b1", author: VIEWER, url: "c-b1", readme: null }] }));
    expect(level("a8-edit-file").check(o)).toEqual({ done: true, proof: "c-b1" });
  });
  it("is not done with no branch, or a branch someone else wrote", () => {
    expect(level("a8-edit-file").check(seen(snapshot())).done).toBe(false);
    expect(level("a8-edit-file").check(seen(snapshot({ branches: [{ name: "practice-1", oid: "b", author: "someone-else", url: "c", readme: null }] }))).done).toBe(false);
  });
  it("a8 needs a commit beyond the default branch, on a practice branch", () => {
    const at = (name: string, oid: string) => seen(snapshot({ branches: [{ name, oid, author: VIEWER, url: "c", readme: null }] }));
    expect(level("a8-edit-file").check(at("practice-1", "a1")).done).toBe(false);
    expect(level("a8-edit-file").check(at("my-old-branch", "b9")).done).toBe(false);
  });
});

describe("a9-open-pull", () => {
  it("passes on the viewer's pull request that closes an issue, open or merged", () => {
    expect(level("a9-open-pull").check(seen(snapshot({ pulls: [pull()] })))).toEqual({ done: true, proof: pull().url });
    expect(level("a9-open-pull").check(seen(snapshot({ pulls: [pull({ state: "MERGED" })] }))).done).toBe(true);
  });
  it("a9 ignores a pull request that closes no issue", () => {
    expect(level("a9-open-pull").check(seen(snapshot({ pulls: [pull({ closes: [] })] }))).done).toBe(false);
  });
  it("a9 ignores someone else's pull request", () => {
    expect(level("a9-open-pull").check(seen(snapshot({ pulls: [pull({ author: "someone-else" })] }))).done).toBe(false);
  });
});

describe("a10-answer-review", () => {
  it("a10 needs a commit after the pull request was opened", () => {
    const before = pull();
    const after = pull({ commits: [...before.commits, { oid: "b2", url: "c-b2", committedDate: "2026-11-17T10:05:00Z" }] });
    expect(level("a10-answer-review").check(seen(snapshot({ pulls: [before] }))).done).toBe(false);
    expect(level("a10-answer-review").check(seen(snapshot({ pulls: [after] })))).toEqual({ done: true, proof: "c-b2" });
  });
});

describe("a11-merge", () => {
  it("passes once the viewer's pull request is merged and its issue closed", () => {
    const o = seen(snapshot({ pulls: [pull({ state: "MERGED" })], issues: [issue({ closed: true })] }));
    expect(level("a11-merge").check(o)).toEqual({ done: true, proof: pull().url });
  });
  it("a11 waits for the issue to be closed", () => {
    expect(level("a11-merge").check(seen(snapshot({ pulls: [pull({ state: "MERGED" })] }))).done).toBe(false);
    expect(level("a11-merge").check(seen(snapshot({ pulls: [pull()], issues: [issue({ closed: true })] }))).done).toBe(false);
  });
});
