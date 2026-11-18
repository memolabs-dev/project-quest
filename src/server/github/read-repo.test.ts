import { describe, expect, it } from "vitest";
import { buildSite } from "../../shared/site.ts";
import { BoardNotFoundError } from "./errors.ts";
import { REPO_PATTERN, RepoNotPublicError, readRepo, repoToVisit, visitConfig, visitZone, type RepoIssue, type RepoResponse } from "./read-repo.ts";

const issue = (over: Partial<RepoIssue>): RepoIssue => ({
  id: `I_${over.number ?? 1}`, number: 1, title: "FICTIF issue", url: "https://github.com/fictif-org/fictif-site/issues/1",
  state: "OPEN", stateReason: null, updatedAt: "2026-11-18T10:00:00Z", issueType: null, parent: null, subIssuesSummary: { total: 0 },
  labels: { nodes: [] }, assignees: { nodes: [] }, closedByPullRequestsReferences: { totalCount: 0 }, ...over,
});
const someone = { nodes: [{ login: "fictif-dev", avatarUrl: "https://example.org/a.png" }] };
const response = (nodes: RepoIssue[], isPrivate = false): RepoResponse => ({
  repository: { isPrivate, nameWithOwner: "fictif-org/fictif-site", url: "https://github.com/fictif-org/fictif-site", stargazerCount: 42, issues: { nodes } },
});

describe("a visit's zones", () => {
  it("come from the issue itself: closed, under review, being laid, in stock", () => {
    expect(visitZone(issue({ state: "CLOSED" }))).toBe("Done");
    expect(visitZone(issue({ closedByPullRequestsReferences: { totalCount: 1 } }))).toBe("In review");
    expect(visitZone(issue({ assignees: someone }))).toBe("In progress");
    expect(visitZone(issue({}))).toBe("Backlog");
  });

  it("put an open pull request before the assignee: the work waits for review", () => {
    expect(visitZone(issue({ assignees: someone, closedByPullRequestsReferences: { totalCount: 1 } }))).toBe("In review");
  });
});

describe("a visit's site", () => {
  it("draws epics as buildings and their sub-issues as floors, with the repository's name and stars", () => {
    const v = repoToVisit(response([
      issue({ number: 1, subIssuesSummary: { total: 2 }, title: "FICTIF epic" }),
      issue({ number: 2, parent: { number: 1 }, state: "CLOSED", stateReason: "COMPLETED" }),
      issue({ number: 3, parent: { number: 1 }, labels: { nodes: [{ name: "bug" }] } }),
      issue({ number: 4, state: "CLOSED", stateReason: "NOT_PLANNED" }),
    ]), "2026-11-18T10:00:00Z");
    expect(v.repo).toEqual({ nameWithOwner: "fictif-org/fictif-site", url: "https://github.com/fictif-org/fictif-site", stars: 42 });
    const site = buildSite(v.board, visitConfig(v.repo.nameWithOwner));
    expect(site.zones.map((z) => z.name)).toEqual(["Backlog", "In progress", "In review", "Done"]);
    expect(site.buildings[0]).toMatchObject({ epicNumber: 1, floorsDone: 1, floorsTotal: 2 });
    expect(site.pallets.find((p) => p.number === 3)).toMatchObject({ isBug: true, zone: "Backlog", building: 1 });
    expect(site.pallets.find((p) => p.number === 4)).toMatchObject({ discarded: true });
  });

  it("refuses a private repository, even one the server's token can read", () => {
    expect(() => repoToVisit(response([issue({})], true), "2026-11-18T10:00:00Z")).toThrow(RepoNotPublicError);
    expect(() => repoToVisit({ repository: null }, "2026-11-18T10:00:00Z")).toThrow(RepoNotPublicError);
  });

  it("answers a missing repository like a private one, and asks GitHub nothing for a malformed name", async () => {
    const asked: unknown[] = [];
    const missing = (async (_q: string, v: Record<string, unknown>) => { asked.push(v); throw new BoardNotFoundError("not found"); }) as never;
    await expect(readRepo(missing, "fictif-org/nothing-here")).rejects.toThrow(RepoNotPublicError);
    await expect(readRepo(missing, "../../etc")).rejects.toThrow(RepoNotPublicError);
    expect(asked).toEqual([{ owner: "fictif-org", name: "nothing-here", request: { signal: expect.any(AbortSignal) } }]);
  });

  it("accepts GitHub's owner/name shapes only", () => {
    for (const ok of ["vitejs/vite", "memolabs-dev/project-quest", "a/b.c_d-e"]) expect(REPO_PATTERN.test(ok)).toBe(true);
    for (const bad of ["vite", "/vite", "a/b/c", "-a/b", "a b/c", "a/", "owner/name?x=1"]) expect(REPO_PATTERN.test(bad)).toBe(false);
  });
});
