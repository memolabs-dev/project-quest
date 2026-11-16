// Reads the player's practice repository: its board (the first linked project) and its issues, with each
// issue's column on that board. Null when the repository does not exist yet.
import type { QuestConfig } from "../../shared/config.ts";
import type { PracticeSnapshot } from "../../shared/levels/types.ts";
import type { Gql } from "./client.ts";
import { BoardNotFoundError } from "./errors.ts";

export const PRACTICE_QUERY = /* GraphQL */ `
  query Practice($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id nameWithOwner url
      projectsV2(first: 1) {
        nodes { id number url field(name: "Status") { ... on ProjectV2SingleSelectField { options { name } } } }
      }
      issues(first: 50, orderBy: { field: CREATED_AT, direction: ASC }) {
        nodes {
          id number url closed
          author { login }
          assignees(first: 10) { nodes { login } }
          comments(first: 20) { nodes { author { login } url } }
          projectItems(first: 10) {
            nodes { project { number } status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } }
          }
        }
      }
    }
  }
`;

interface PracticeResponse {
  repository: {
    id: string; nameWithOwner: string; url: string;
    projectsV2: { nodes: { id: string; number: number; url: string; field: { options: { name: string }[] } | null }[] };
    issues: {
      nodes: {
        id: string; number: number; url: string; closed: boolean;
        author: { login: string } | null;
        assignees: { nodes: { login: string }[] };
        comments: { nodes: { author: { login: string } | null; url: string }[] };
        projectItems: { nodes: { project: { number: number }; status: { name: string } | null }[] };
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
  const p = r.projectsV2.nodes[0];
  const board = p ? { id: p.id, number: p.number, url: p.url, columns: (p.field?.options ?? []).map((o) => o.name) } : null;
  return {
    repo: { id: r.id, nameWithOwner: r.nameWithOwner, url: r.url },
    board,
    issues: r.issues.nodes.map((i) => ({
      id: i.id, number: i.number, url: i.url, closed: i.closed, author: login(i.author),
      assignees: i.assignees.nodes.map((a) => a.login),
      comments: i.comments.nodes.map((c) => ({ author: login(c.author), url: c.url })),
      status: board ? i.projectItems.nodes.find((n) => n.project.number === board.number)?.status?.name ?? null : null,
    })),
  };
}

/** A configuration for the practice board, so the existing board reader and site builder draw it. */
export function practiceConfig(owner: string, name: string, boardNumber: number, columns: string[]): QuestConfig {
  return {
    owner, repo: name, projectNumber: boardNumber,
    fields: { status: "Status", iteration: "Iteration", size: "Size" },
    zones: columns,
    labels: { bug: ["bug"], trades: {} },
  };
}
