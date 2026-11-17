import { describe, expect, it } from "vitest";
import type { PracticeIssue, PracticePull, PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import { prepareEdit, prepareFound, prepareIssue, prepareMayor, prepareMerge, preparePull, prepareTake } from "./practice.ts";

const viewer = { login: "fictif-volunteer", id: "U_fictif" };
const site = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "https://github.com/fictif-volunteer/my-first-site" },
  board: { id: "PVT_fictif", number: 1, url: "https://github.com/users/fictif-volunteer/projects/1", columns: ["Todo", "In Progress", "Done"] },
  issues: [], defaultBranch: null, readme: null, branches: [], pulls: [], plan: null, ...o,
});
const issue = (o: Partial<PracticeIssue> = {}): PracticeIssue => ({
  id: "I_fictif_1", number: 1, url: "u1", author: "fictif-volunteer", assignees: [], comments: [], status: "Todo", closed: false, ...o,
});

describe("prepareFound", () => {
  it("founds a new site: a repository then a board linked to it", () => {
    const p = prepareFound(viewer, null, "my-first-site", "PUBLIC");
    expect(p).toMatchObject({ kind: "found", owner: "fictif-volunteer", name: "my-first-site", visibility: "PUBLIC", reuse: false });
    expect(p.mutations.map((m) => m.name)).toEqual(["createRepository", "createProjectV2"]);
    expect(p.mutations[0].input).toMatchObject({ name: "my-first-site", visibility: "PUBLIC", hasIssuesEnabled: true });
    expect(p.mutations[1].input).toEqual({ ownerId: "U_fictif", title: "my-first-site", repositoryId: "$repositoryId" });
  });
  it("founds a private site when asked", () => {
    expect(prepareFound(viewer, null, "my-first-site", "PRIVATE").mutations[0].input).toMatchObject({ visibility: "PRIVATE" });
  });
  it("reuses an existing repository", () => {
    const p = prepareFound(viewer, site({ board: null }), "my-first-site", "PUBLIC");
    expect(p.reuse).toBe(true);
    expect(p.mutations.map((m) => m.name)).not.toContain("createRepository");
  });
  it("creates only the board when the repository exists", () => {
    const p = prepareFound(viewer, site({ board: null }), "my-first-site", "PUBLIC");
    expect(p.mutations).toEqual([{ name: "createProjectV2", input: { ownerId: "U_fictif", title: "my-first-site", repositoryId: "R_fictif" } }]);
  });
  it("never founds on a repository that is not the viewer's (renamed, moved)", () => {
    const moved = site({ board: null, repo: { id: "R_moved", nameWithOwner: "fictif-org/elsewhere", url: "u" } });
    expect(() => prepareFound(viewer, moved, "my-first-site", "PUBLIC")).toThrow(GestureError);
  });
  it("founds nothing when the site is complete", () => {
    expect(() => prepareFound(viewer, site(), "my-first-site", "PUBLIC")).toThrow(GestureError);
  });
});

describe("prepareIssue", () => {
  it("writes an issue in the practice repository and puts it on the board", () => {
    const p = prepareIssue(site(), "  FICTIF Paint the gate  ", "Blue, please.");
    expect(p).toMatchObject({ kind: "issue", repo: "fictif-volunteer/my-first-site", title: "FICTIF Paint the gate", body: "Blue, please." });
    expect(p.mutations).toEqual([
      { name: "createIssue", input: { repositoryId: "R_fictif", title: "FICTIF Paint the gate", body: "Blue, please." } },
      { name: "addProjectV2ItemById", input: { projectId: "PVT_fictif", contentId: "$issueId" } },
    ]);
  });
  it("refuses an empty or too long title", () => {
    expect(() => prepareIssue(site(), "   ", "")).toThrow(GestureError);
    expect(() => prepareIssue(site(), "x".repeat(257), "")).toThrow(GestureError);
  });
  it("needs a founded site", () => {
    expect(() => prepareIssue(site({ board: null }), "FICTIF", "")).toThrow(GestureError);
  });
});

describe("prepareTake", () => {
  it("takes an open issue: assign yourself, then your comment", () => {
    const p = prepareTake(site({ issues: [issue()] }), viewer, 1, "I'll take it");
    expect(p).toMatchObject({ kind: "take", repo: "fictif-volunteer/my-first-site", issueNumber: 1, comment: "I'll take it" });
    expect(p.mutations).toEqual([
      { name: "addAssigneesToAssignable", input: { assignableId: "I_fictif_1", assigneeIds: ["U_fictif"] } },
      { name: "addComment", input: { subjectId: "I_fictif_1", body: "I'll take it" } },
    ]);
  });
  it("never takes an issue assigned to someone else", () => {
    expect(() => prepareTake(site({ issues: [issue({ assignees: ["someone-else"] })] }), viewer, 1, "mine")).toThrow(GestureError);
  });
  it("refuses a closed or unknown issue, and an empty comment", () => {
    expect(() => prepareTake(site({ issues: [issue({ closed: true })] }), viewer, 1, "mine")).toThrow(GestureError);
    expect(() => prepareTake(site({ issues: [issue()] }), viewer, 9, "mine")).toThrow(GestureError);
    expect(() => prepareTake(site({ issues: [issue()] }), viewer, 1, "  ")).toThrow(GestureError);
  });
});

const decode = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
const mine = issue({ assignees: ["fictif-volunteer"] });

describe("prepareEdit", () => {
  it("lays the foundation stone on an empty repository", () => {
    const p = prepareEdit(site({ issues: [mine] }), viewer, 1, "# my-first-site\n\nA blue gate.\n", "Paint the gate blue");
    expect(p).toMatchObject({ kind: "edit", repo: "fictif-volunteer/my-first-site", branch: "practice-1", path: "README.md", foundation: true });
    expect(p.mutations.map((m) => m.name)).toEqual(["createOrUpdateFileContents", "createRef", "createCommitOnBranch"]);
    expect(decode(p.mutations[0].input.content as string)).toBe("# my-first-site\n");
    expect(p.mutations[1].input).toEqual({ repositoryId: "R_fictif", name: "refs/heads/practice-1", oid: "$headOid" });
    expect(p.mutations[2].input).toMatchObject({
      branch: { repositoryNameWithOwner: "fictif-volunteer/my-first-site", branchName: "practice-1" },
      expectedHeadOid: "$headOid", message: { headline: "Paint the gate blue" },
    });
  });
  it("branches from the default branch head", () => {
    const p = prepareEdit(site({ issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" } }), viewer, 1, "text", "msg");
    expect(p.foundation).toBe(false);
    expect(p.mutations.map((m) => m.name)).toEqual(["createRef", "createCommitOnBranch"]);
    expect(p.mutations[0].input).toMatchObject({ oid: "a1" });
    expect(p.mutations[1].input).toMatchObject({ expectedHeadOid: "a1" });
  });
  it("edits on the branch head the server read", () => {
    const p = prepareEdit(site({
      issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" },
      branches: [{ name: "practice-1", oid: "b7", author: "fictif-volunteer", url: "c", readme: null, viaWeb: true, history: [] }],
    }), viewer, 1, "text", "Say why");
    expect(p.mutations.map((m) => m.name)).toEqual(["createCommitOnBranch"]);
    expect(p.mutations[0].input).toMatchObject({ expectedHeadOid: "b7" });
  });
  it("encodes any text exactly", () => {
    const p = prepareEdit(site({ issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" } }), viewer, 1, "Façade 🧱 bleue", "msg");
    const additions = (p.mutations[1].input.fileChanges as { additions: { path: string; contents: string }[] }).additions;
    expect(additions[0].path).toBe("README.md");
    expect(decode(additions[0].contents)).toBe("Façade 🧱 bleue");
  });
  it("refuses an issue not assigned to you, and an empty message", () => {
    expect(() => prepareEdit(site({ issues: [issue()] }), viewer, 1, "t", "m")).toThrow(GestureError);
    expect(() => prepareEdit(site({ issues: [mine] }), viewer, 1, "t", "  ")).toThrow(GestureError);
  });
});

const pullOf = (o: Partial<PracticePull> = {}): PracticePull => ({
  id: "PR_2", number: 2, url: "p2", author: "fictif-volunteer", state: "OPEN", createdAt: "2026-11-17T10:00:00Z",
  headRefName: "practice-1", headRefOid: "b7", closes: [1], closesElsewhere: [], commits: [], ...o,
});
const branched = (o: Partial<PracticeSnapshot> = {}) => site({
  issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" },
  branches: [{ name: "practice-1", oid: "b7", author: "fictif-volunteer", url: "c", readme: null, viaWeb: true, history: [] }], ...o,
});

describe("preparePull", () => {
  it("opens a pull request that closes the issue", () => {
    const p = preparePull(branched(), viewer, 1, "Paint the gate blue", "The gate was grey.");
    expect(p).toMatchObject({ kind: "pull", branch: "practice-1", issueNumber: 1, body: "The gate was grey.\n\nCloses #1" });
    expect(p.mutations).toEqual([{ name: "createPullRequest", input: {
      repositoryId: "R_fictif", baseRefName: "main", headRefName: "practice-1", title: "Paint the gate blue", body: "The gate was grey.\n\nCloses #1",
    } }]);
  });
  it("never opens a second pull request from the same branch", () => {
    expect(() => preparePull(branched({ pulls: [pullOf()] }), viewer, 1, "t", "w")).toThrow(GestureError);
  });
  it("needs the branch first", () => {
    expect(() => preparePull(site({ issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" } }), viewer, 1, "t", "w")).toThrow(GestureError);
  });
});

describe("prepareMerge", () => {
  it("merges your pull request on its head", () => {
    const p = prepareMerge(branched({ pulls: [pullOf()] }), viewer, 2);
    expect(p).toMatchObject({ kind: "merge", repo: "fictif-volunteer/my-first-site", pullNumber: 2 });
    expect(p.mutations).toEqual([{ name: "mergePullRequest", input: { pullRequestId: "PR_2", expectedHeadOid: "b7", mergeMethod: "MERGE" } }]);
  });
  it("never merges a pull request that is not yours", () => {
    expect(() => prepareMerge(branched({ pulls: [pullOf({ author: "someone-else" })] }), viewer, 2)).toThrow(GestureError);
    expect(() => prepareMerge(branched({ pulls: [pullOf({ state: "MERGED" })] }), viewer, 2)).toThrow(GestureError);
    expect(() => prepareMerge(branched({ pulls: [pullOf({ closes: [] })] }), viewer, 2)).toThrow(GestureError);
  });
});

describe("never touching another repository", () => {
  it("never merges a pull request that would close an issue elsewhere", () => {
    expect(() => prepareMerge(branched({ pulls: [pullOf({ closesElsewhere: ["fictif-org/real-repo#3"] })] }), viewer, 2)).toThrow(GestureError);
  });
  it("refuses a closing keyword aimed at another repository, in the pull request or the commit message", () => {
    for (const text of ["Fixes fictif-org/real-repo#3", "this closes Fictif-Org/Real.Repo#12 too", "Resolved: fictif-org/x#1"]) {
      expect(() => preparePull(branched(), viewer, 1, "t", text), text).toThrow(GestureError);
      expect(() => prepareEdit(branched(), viewer, 1, "text", text), text).toThrow(GestureError);
    }
    expect(() => preparePull(branched(), viewer, 1, "t", "See fictif-org/real-repo#3 for the idea")).not.toThrow();
  });
});

describe("prepareMayor", () => {
  it("the mayor adds a line to PLAN.md on main, at its head", () => {
    const p = prepareMayor(branched({ plan: "# Plan\n" }));
    expect(p).toMatchObject({ kind: "mayor", repo: "fictif-volunteer/my-first-site", branch: "main", line: "- FICTIF The mayor wants a bench by the gate." });
    expect(p.mutations).toHaveLength(1);
    expect(p.mutations[0]).toMatchObject({ name: "createCommitOnBranch", input: {
      branch: { repositoryNameWithOwner: "fictif-volunteer/my-first-site", branchName: "main" },
      expectedHeadOid: "a1", message: { headline: "The mayor changes the plan" },
    } });
    const additions = (p.mutations[0].input.fileChanges as { additions: { path: string; contents: string }[] }).additions;
    expect(additions[0].path).toBe("PLAN.md");
    expect(decode(additions[0].contents)).toBe("# Plan\n- FICTIF The mayor wants a bench by the gate.\n");
  });
  it("starts the plan when there is none, and refuses an empty repository", () => {
    const additions = (prepareMayor(branched()).mutations[0].input.fileChanges as { additions: { contents: string }[] }).additions;
    expect(decode(additions[0].contents)).toBe("# Plan\n\n- FICTIF The mayor wants a bench by the gate.\n");
    expect(() => prepareMayor(site())).toThrow(GestureError);
  });
});

describe("a pull request from your own branch", () => {
  const work = (o: Partial<PracticeSnapshot> = {}) => branched({
    branches: [{ name: "work-1", oid: "w1", author: "fictif-volunteer", url: "c", readme: null, viaWeb: false, history: [] }], ...o,
  });
  it("opens a pull request from your own branch", () => {
    const p = preparePull(work(), viewer, 1, "Paint", "why", "work-1");
    expect(p.branch).toBe("work-1");
    expect(p.mutations[0].input).toMatchObject({ headRefName: "work-1", baseRefName: "main" });
  });
  it("refuses a pull request from the default branch, or a branch that does not exist", () => {
    expect(() => preparePull(work(), viewer, 1, "t", "w", "main")).toThrow(GestureError);
    expect(() => preparePull(work(), viewer, 1, "t", "w", "nowhere")).toThrow(GestureError);
  });
});
