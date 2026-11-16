import { describe, expect, it } from "vitest";
import { GitHubAuthError, type Gql } from "./client.ts";
import { BoardNotFoundError, GitHubScopeError, withGitHubErrors } from "./errors.ts";

const failing = (error: unknown): Gql => (async () => { throw error; }) as Gql;
const graphqlError = (type: string) => Object.assign(new Error("GraphQL error"), { name: "GraphqlResponseError", errors: [{ type, message: type }] });
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { name: "HttpError", status });

describe("GitHub errors", () => {
  it("turns a missing project scope into a scope error with the command to run", async () => {
    await expect(withGitHubErrors(failing(graphqlError("INSUFFICIENT_SCOPES")))("q", {})).rejects.toBeInstanceOf(GitHubScopeError);
  });
  it("turns an unknown or hidden project into a board-not-found error", async () => {
    await expect(withGitHubErrors(failing(graphqlError("NOT_FOUND")))("q", {})).rejects.toBeInstanceOf(BoardNotFoundError);
  });
  it("turns a refused or expired token into an auth error", async () => {
    await expect(withGitHubErrors(failing(httpError(401)))("q", {})).rejects.toBeInstanceOf(GitHubAuthError);
    await expect(withGitHubErrors(failing(graphqlError("FORBIDDEN")))("q", {})).rejects.toBeInstanceOf(GitHubAuthError);
  });
  it("lets other errors through unchanged", async () => {
    const e = new Error("network down");
    await expect(withGitHubErrors(failing(e))("q", {})).rejects.toBe(e);
  });
});
