import { describe, expect, it } from "vitest";
import { prepareEdit, prepareFound, prepareIssue } from "../../shared/gestures/practice.ts";
import { prepareCloseVisit, prepareMilestone, prepareRope, prepareSplit } from "../../shared/gestures/team.ts";
import type { PracticeSnapshot } from "../../shared/levels/types.ts";
import type { Gql } from "./client.ts";

/** A REST stand-in that must not be called. */
const noRest: Rest = async () => { throw new Error("REST was not expected here"); };
import { BoardNotFoundError, GitHubScopeError } from "./errors.ts";
import { applyPractice, type Rest } from "./practice-apply.ts";
import { readPractice } from "./read-practice.ts";

const viewer = { login: "fictif-volunteer", id: "U_fictif" };
const site: PracticeSnapshot = {
  repo: { id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "u" },
  board: { id: "PVT_fictif", number: 1, url: "b", columns: ["Todo", "Done"] },
  issues: [], defaultBranch: null, readme: null, branches: [], pulls: [], plan: null, mainHistory: [],
};

/** A fake GitHub answering each mutation with new ids, recording what it was sent. */
const recording = (failOn?: string) => {
  const calls: { query: string; input: Record<string, unknown> }[] = [];
  const gql = (async (query: string, variables: Record<string, unknown>) => {
    calls.push({ query, input: variables.input as Record<string, unknown> });
    if (failOn && query.includes(failOn)) throw Object.assign(new Error("boom"), { errors: [{ message: "GitHub said no" }] });
    if (query.includes("createRepository")) return { createRepository: { repository: { id: "R_new" } } };
    if (query.includes("createIssue")) return { createIssue: { issue: { id: "I_new" } } };
    return {};
  }) as Gql;
  return { gql, calls };
};

describe("applyPractice", () => {
  it("founding fills the new repository's id into the board's input", async () => {
    const { gql, calls } = recording();
    expect(await applyPractice(gql, noRest, prepareFound(viewer, null, "my-first-site", "PUBLIC"))).toEqual({ ok: true });
    expect(calls.map((c) => c.query.match(/\b(create\w+)\(/)?.[1])).toEqual(["createRepository", "createProjectV2"]);
    expect(calls[1].input).toEqual({ ownerId: "U_fictif", title: "my-first-site", repositoryId: "R_new" });
  });

  it("puts the new issue on the board with its id", async () => {
    const { gql, calls } = recording();
    await applyPractice(gql, noRest, prepareIssue(site, "FICTIF Paint the gate", ""));
    expect(calls[1].input).toEqual({ projectId: "PVT_fictif", contentId: "I_new" });
  });

  it("stops at the first refusal and says what was already done", async () => {
    const { gql, calls } = recording("createProjectV2");
    const r = await applyPractice(gql, noRest, prepareFound(viewer, null, "my-first-site", "PUBLIC"));
    expect(r).toEqual({ ok: false, reason: "github", message: "GitHub said no", applied: ["createRepository"] });
    expect(calls).toHaveLength(2);
  });
});

describe("a failure after a first write", () => {
  it("never hides what was already done, whatever GitHub throws", async () => {
    let n = 0;
    const gql = (async (query: string) => {
      n += 1;
      if (n === 2) throw new GitHubScopeError("no project scope");
      return query.includes("createRepository") ? { createRepository: { repository: { id: "R_new" } } } : {};
    }) as Gql;
    const r = await applyPractice(gql, noRest, prepareFound(viewer, null, "my-first-site", "PUBLIC"));
    expect(r).toMatchObject({ ok: false, applied: ["createRepository"] });
  });
});

describe("readPractice before the site exists", () => {
  it("reads a repository GitHub does not find as no site yet", async () => {
    const gql = (async () => { throw new BoardNotFoundError("not found"); }) as Gql;
    expect(await readPractice(gql, "fictif-volunteer", "my-first-site")).toBeNull();
  });
});

describe("editing a file", () => {
  const empty: PracticeSnapshot = {
    ...site, defaultBranch: null,
    issues: [{ id: "I_1", number: 1, url: "u", author: "fictif-volunteer", assignees: ["fictif-volunteer"], comments: [], status: null, closed: false }],
  };

  it("lays the README through REST, then branches from its commit", async () => {
    const { gql, calls } = recording();
    const restCalls: { method: string; path: string; body: unknown }[] = [];
    const rest: Rest = async (method, path, body) => { restCalls.push({ method, path, body }); return { commit: { sha: "f00d" } }; };
    expect(await applyPractice(gql, rest, prepareEdit(empty, viewer, 1, "# my-first-site\n\nBlue.\n", "Paint"))).toEqual({ ok: true });
    expect(restCalls).toEqual([{ method: "PUT", path: "/repos/fictif-volunteer/my-first-site/contents/README.md", body: { message: "Lay the foundation stone", content: expect.any(String) } }]);
    expect(calls.map((c) => c.query.match(/\b(create\w+)\(/)?.[1])).toEqual(["createRef", "createCommitOnBranch"]);
    expect(calls[0].input).toMatchObject({ oid: "f00d" });
    expect(calls[1].input).toMatchObject({ expectedHeadOid: "f00d" });
  });

  it("a moved branch is reported, not overwritten", async () => {
    const { gql } = recording("createCommitOnBranch");
    const moved: PracticeSnapshot = { ...empty, defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" }, branches: [{ name: "practice-1", oid: "b1", author: "fictif-volunteer", url: "c", readme: null, viaWeb: true, history: [] }] };
    const r = await applyPractice(gql, noRest, prepareEdit(moved, viewer, 1, "text", "fix"));
    expect(r).toEqual({ ok: false, reason: "github", message: "GitHub said no", applied: [] });
  });
});

describe("founding a team site", () => {
  it("fills the new board's and its status field's ids", async () => {
    const calls: { query: string; input: Record<string, unknown> }[] = [];
    const gql = (async (query: string, variables: Record<string, unknown>) => {
      calls.push({ query, input: variables.input as Record<string, unknown> });
      if (query.includes("createRepository")) return { createRepository: { repository: { id: "R_team" } } };
      if (query.includes("createProjectV2(")) return { createProjectV2: { projectV2: { id: "PVT_new", field: { id: "F_status_new" } } } };
      return {};
    }) as Gql;
    const { prepareFoundTeam } = await import("../../shared/gestures/team.ts");
    expect(await applyPractice(gql, noRest, prepareFoundTeam(viewer, null, "my-first-team", "PRIVATE"))).toEqual({ ok: true });
    expect(calls[1].input).toMatchObject({ repositoryId: "R_team" });
    expect(calls[2].input).toMatchObject({ fieldId: "F_status_new" });
    expect(calls[3].input).toMatchObject({ projectId: "PVT_new" });
  });
});

describe("the lead's REST step", () => {
  it("creates the milestone over REST and fills its id", async () => {
    const { gql, calls } = recording();
    const posted: { method: string; path: string; body: unknown }[] = [];
    const rest = (async (method: string, path: string, body: unknown) => {
      posted.push({ method, path, body });
      return { node_id: "MI_new", number: 1 };
    }) as Rest;
    const team: PracticeSnapshot = { ...site, repo: { id: "R_team", nameWithOwner: "fictif-lead/my-first-team", url: "u" },
      issues: [{ id: "I_2", number: 2, url: "u2", author: "fictif-lead", assignees: [], comments: [], status: "Backlog", closed: false }] };
    const r = await applyPractice(gql, rest, prepareMilestone(team, "FICTIF The mayor visits", "2026-11-29", [2], "2026-11-17"));
    expect(r).toEqual({ ok: true });
    expect(posted).toEqual([{ method: "POST", path: "/repos/fictif-lead/my-first-team/milestones", body: {
      title: "FICTIF The mayor visits", description: "Written by project-quest for practice.", due_on: "2026-11-29T12:00:00Z",
    } }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain("updateIssue");
    expect(calls[0].input).toEqual({ id: "I_2", milestoneId: "MI_new" });
  });
  it("stops with a clear message when GitHub gives back no id, never sending a placeholder", async () => {
    const { gql, calls } = recording();
    const rest = (async () => ({ number: 1 })) as Rest;
    const team: PracticeSnapshot = { ...site, repo: { id: "R_team", nameWithOwner: "fictif-lead/my-first-team", url: "u" },
      issues: [{ id: "I_2", number: 2, url: "u2", author: "a", assignees: [], comments: [], status: "Backlog", closed: false }] };
    const r = await applyPractice(gql, rest, prepareMilestone(team, "FICTIF Visit", "2026-11-29", [2], "2026-11-17"));
    expect(r).toMatchObject({ ok: false, reason: "github", applied: ["createMilestone"] });
    expect((r as { message: string }).message).toMatch(/milestoneId/);
    expect(calls).toEqual([]);
  });
  it("updates the milestone over REST", async () => {
    const { gql, calls } = recording();
    const sent: { method: string; path: string; body: unknown }[] = [];
    const rest = (async (method: string, path: string, body: unknown) => { sent.push({ method, path, body }); return {}; }) as Rest;
    const team: PracticeSnapshot = { ...site, repo: { id: "R_team", nameWithOwner: "fictif-lead/my-first-team", url: "u" },
      milestones: [{ id: "MI_1", number: 1, title: "FICTIF Visit", dueOn: null, url: "m", closed: false, openIssues: 0, closedIssues: 1 }] };
    expect(await applyPractice(gql, rest, prepareCloseVisit(team, 1))).toEqual({ ok: true });
    expect(sent).toEqual([{ method: "PATCH", path: "/repos/fictif-lead/my-first-team/milestones/1", body: { state: "closed" } }]);
    expect(calls).toEqual([]);
  });
  it("knows the Site manager's mutations", async () => {
    const { gql, calls } = recording();
    const team: PracticeSnapshot = { ...site, issues: [
      { id: "I_2", number: 2, url: "u2", author: "a", assignees: [], comments: [], status: "Backlog", closed: false },
      { id: "I_3", number: 3, url: "u3", author: "a", assignees: [], comments: [], status: "Backlog", closed: false },
    ] };
    await applyPractice(gql, noRest, prepareRope(team, 3, 2));
    await applyPractice(gql, noRest, prepareSplit(team, 2, ["a", "b"]));
    expect(calls.map((c) => c.query.match(/\{ (\w+)\(input/)?.[1])).toEqual(["addBlockedBy", "createIssue", "addProjectV2ItemById", "addSubIssue", "createIssue", "addProjectV2ItemById", "addSubIssue"]);
    expect(calls[3].input).toEqual({ issueId: "I_2", subIssueId: "I_new" });
  });
});

describe("a repository the game cannot see", () => {
  it("explains a name already taken: the token may not reach a private repository", async () => {
    const { gql } = recording("createRepository");
    const failing = (async (q: string, v: Record<string, unknown>) => {
      if (q.includes("createRepository")) throw Object.assign(new Error("x"), { errors: [{ message: "Name already exists on this account" }] });
      return gql(q, v);
    }) as Gql;
    const r = await applyPractice(failing, noRest, prepareFound(viewer, null, "my-first-site", "PRIVATE"));
    expect(r).toMatchObject({ ok: false, reason: "github" });
    expect((r as { message: string }).message).toMatch(/already exists.*repo.*scope/i);
  });
});
