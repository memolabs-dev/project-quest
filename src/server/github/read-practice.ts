// Reads the player's practice repository: its board (the viewer's own linked project) and its newest issues,
// with each issue's column on that board. Null when the repository does not exist yet.
import type { QuestConfig } from "../../shared/config.ts";
import type { PracticeSnapshot } from "../../shared/levels/types.ts";
import type { Gql } from "./client.ts";
import { BoardNotFoundError } from "./errors.ts";

export const PRACTICE_QUERY = /* GraphQL */ `
  query Practice($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id nameWithOwner url
      defaultBranchRef { name target { oid ... on Commit { committedDate history(first: 50) { nodes { oid } } } } }
      plan: object(expression: "HEAD:PLAN.md") { ... on Blob { text } }
      object(expression: "HEAD:README.md") { ... on Blob { text } }
      refs(refPrefix: "refs/heads/", first: 20) {
        nodes { name target { ... on Commit {
          oid url committedViaWeb author { user { login } } file(path: "README.md") { object { ... on Blob { text } } }
          history(first: 30) { nodes { oid committedDate committedViaWeb } }
        } } }
      }
      pullRequests(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          id number url state createdAt headRefName headRefOid
          author { login }
          closingIssuesReferences(first: 5) { nodes { number repository { nameWithOwner } } }
          commits(last: 20) { nodes { commit { oid url committedDate committedViaWeb } } }
        }
      }
      projectsV2(first: 20) {
        nodes {
          id number url title
          owner { ... on User { login } ... on Organization { login } }
          field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
          fields(first: 30) {
            nodes { ... on ProjectV2FieldCommon { id name dataType } ... on ProjectV2SingleSelectField { options { id name } } }
          }
        }
      }
      labels(first: 50) { nodes { id name } }
      issues(first: 50, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          id number url closed body stateReason
          duplicateOf { number }
          labels(first: 20) { nodes { name } }
          author { login }
          assignees(first: 10) { nodes { login } }
          comments(first: 20) { nodes { author { login } url } }
          projectItems(first: 10) {
            nodes {
              id project { id number }
              status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              size: fieldValueByName(name: "Size") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
            }
          }
        }
      }
    }
  }
`;

interface PracticeResponse {
  repository: {
    id: string; nameWithOwner: string; url: string;
    defaultBranchRef: { name: string; target: { oid: string; committedDate: string; history?: { nodes: { oid: string }[] } } } | null;
    plan: { text?: string } | null;
    object: { text?: string } | null;
    refs: { nodes: { name: string; target: {
      oid?: string; url?: string; committedViaWeb?: boolean; author?: { user: { login: string } | null };
      file?: { object: { text?: string } | null } | null;
      history?: { nodes: { oid: string; committedDate: string; committedViaWeb: boolean }[] };
    } }[] };
    pullRequests: { nodes: {
      id: string; number: number; url: string; state: "OPEN" | "CLOSED" | "MERGED"; createdAt: string;
      headRefName: string; headRefOid: string; author: { login: string } | null;
      closingIssuesReferences: { nodes: { number: number; repository: { nameWithOwner: string } }[] };
      commits: { nodes: { commit: { oid: string; url: string; committedDate: string; committedViaWeb: boolean } }[] };
    }[] };
    projectsV2: { nodes: {
      id: string; number: number; url: string; title: string; owner: { login?: string } | null;
      field: { id?: string; options: { id: string; name: string }[] } | null;
      fields?: { nodes: { id?: string; name?: string; dataType?: string; options?: { id: string; name: string }[] }[] };
    }[] };
    labels?: { nodes: { id: string; name: string }[] };
    issues: {
      nodes: {
        id: string; number: number; url: string; closed: boolean; body?: string; stateReason?: string | null;
        duplicateOf?: { number: number } | null;
        labels?: { nodes: { name: string }[] };
        author: { login: string } | null;
        assignees: { nodes: { login: string }[] };
        comments: { nodes: { author: { login: string } | null; url: string }[] };
        projectItems: { nodes: {
          id?: string; project: { id: string; number: number }; status: { name: string } | null; size?: { name?: string } | null;
        }[] };
      }[];
    };
  } | null;
}

/** GitHub shows deleted accounts as "ghost". */
const login = (a: { login: string } | null) => a?.login ?? "ghost";

export async function readPractice(gql: Gql, owner: string, name: string): Promise<PracticeSnapshot | null> {
  let r: PracticeResponse["repository"];
  try {
    ({ repository: r } = await gql<PracticeResponse>(PRACTICE_QUERY, { owner, name }));
  } catch (e) {
    // GitHub answers a repository that does not exist with NOT_FOUND: the site is not founded yet.
    if (e instanceof BoardNotFoundError) return null;
    throw e;
  }
  if (!r) return null;
  // The board is the viewer's own project linked to the repository (the one named after it first): a linked
  // project of another owner is never played, its number would point at a different board of the viewer.
  const owned = r.projectsV2.nodes.filter((n) => n.owner?.login?.toLowerCase() === owner.toLowerCase());
  const p = owned.find((n) => n.title === name) ?? owned[0];
  const here = (repo: { nameWithOwner: string }) => repo.nameWithOwner.toLowerCase() === r.nameWithOwner.toLowerCase();
  const columns = (p?.field?.options ?? []).map((o) => o.name);
  const board = p ? {
    id: p.id, number: p.number, url: p.url, columns,
    statusFieldId: p.field?.id ?? "",
    statusOptions: columns,
    statusOptionIds: p.field?.options ?? [],
    fields: (p.fields?.nodes ?? []).filter((f) => f.id && f.name).map((f) => ({
      id: f.id!, name: f.name!, dataType: f.dataType ?? "", ...(f.options ? { options: f.options } : {}),
    })),
  } : null;
  return {
    repo: { id: r.id, nameWithOwner: r.nameWithOwner, url: r.url },
    board,
    labels: r.labels?.nodes ?? [],
    issues: r.issues.nodes.map((i) => {
      const item = board ? i.projectItems.nodes.find((n) => n.project.id === board.id) : undefined;
      return {
        id: i.id, number: i.number, url: i.url, closed: i.closed, author: login(i.author),
        assignees: i.assignees.nodes.map((a) => a.login),
        comments: i.comments.nodes.map((c) => ({ author: login(c.author), url: c.url })),
        status: item?.status?.name ?? null,
        labels: (i.labels?.nodes ?? []).map((l) => l.name),
        body: i.body ?? "",
        stateReason: i.stateReason ?? null,
        duplicateOf: i.duplicateOf?.number ?? null,
        itemId: item?.id ?? null,
        size: item?.size?.name ?? null,
      };
    }),
    defaultBranch: r.defaultBranchRef
      ? { name: r.defaultBranchRef.name, oid: r.defaultBranchRef.target.oid, committedDate: r.defaultBranchRef.target.committedDate }
      : null,
    plan: r.plan?.text ?? null,
    mainHistory: (r.defaultBranchRef?.target.history?.nodes ?? []).map((n) => n.oid),
    readme: r.object?.text ?? null,
    branches: r.refs.nodes
      .filter((b) => b.name !== r.defaultBranchRef?.name && b.target.oid)
      .map((b) => ({
        name: b.name, oid: b.target.oid!, author: b.target.author?.user?.login ?? "ghost", url: b.target.url ?? "",
        readme: b.target.file?.object?.text ?? null,
        viaWeb: b.target.committedViaWeb ?? true,
        history: (b.target.history?.nodes ?? []).map((h) => ({ oid: h.oid, committedDate: h.committedDate, viaWeb: h.committedViaWeb })),
      })),
    pulls: r.pullRequests.nodes.map((pr) => ({
      id: pr.id, number: pr.number, url: pr.url, author: login(pr.author), state: pr.state, createdAt: pr.createdAt,
      headRefName: pr.headRefName, headRefOid: pr.headRefOid,
      closes: pr.closingIssuesReferences.nodes.filter((n) => here(n.repository)).map((n) => n.number),
      closesElsewhere: pr.closingIssuesReferences.nodes.filter((n) => !here(n.repository)).map((n) => `${n.repository.nameWithOwner}#${n.number}`),
      commits: pr.commits.nodes.map(({ commit: c }) => ({ oid: c.oid, url: c.url, committedDate: c.committedDate, viaWeb: c.committedViaWeb })),
    })),
  };
}

/** A configuration for the practice board, so the existing board reader and site builder draw it. */
export function practiceConfig(owner: string, name: string, boardNumber: number, columns: string[]): QuestConfig {
  return {
    owner, repo: name, projectNumber: boardNumber,
    fields: { status: "Status", iteration: "Iteration", size: "Size" },
    zones: columns,
    labels: { bug: ["bug"], trades: {}, goodFirst: [] },
  };
}
