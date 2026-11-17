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
          comments(last: 50) { nodes { author { login } url createdAt } }
        }
      }
    }
  }
`;

/** One issue, whatever its age: the ask is checked on the very issue the player picked. */
export const ONE_ISSUE_QUERY = /* GraphQL */ `
  query OneIssue($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      issue(number: $number) {
        id number title url state
        labels(first: 30) { nodes { name } }
        assignees(first: 10) { nodes { login } }
        comments(last: 50) { nodes { author { login } url createdAt } }
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
      comments: { nodes: { author: { login: string } | null; url: string; createdAt: string }[] };
    }[] };
  } | null;
}

type IssueNode = NonNullable<Response["repository"]>["issues"]["nodes"][number];

const toIssue = (i: IssueNode) => ({
  id: i.id, number: i.number, title: i.title, url: i.url,
  assignees: i.assignees.nodes.map((a) => a.login),
  // GitHub shows deleted accounts as "ghost".
  comments: i.comments.nodes.map((c) => ({ author: c.author?.login ?? "ghost", url: c.url, createdAt: c.createdAt })),
});

/** The project's open good first issues; with `number`, only that issue, and only if it is one. */
export async function readGoodFirst(gql: Gql, config: QuestConfig, number?: number): Promise<RealSnapshot> {
  const home = `${config.owner}/${config.repo}`;
  if (number !== undefined) {
    const { repository: r } = await gql<{ repository: { nameWithOwner: string; issue: (IssueNode & { state: string; labels: { nodes: { name: string }[] } }) | null } | null }>(
      ONE_ISSUE_QUERY, { owner: config.owner, name: config.repo, number },
    );
    const i = r?.issue;
    const marked = i && i.state === "OPEN" && i.labels.nodes.some((l) => config.labels.goodFirst.includes(l.name));
    return { repo: r?.nameWithOwner ?? home, issues: marked ? [toIssue(i)] : [] };
  }
  const { repository: r } = await gql<Response>(GOOD_FIRST_QUERY, { owner: config.owner, name: config.repo, labels: config.labels.goodFirst });
  return { repo: r?.nameWithOwner ?? home, issues: (r?.issues.nodes ?? []).map(toIssue) };
}
