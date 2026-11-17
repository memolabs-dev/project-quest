// Reads a Projects (v2) board: its status field and every issue on it, 100 items per page.
import type { QuestConfig } from "../../shared/config.ts";
import type { BoardItem, BoardSnapshot } from "../../shared/site.ts";
import type { Gql } from "./client.ts";
import { BoardNotFoundError } from "./errors.ts";

export { BoardNotFoundError };

export const BOARD_QUERY = /* GraphQL */ `
  query Board($owner: String!, $number: Int!, $statusField: String!, $sizeField: String!, $after: String) {
    repositoryOwner(login: $owner) {
      ... on ProjectV2Owner {
        projectV2(number: $number) {
          id
          field(name: $statusField) { ... on ProjectV2SingleSelectField { id options { id name } } }
          items(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              updatedAt
              status: fieldValueByName(name: $statusField) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              size: fieldValueByName(name: $sizeField) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              content {
                __typename
                ... on Issue {
                  id number title url state stateReason
                  repository { nameWithOwner }
                  issueType { name }
                  parent { number }
                  subIssuesSummary { total }
                  labels(first: 20) { nodes { name } }
                  assignees(first: 10) { nodes { login avatarUrl } }
                  reactionGroups { content viewerHasReacted }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface IssueNode {
  __typename: "Issue";
  id: string; number: number; title: string; url: string; state: "OPEN" | "CLOSED"; stateReason: string | null;
  repository: { nameWithOwner: string };
  issueType: { name: string } | null;
  parent: { number: number } | null;
  subIssuesSummary: { total: number };
  labels: { nodes: { name: string }[] };
  assignees: { nodes: { login: string; avatarUrl: string }[] };
  /** Only the viewer's own reactions are kept: the game never counts anyone's. */
  reactionGroups?: { content: string; viewerHasReacted: boolean }[] | null;
}
interface ItemNode {
  id: string;
  updatedAt: string;
  status: { name: string } | null;
  size: { name: string } | null;
  content: IssueNode | { __typename: string } | null;
}
interface BoardResponse {
  repositoryOwner: {
    projectV2: {
      id: string;
      field: { id: string; options: { id: string; name: string }[] } | null;
      items: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ItemNode[] };
    } | null;
  } | null;
}


const isIssue = (c: ItemNode["content"]): c is IssueNode => c?.__typename === "Issue";

/** Only the configured repository's issues are read: a board mixing repositories would repeat issue numbers. */
export async function readBoard(gql: Gql, config: QuestConfig): Promise<BoardSnapshot> {
  const repo = `${config.owner}/${config.repo}`.toLowerCase();
  const items: BoardItem[] = [];
  let after: string | null = null;
  let project: NonNullable<NonNullable<BoardResponse["repositoryOwner"]>["projectV2"]>;
  do {
    const res: BoardResponse = await gql<BoardResponse>(BOARD_QUERY, {
      owner: config.owner, number: config.projectNumber, statusField: config.fields.status, sizeField: config.fields.size, after,
    });
    const p = res.repositoryOwner?.projectV2;
    if (!p) throw new BoardNotFoundError(`Project ${config.projectNumber} of ${config.owner} not found, or no access`);
    if (!p.field) throw new BoardNotFoundError(`The board has no single-select field named "${config.fields.status}"`);
    project = p;
    for (const n of p.items.nodes) {
      const c = n.content;
      if (!isIssue(c) || c.repository.nameWithOwner.toLowerCase() !== repo) continue;
      items.push({
        itemId: n.id, issueId: c.id, number: c.number, title: c.title, url: c.url, state: c.state, stateReason: c.stateReason ?? null,
        status: n.status?.name ?? null, size: n.size?.name ?? null, parent: c.parent?.number ?? null,
        isEpic: c.issueType?.name === "Epic" || c.subIssuesSummary.total > 0,
        labels: c.labels.nodes.map((l) => l.name), assignees: c.assignees.nodes, updatedAt: n.updatedAt,
        myReactions: (c.reactionGroups ?? []).filter((g) => g.viewerHasReacted).map((g) => g.content),
      });
    }
    after = p.items.pageInfo.hasNextPage ? p.items.pageInfo.endCursor : null;
  } while (after);
  return {
    fetchedAt: new Date().toISOString(), projectId: project.id, statusFieldId: project.field!.id,
    statusOptions: project.field!.options, items,
  };
}
