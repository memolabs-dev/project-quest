// Reads the real project the game is configured on: its open issues marked for newcomers, with their comments.
import type { QuestConfig } from "../../shared/config.ts";
import type { RealSnapshot } from "../../shared/levels/types.ts";
import type { Gql } from "./client.ts";

export const GOOD_FIRST_QUERY = /* GraphQL */ `
  query GoodFirst($owner: String!, $name: String!, $labels: [String!]) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      issues(states: OPEN, labels: $labels, first: 30, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          id number title url
          assignees(first: 10) { nodes { login } }
          comments(last: 50) { nodes { author { login } url } }
        }
      }
    }
  }
`;

interface Response {
  repository: {
    nameWithOwner: string;
    issues: { nodes: {
      id: string; number: number; title: string; url: string;
      assignees: { nodes: { login: string }[] };
      comments: { nodes: { author: { login: string } | null; url: string }[] };
    }[] };
  } | null;
}

export async function readGoodFirst(gql: Gql, config: QuestConfig): Promise<RealSnapshot> {
  const { repository: r } = await gql<Response>(GOOD_FIRST_QUERY, { owner: config.owner, name: config.repo, labels: config.labels.goodFirst });
  return {
    repo: r?.nameWithOwner ?? `${config.owner}/${config.repo}`,
    issues: (r?.issues.nodes ?? []).map((i) => ({
      id: i.id, number: i.number, title: i.title, url: i.url,
      assignees: i.assignees.nodes.map((a) => a.login),
      // GitHub shows deleted accounts as "ghost".
      comments: i.comments.nodes.map((c) => ({ author: c.author?.login ?? "ghost", url: c.url })),
    })),
  };
}
