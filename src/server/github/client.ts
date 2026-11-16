// The one door to GitHub. The token stays on the server: GITHUB_TOKEN if set, else the player's `gh` login.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { graphql } from "@octokit/graphql";

export type Gql = <T>(query: string, variables: Record<string, unknown>) => Promise<T>;

export class GitHubAuthError extends Error {}

export async function githubToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { stdout } = await promisify(execFile)("gh", ["auth", "token"]);
    const token = stdout.trim();
    if (token) return token;
  } catch {
    // fall through to the error below
  }
  throw new GitHubAuthError("No GitHub access: run `gh auth login`, or set GITHUB_TOKEN");
}

export async function githubGql(): Promise<Gql> {
  const client = graphql.defaults({ headers: { authorization: `token ${await githubToken()}` } });
  return <T>(query: string, variables: Record<string, unknown>) => client<T>(query, variables);
}
