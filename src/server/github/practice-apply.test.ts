import { describe, expect, it } from "vitest";
import { prepareFound, prepareIssue } from "../../shared/gestures/practice.ts";
import type { PracticeSnapshot } from "../../shared/levels/types.ts";
import type { Gql } from "./client.ts";
import { BoardNotFoundError, GitHubScopeError } from "./errors.ts";
import { applyPractice } from "./practice-apply.ts";
import { readPractice } from "./read-practice.ts";

const viewer = { login: "fictif-volunteer", id: "U_fictif" };
const site: PracticeSnapshot = {
  repo: { id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "u" },
  board: { id: "PVT_fictif", number: 1, url: "b", columns: ["Todo", "Done"] },
  issues: [],
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
    expect(await applyPractice(gql, prepareFound(viewer, null, "my-first-site", "PUBLIC"))).toEqual({ ok: true });
    expect(calls.map((c) => c.query.match(/\b(create\w+)\(/)?.[1])).toEqual(["createRepository", "createProjectV2"]);
    expect(calls[1].input).toEqual({ ownerId: "U_fictif", title: "my-first-site", repositoryId: "R_new" });
  });

  it("puts the new issue on the board with its id", async () => {
    const { gql, calls } = recording();
    await applyPractice(gql, prepareIssue(site, "FICTIF Paint the gate", ""));
    expect(calls[1].input).toEqual({ projectId: "PVT_fictif", contentId: "I_new" });
  });

  it("stops at the first refusal and says what was already done", async () => {
    const { gql, calls } = recording("createProjectV2");
    const r = await applyPractice(gql, prepareFound(viewer, null, "my-first-site", "PUBLIC"));
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
    const r = await applyPractice(gql, prepareFound(viewer, null, "my-first-site", "PUBLIC"));
    expect(r).toMatchObject({ ok: false, applied: ["createRepository"] });
  });
});

describe("readPractice before the site exists", () => {
  it("reads a repository GitHub does not find as no site yet", async () => {
    const gql = (async () => { throw new BoardNotFoundError("not found"); }) as Gql;
    expect(await readPractice(gql, "fictif-volunteer", "my-first-site")).toBeNull();
  });
});
