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
    expect(p?.board).toEqual({ id: "PVT_fictif", number: 3, url: "https://github.com/users/fictif-volunteer/projects/3", columns: ["Todo", "In Progress", "Done"] });
    expect(p?.issues[0]).toEqual({
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
    expect(p?.defaultBranch).toEqual({ name: "main", oid: "aaa111" });
    expect(p?.readme).toBe("# my-first-site\n");
    expect(p?.branches).toEqual([
      { name: "practice-1", oid: "bbb222", author: "fictif-volunteer", url: "https://github.com/fictif-volunteer/my-first-site/commit/bbb222", readme: "# README at practice-1\n" },
      { name: "orphan", oid: "ccc333", author: "ghost", url: "https://github.com/fictif-volunteer/my-first-site/commit/ccc333", readme: null },
    ]);
    expect(p?.pulls).toEqual([{
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
    Object.assign(data.repository, { defaultBranchRef: null, object: null, refs: { nodes: [] }, pullRequests: { nodes: [] } });
    const p = await readPractice(gqlReturning(data), "fictif-volunteer", "my-first-site");
    expect(p).toMatchObject({ defaultBranch: null, readme: null, branches: [], pulls: [] });
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
