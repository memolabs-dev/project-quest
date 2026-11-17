import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Gql } from "./client.ts";
import { PRACTICE_QUERY, practiceConfig, readPractice } from "./read-practice.ts";

const fixture = JSON.parse(readFileSync(new URL("./__fixtures__/practice-response.json", import.meta.url), "utf8")) as {
  repository: { projectsV2: { nodes: unknown[] } };
};
const gqlReturning = (data: unknown): Gql => (async () => data) as Gql;

describe("readPractice", () => {
  it("maps the repository, its board and its issues", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.repo).toEqual({ id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "https://github.com/fictif-volunteer/my-first-site" });
    expect(p?.board).toMatchObject({ id: "PVT_fictif", number: 3, url: "https://github.com/users/fictif-volunteer/projects/3", columns: ["Todo", "In Progress", "Done"] });
    expect(p?.issues[0]).toMatchObject({
      id: "I_fictif_1", number: 1, url: "https://github.com/fictif-volunteer/my-first-site/issues/1", author: "fictif-volunteer",
      assignees: ["fictif-volunteer"], closed: false, status: "In Progress",
      comments: [{ author: "fictif-volunteer", url: "https://github.com/fictif-volunteer/my-first-site/issues/1#issuecomment-1" }],
    });
  });
  it("takes the status from the practice board only, and survives deleted accounts", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.issues[1]).toMatchObject({ author: "ghost", status: null, closed: true, comments: [{ author: "ghost" }] });
  });
  it("has no board when none is linked", async () => {
    const data = structuredClone(fixture);
    data.repository.projectsV2.nodes = [];
    const p = await readPractice(gqlReturning(data), "fictif-volunteer", "my-first-site");
    expect(p?.board).toBeNull();
    expect(p?.issues[0].status).toBeNull();
  });
  it("returns null when the repository does not exist", async () => {
    expect(await readPractice(gqlReturning({ repository: null }), "fictif-volunteer", "my-first-site")).toBeNull();
  });
});

describe("branches, README and pull requests", () => {
  it("maps branches, the README and pull requests", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.defaultBranch).toMatchObject({ name: "main", oid: "aaa111" });
    expect(p?.readme).toBe("# my-first-site\n");
    expect(p?.branches).toMatchObject([
      { name: "practice-1", oid: "bbb222", author: "fictif-volunteer", url: "https://github.com/fictif-volunteer/my-first-site/commit/bbb222", readme: "# README at practice-1\n" },
      { name: "orphan", oid: "ccc333", author: "ghost", url: "https://github.com/fictif-volunteer/my-first-site/commit/ccc333", readme: null },
    ]);
    expect(p?.pulls).toMatchObject([{
      id: "PR_fictif_2", number: 2, url: "https://github.com/fictif-volunteer/my-first-site/pull/2", author: "fictif-volunteer", state: "OPEN",
      createdAt: "2026-11-17T10:00:00Z", headRefName: "practice-1", headRefOid: "bbb222", closes: [1], closesElsewhere: ["fictif-org/real-repo#3"],
      commits: [
        { oid: "bbb111", url: "https://github.com/fictif-volunteer/my-first-site/commit/bbb111", committedDate: "2026-11-17T09:59:00Z" },
        { oid: "bbb222", url: "https://github.com/fictif-volunteer/my-first-site/commit/bbb222", committedDate: "2026-11-17T10:05:00Z" },
      ],
    }]);
  });
  it("reads an empty repository as no default branch, no README, no branches", async () => {
    const data = structuredClone(fixture) as Record<string, Record<string, unknown>>;
    Object.assign(data.repository, { defaultBranchRef: null, object: null, plan: null, refs: { nodes: [] }, pullRequests: { nodes: [] } });
    const p = await readPractice(gqlReturning(data), "fictif-volunteer", "my-first-site");
    expect(p).toMatchObject({ defaultBranch: null, readme: null, branches: [], pulls: [], plan: null });
  });
});

describe("how each commit was made", () => {
  it("maps each branch's history and how its commits were made", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.defaultBranch).toEqual({ name: "main", oid: "aaa111", committedDate: "2026-11-17T08:00:00Z" });
    expect(p?.plan).toBe("# Plan\n");
    const b = p?.branches.find((x) => x.name === "practice-1");
    expect(b).toMatchObject({ viaWeb: false, history: [
      { oid: "bbb222", committedDate: "2026-11-17T09:00:00Z", viaWeb: false },
      { oid: "aaa111", committedDate: "2026-11-17T08:00:00Z", viaWeb: true },
    ] });
    expect(p?.pulls[0].commits.map((c) => c.viaWeb)).toEqual([true, false]);
  });
});

describe("what the lead's levels need", () => {
  it("maps the board's fields, the repository's labels and each issue's labels, body, close reason and size", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.board).toMatchObject({ statusFieldId: "PVTSSF_status", statusOptions: ["Todo", "In Progress", "Done"] });
    expect(p?.board?.fields?.find((f) => f.name === "Size")).toEqual({
      id: "PVTSSF_size", name: "Size", dataType: "SINGLE_SELECT", options: [{ id: "s1", name: "XS" }, { id: "s2", name: "S" }],
    });
    expect(p?.labels).toEqual([{ id: "LA_bug", name: "bug" }, { id: "LA_enh", name: "enhancement" }]);
    expect(p?.issues[0]).toMatchObject({ labels: ["bug"], body: "FICTIF body\n- [ ] one", stateReason: null, duplicateOf: null, itemId: "PVTI_1_3", size: "S" });
    expect(p?.issues[1]).toMatchObject({ labels: [], stateReason: "DUPLICATE", duplicateOf: 1, itemId: "PVTI_2_3", size: null });
  });
  it("maps the sprint field's iterations, each item's sprint, the milestones, sub-issues and what blocks each issue", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.board?.fields?.find((f) => f.name === "Sprint")).toEqual({
      id: "PVTIF_sprint", name: "Sprint", dataType: "ITERATION",
      iterations: [
        { id: "it1", title: "Sprint 1", startDate: "2026-11-10", duration: 7 },
        { id: "it2", title: "Sprint 2", startDate: "2026-11-17", duration: 7 },
      ],
    });
    expect(p?.milestones).toEqual([{
      id: "MI_1", number: 1, title: "FICTIF The mayor visits", dueOn: "2026-11-29T12:00:00Z",
      url: "https://github.com/fictif-volunteer/my-first-site/milestone/1", closed: false,
    }]);
    expect(p?.issues[0]).toMatchObject({ iteration: "it2", milestone: 1, subIssues: [2, 5], blockedBy: [] });
    expect(p?.issues[1]).toMatchObject({ iteration: null, milestone: null, subIssues: [], blockedBy: [1] });
  });
});

describe("the practice board", () => {
  it("is the viewer's own board, never a project of another owner linked to the repository", async () => {
    const data = structuredClone(fixture) as { repository: { projectsV2: { nodes: unknown[] } } };
    data.repository.projectsV2.nodes = [
      { id: "PVT_org", number: 3, url: "https://github.com/orgs/fictif-org/projects/3", title: "my-first-site", owner: { login: "fictif-org" }, field: { options: [{ name: "Todo" }] } },
      { id: "PVT_other", number: 4, url: "https://github.com/users/fictif-volunteer/projects/4", title: "Something else", owner: { login: "fictif-volunteer" }, field: { options: [{ name: "Todo" }] } },
      { id: "PVT_mine", number: 5, url: "https://github.com/users/fictif-volunteer/projects/5", title: "my-first-site", owner: { login: "Fictif-Volunteer" }, field: { options: [{ name: "Todo" }] } },
    ];
    expect((await readPractice(gqlReturning(data), "fictif-volunteer", "my-first-site"))?.board?.id).toBe("PVT_mine");
    data.repository.projectsV2.nodes = data.repository.projectsV2.nodes.slice(0, 1);
    expect((await readPractice(gqlReturning(data), "fictif-volunteer", "my-first-site"))?.board).toBeNull();
  });
  it("reads the newest issues first, so a reused repository's old issues do not hide the new ones", () => {
    expect(PRACTICE_QUERY).toMatch(/issues\(first: 50, orderBy: \{ field: CREATED_AT, direction: DESC \}/);
  });
});

describe("practiceConfig", () => {
  it("draws the practice board with the existing site code: its columns are the zones", () => {
    const c = practiceConfig("fictif-volunteer", "my-first-site", 3, ["Todo", "In Progress", "Done"]);
    expect(c).toMatchObject({ owner: "fictif-volunteer", repo: "my-first-site", projectNumber: 3, zones: ["Todo", "In Progress", "Done"] });
    expect(c.fields.status).toBe("Status");
  });
});
