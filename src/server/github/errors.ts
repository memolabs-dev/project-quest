// GitHub's failures, turned into errors the game can explain with the right command to run.
import { GitHubAuthError, type Gql } from "./client.ts";

/** The token works but lacks the `project` scope (`gh auth login` does not grant it by default). */
export class GitHubScopeError extends Error {}
/** The configured project does not exist, or this account cannot see it. */
export class BoardNotFoundError extends Error {}

const typesOf = (e: unknown) => ((e as { errors?: { type?: string }[] }).errors ?? []).map((x) => x.type);

export function withGitHubErrors(gql: Gql): Gql {
  return (async (query: string, variables: Record<string, unknown>) => {
    try {
      return await gql(query, variables);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const types = typesOf(e);
      if (types.includes("INSUFFICIENT_SCOPES")) throw new GitHubScopeError("The GitHub login lacks the project scope: run `gh auth refresh -s project`");
      if (types.includes("NOT_FOUND")) throw new BoardNotFoundError("The project in quest.config.json was not found, or this account cannot see it");
      if (status === 401 || status === 403 || types.includes("FORBIDDEN")) throw new GitHubAuthError("GitHub refused the login: run `gh auth login`");
      throw e;
    }
  }) as Gql;
}
