// Whether the player already thanked with words on a laid pallet: a comment of theirs after the issue was closed.
// GitHub is the memory (people of the site spec, section 5): it stays true even when they thanked outside the game.
import type { QuestConfig } from "../../shared/config.ts";
import type { Gql } from "./client.ts";

export const THANKED_QUERY = /* GraphQL */ `
  query Thanked($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        closedAt
        comments(last: 100) { nodes { createdAt viewerDidAuthor } }
      }
    }
  }
`;

interface ThankedResponse {
  repository: { issue: { closedAt: string | null; comments: { nodes: { createdAt: string; viewerDidAuthor: boolean }[] } } | null } | null;
}

export async function readThanked(gql: Gql, config: QuestConfig, number: number): Promise<boolean> {
  const res = await gql<ThankedResponse>(THANKED_QUERY, { owner: config.owner, name: config.repo, number });
  const issue = res.repository?.issue;
  if (!issue?.closedAt) return false;
  // After the close, strictly: a comment of the same second is the one that closed it ("Closing as done"), not a thank-you.
  return issue.comments.nodes.some((c) => c.viewerDidAuthor && c.createdAt > issue.closedAt!);
}
