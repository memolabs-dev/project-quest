// Sends a prepared practice gesture, mutation by mutation, filling in the ids a mutation learns from the one
// before it. Stops at the first refusal and says what was already done, so nothing half-made is hidden.
import type { PracticeMutationName, PreparedPractice } from "../../shared/gestures/practice.ts";
import type { Gql } from "./client.ts";

export type PracticeResult = { ok: true } | { ok: false; reason: "github"; message: string; applied: PracticeMutationName[] };

const MUTATIONS: Record<PracticeMutationName, { inputType: string; returns: string }> = {
  createRepository: { inputType: "CreateRepositoryInput", returns: "repository { id }" },
  createProjectV2: { inputType: "CreateProjectV2Input", returns: "projectV2 { id }" },
  createIssue: { inputType: "CreateIssueInput", returns: "issue { id }" },
  addProjectV2ItemById: { inputType: "AddProjectV2ItemByIdInput", returns: "item { id }" },
  addAssigneesToAssignable: { inputType: "AddAssigneesToAssignableInput", returns: "clientMutationId" },
  addComment: { inputType: "AddCommentInput", returns: "clientMutationId" },
};

const githubMessage = (e: unknown) =>
  (e as { errors?: { message: string }[] }).errors?.[0]?.message ?? (e instanceof Error ? e.message : String(e));

/** "$repositoryId" and "$issueId" placeholders, replaced by the ids GitHub returned earlier in the same gesture. */
const fill = (input: Record<string, unknown>, ids: Record<string, string>) =>
  Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "string" && v.startsWith("$") && ids[v.slice(1)] ? ids[v.slice(1)] : v]));

export async function applyPractice(gql: Gql, prepared: PreparedPractice): Promise<PracticeResult> {
  const ids: Record<string, string> = {};
  const applied: PracticeMutationName[] = [];
  for (const m of prepared.mutations) {
    const { inputType, returns } = MUTATIONS[m.name];
    let res: Record<string, Record<string, { id?: string } | undefined> | undefined>;
    try {
      res = await gql(`mutation($input: ${inputType}!) { ${m.name}(input: $input) { ${returns} } }`, { input: fill(m.input, ids) });
    } catch (e) {
      // Access errors (login, scope) are the server's to explain; GitHub refusing the content is the player's.
      if (!(e as { errors?: unknown }).errors) throw e;
      return { ok: false, reason: "github", message: githubMessage(e), applied };
    }
    applied.push(m.name);
    const repoId = res?.[m.name]?.repository?.id;
    const issueId = res?.[m.name]?.issue?.id;
    if (repoId) ids.repositoryId = repoId;
    if (issueId) ids.issueId = issueId;
  }
  return { ok: true };
}
