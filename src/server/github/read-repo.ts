// Reads a public repository's recent issues and lays them out as a board, for a read-only visit (#16).
// No Projects board is needed: each issue's zone comes from the issue itself.
import type { RepoInfo } from "../../shared/api.ts";
import type { QuestConfig } from "../../shared/config.ts";
import type { BoardItem, BoardSnapshot } from "../../shared/site.ts";
import type { Gql } from "./client.ts";
import { BoardNotFoundError } from "./errors.ts";

/** The zones of a visit, in order; their names are the board's, so they read the same in both languages. */
export const VISIT_ZONES = ["Backlog", "In progress", "In review", "Done"] as const;

/** owner/name as GitHub allows them: a visit never sends anything else to GitHub. */
export const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export const REPO_QUERY = /* GraphQL */ `
  query Visit($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      isPrivate
      nameWithOwner
      url
      stargazerCount
      issues(first: 100, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          id number title url state stateReason updatedAt
          issueType { name }
          parent { number }
          subIssuesSummary { total }
          labels(first: 20) { nodes { name } }
          assignees(first: 10) { nodes { login avatarUrl } }
          closedByPullRequestsReferences(first: 1) { totalCount }
        }
      }
    }
  }
`;

export interface RepoIssue {
  id: string; number: number; title: string; url: string; state: "OPEN" | "CLOSED"; stateReason: string | null; updatedAt: string;
  issueType: { name: string } | null;
  parent: { number: number } | null;
  subIssuesSummary: { total: number };
  labels: { nodes: { name: string }[] };
  assignees: { nodes: { login: string; avatarUrl: string }[] };
  /** Open pull requests that will close this issue (GitHub leaves closed ones out by default). */
  closedByPullRequestsReferences: { totalCount: number } | null;
}
export interface RepoResponse {
  repository: {
    isPrivate: boolean; nameWithOwner: string; url: string; stargazerCount: number;
    issues: { nodes: RepoIssue[] };
  } | null;
}

export interface Visit { repo: RepoInfo; board: BoardSnapshot }

/** Not found and private answer the same: a visit never tells whether a private repository exists. */
export class RepoNotPublicError extends Error {}

/** The zone an issue stands in, from its own state. */
export function visitZone(i: Pick<RepoIssue, "state" | "assignees" | "closedByPullRequestsReferences">): (typeof VISIT_ZONES)[number] {
  if (i.state === "CLOSED") return "Done";
  if ((i.closedByPullRequestsReferences?.totalCount ?? 0) > 0) return "In review";
  if (i.assignees.nodes.length > 0) return "In progress";
  return "Backlog";
}

/** The board a visit draws: every issue is an item, with its zone as status. Pure. */
export function repoToVisit(res: RepoResponse, fetchedAt: string): Visit {
  const r = res.repository;
  if (!r || r.isPrivate) throw new RepoNotPublicError("This repository is not public, or does not exist");
  const items: BoardItem[] = r.issues.nodes.map((c) => ({
    itemId: c.id, issueId: c.id, number: c.number, title: c.title, url: c.url, state: c.state, stateReason: c.stateReason ?? null,
    status: visitZone(c), size: null, parent: c.parent?.number ?? null,
    isEpic: c.issueType?.name === "Epic" || c.subIssuesSummary.total > 0,
    labels: c.labels.nodes.map((l) => l.name), assignees: c.assignees.nodes, updatedAt: c.updatedAt,
  }));
  return {
    repo: { nameWithOwner: r.nameWithOwner, url: r.url, stars: r.stargazerCount },
    board: { fetchedAt, projectId: "", statusFieldId: "", statusOptions: [], items },
  };
}

/** The configuration a visit is drawn with: its zones and the common bug and newcomer labels. */
export function visitConfig(nameWithOwner: string): QuestConfig {
  const [owner, repo] = nameWithOwner.split("/");
  return {
    owner, repo, projectNumber: 1,
    fields: { status: "Status", iteration: "Iteration", size: "Size" },
    zones: [...VISIT_ZONES],
    labels: { bug: ["bug", "type: bug", "kind/bug", "Bug"], trades: {}, goodFirst: ["good first issue"] },
  };
}

export async function readRepo(gql: Gql, nameWithOwner: string): Promise<Visit> {
  if (!REPO_PATTERN.test(nameWithOwner)) throw new RepoNotPublicError("Write the repository as owner/name");
  const [owner, name] = nameWithOwner.split("/");
  let res: RepoResponse;
  try {
    res = await gql<RepoResponse>(REPO_QUERY, { owner, name });
  } catch (e) {
    // GitHub answers NOT_FOUND for a missing repository: the visitor hears the same as for a private one.
    if (e instanceof BoardNotFoundError) throw new RepoNotPublicError("This repository is not public, or does not exist");
    throw e;
  }
  return repoToVisit(res, new Date().toISOString());
}
