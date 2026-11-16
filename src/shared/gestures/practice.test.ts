import { describe, expect, it } from "vitest";
import type { PracticeIssue, PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import { prepareFound, prepareIssue, prepareTake } from "./practice.ts";

const viewer = { login: "fictif-volunteer", id: "U_fictif" };
const site = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "https://github.com/fictif-volunteer/my-first-site" },
  board: { id: "PVT_fictif", number: 1, url: "https://github.com/users/fictif-volunteer/projects/1", columns: ["Todo", "In Progress", "Done"] },
  issues: [], ...o,
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
