// The open pull requests of first-time authors the player has not yet written to (welcome and answer spec, section 3).
// GitHub's own authorAssociation says who is new: nothing is guessed and no history is read.
import type { QuestConfig } from "../../shared/config.ts";
import { NEWCOMER, type Newcomer } from "../../shared/people.ts";
import type { Gql } from "./client.ts";

export const NEWCOMERS_QUERY = /* GraphQL */ `
  query Newcomers($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      url
      contributing: object(expression: "HEAD:CONTRIBUTING.md") { id }
      pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          id number title url authorAssociation
          author { __typename login avatarUrl }
          closingIssuesReferences(first: 5) { nodes { number } }
          comments(last: 100) { nodes { viewerDidAuthor } }
          reviews(last: 20) { nodes { viewerDidAuthor } }
        }
      }
    }
  }
`;

interface NewcomersResponse {
  repository: {
    url: string;
    contributing: { id: string } | null;
    pullRequests: { nodes: {
      id: string; number: number; title: string; url: string; authorAssociation: string;
      author: { __typename: string; login: string; avatarUrl: string } | null;
      closingIssuesReferences: { nodes: { number: number }[] } | null;
      comments: { nodes: { viewerDidAuthor: boolean }[] };
      /** A welcome written as a review counts too; absent in older fixtures. */
      reviews?: { nodes: { viewerDidAuthor: boolean }[] } | null;
    }[] };
  } | null;
}

/**
 * One entry per person: their most recently updated first pull request (the query's order). A person the player already
 * wrote to, by a comment or a review on any of their pull requests, is not new to the player any more.
 */
export async function readNewcomers(gql: Gql, config: QuestConfig): Promise<Newcomer[]> {
  const res = await gql<NewcomersResponse>(NEWCOMERS_QUERY, { owner: config.owner, name: config.repo });
  const repo = res.repository;
  if (!repo) return [];
  const contributingUrl = repo.contributing ? `${repo.url}/blob/HEAD/CONTRIBUTING.md` : null;
  const pulls = repo.pullRequests.nodes;
  const wrote = (p: (typeof pulls)[number]) => [...p.comments.nodes, ...(p.reviews?.nodes ?? [])].some((c) => c.viewerDidAuthor);
  const welcomed = new Set(pulls.filter(wrote).flatMap((p) => (p.author ? [p.author.login] : [])));
  const seen = new Set<string>();
  return pulls
    // Only a person: a bot has no [bot] suffix in GraphQL (its type says it), a mannequin is an imported account.
    .filter((p) => (NEWCOMER as readonly string[]).includes(p.authorAssociation) && p.author?.__typename === "User" && !p.author.login.endsWith("[bot]"))
    .filter((p) => !welcomed.has(p.author!.login) && !seen.has(p.author!.login) && seen.add(p.author!.login))
    .map((p) => ({
      login: p.author!.login, avatarUrl: p.author!.avatarUrl,
      pr: { id: p.id, number: p.number, title: p.title, url: p.url },
      pallet: null, closes: (p.closingIssuesReferences?.nodes ?? []).map((n) => n.number), contributingUrl,
    }));
}
