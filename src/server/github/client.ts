// The one door to GitHub. The token stays on the server: GITHUB_TOKEN if set, else the player's `gh` login.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { graphql } from "@octokit/graphql";

export type Gql = <T>(query: string, variables: Record<string, unknown>) => Promise<T>;

export class GitHubAuthError extends Error {}

export async function githubToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    // QUEST_GH_BIN points at another gh binary (tests use a missing one to play without access).
    const { stdout } = await promisify(execFile)(process.env.QUEST_GH_BIN ?? "gh", ["auth", "token"]);
    const token = stdout.trim();
    if (token) return token;
  } catch {
    // fall through to the error below
  }
  throw new GitHubAuthError("No GitHub access: run `gh auth login`, or set GITHUB_TOKEN");
}

export async function githubGql(): Promise<Gql> {
  const client = graphql.defaults({ headers: { authorization: `token ${await githubToken()}` } });
  const { withGitHubErrors } = await import("./errors.ts");
  return withGitHubErrors(<T>(query: string, variables: Record<string, unknown>) => client<T>(query, variables));
}

export type Rest = (method: "PUT" | "POST", path: string, body: Record<string, unknown>) => Promise<unknown>;

/** The REST door, for the writes GraphQL cannot do: the first commit of an empty repository, a milestone. */
export async function githubRest(): Promise<Rest> {
  const token = await githubToken();
  return async (method, path, body) => {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: { authorization: `token ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 401) throw new GitHubAuthError("GitHub refused the login: run `gh auth login`");
    // Shaped like a GraphQL error, so a refusal is reported to the player with what was already done.
    if (!res.ok) throw Object.assign(new Error(json.message ?? `GitHub answered ${res.status}`), { errors: [{ message: json.message ?? `GitHub answered ${res.status}` }] });
    return json;
  };
}
