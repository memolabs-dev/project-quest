// Sends a prepared practice gesture, mutation by mutation, filling in the ids a mutation learns from the one
// before it. Stops at the first refusal and says what was already done, so nothing half-made is hidden.
import type { PracticeMutationName, PreparedPractice } from "../../shared/gestures/practice.ts";
import type { PreparedAsk } from "../../shared/gestures/real.ts";
import type { PreparedTeam } from "../../shared/gestures/team.ts";
import type { Gql, Rest } from "./client.ts";

export type { Rest };

export type PracticeResult = { ok: true } | { ok: false; reason: "github"; message: string; applied: PracticeMutationName[] };

const MUTATIONS: Record<Exclude<PracticeMutationName, "createOrUpdateFileContents" | "createMilestone" | "updateMilestone">, { inputType: string; returns: string }> = {
  createRepository: { inputType: "CreateRepositoryInput", returns: "repository { id }" },
  createProjectV2: { inputType: "CreateProjectV2Input", returns: 'projectV2 { id field(name: "Status") { ... on ProjectV2SingleSelectField { id } } }' },
  createIssue: { inputType: "CreateIssueInput", returns: "issue { id }" },
  addProjectV2ItemById: { inputType: "AddProjectV2ItemByIdInput", returns: "item { id }" },
  addAssigneesToAssignable: { inputType: "AddAssigneesToAssignableInput", returns: "clientMutationId" },
  addComment: { inputType: "AddCommentInput", returns: "clientMutationId" },
  createRef: { inputType: "CreateRefInput", returns: "ref { id }" },
  createCommitOnBranch: { inputType: "CreateCommitOnBranchInput", returns: "commit { oid url }" },
  createPullRequest: { inputType: "CreatePullRequestInput", returns: "pullRequest { id url }" },
  mergePullRequest: { inputType: "MergePullRequestInput", returns: "pullRequest { id }" },
  updateProjectV2Field: { inputType: "UpdateProjectV2FieldInput", returns: "clientMutationId" },
  createProjectV2Field: { inputType: "CreateProjectV2FieldInput", returns: "clientMutationId" },
  addLabelsToLabelable: { inputType: "AddLabelsToLabelableInput", returns: "clientMutationId" },
  closeIssue: { inputType: "CloseIssueInput", returns: "issue { id }" },
  updateIssue: { inputType: "UpdateIssueInput", returns: "issue { id }" },
  updateProjectV2ItemFieldValue: { inputType: "UpdateProjectV2ItemFieldValueInput", returns: "clientMutationId" },
  clearProjectV2ItemFieldValue: { inputType: "ClearProjectV2ItemFieldValueInput", returns: "clientMutationId" },
  addSubIssue: { inputType: "AddSubIssueInput", returns: "clientMutationId" },
  addBlockedBy: { inputType: "AddBlockedByInput", returns: "clientMutationId" },
  createProjectV2StatusUpdate: { inputType: "CreateProjectV2StatusUpdateInput", returns: "statusUpdate { id }" },
};

const githubMessage = (e: unknown) =>
  (e as { errors?: { message: string }[] }).errors?.[0]?.message ?? (e instanceof Error ? e.message : String(e));

/** The ids a mutation learns from the one before it, written "$name" in what the confirmation shows. */
const PLACEHOLDERS = new Set(["$repositoryId", "$projectId", "$statusFieldId", "$issueId", "$headOid", "$milestoneId"]);

/** Replaces each placeholder by the id GitHub returned earlier; one GitHub did not return stops the gesture there. */
const fill = (input: Record<string, unknown>, ids: Record<string, string>) =>
  Object.fromEntries(Object.entries(input).map(([k, v]) => {
    if (typeof v !== "string" || !PLACEHOLDERS.has(v)) return [k, v];
    const id = ids[v.slice(1)];
    if (!id) throw Object.assign(new Error(`GitHub did not give back the id the next step needs (${v})`), { errors: [{ message: `GitHub did not give back the id the next step needs (${v})` }] });
    return [k, id];
  }));

export async function applyPractice(gql: Gql, rest: Rest, prepared: PreparedPractice | PreparedAsk | PreparedTeam): Promise<PracticeResult> {
  const ids: Record<string, string> = {};
  const applied: PracticeMutationName[] = [];
  for (const m of prepared.mutations) {
    let res: Record<string, Record<string, { id?: string } | undefined> | undefined>;
    try {
      if (m.name === "createOrUpdateFileContents") {
        // The foundation stone: GitHub's git APIs refuse an empty repository, the contents API lays its first commit.
        const { path, ...body } = m.input as { path: string; message: string; content: string };
        const r = (await rest("PUT", `/repos/${prepared.kind === "found" ? `${prepared.owner}/${prepared.name}` : prepared.repo}/contents/${path}`, body)) as { commit?: { sha?: string } };
        if (r.commit?.sha) ids.headOid = r.commit.sha;
        applied.push(m.name);
        continue;
      }
      if (m.name === "createMilestone") {
        // GraphQL has no milestone mutation: REST creates it, its node id goes to the issues put under it.
        const r = (await rest("POST", `/repos/${"repo" in prepared ? prepared.repo : ""}/milestones`, m.input)) as { node_id?: string };
        if (r.node_id) ids.milestoneId = r.node_id;
        applied.push(m.name);
        continue;
      }
      if (m.name === "updateMilestone") {
        // Close the visit or move its date: REST only too.
        const { number, ...body } = m.input as { number: number };
        await rest("PATCH", `/repos/${"repo" in prepared ? prepared.repo : ""}/milestones/${number}`, body);
        applied.push(m.name);
        continue;
      }
      const { inputType, returns } = MUTATIONS[m.name];
      res = await gql(`mutation($input: ${inputType}!) { ${m.name}(input: $input) { ${returns} } }`, { input: fill(m.input, ids) });
    } catch (e) {
      // Before any write, access errors (login, scope) are the server's to explain. After one, whatever went
      // wrong, the player is told what was already done on GitHub.
      if (applied.length === 0 && !(e as { errors?: unknown }).errors) throw e;
      let message = githubMessage(e);
      // A private repository the token cannot read looks "not founded", then its name is taken: say why.
      if (m.name === "createRepository" && /already exists/i.test(message)) {
        message += ". It may already exist as a private repository the game cannot read: give the login the repo scope (gh auth refresh -s repo).";
      }
      return { ok: false, reason: "github", message, applied };
    }
    applied.push(m.name);
    const out = res?.[m.name] as { repository?: { id?: string }; issue?: { id?: string }; projectV2?: { id?: string; field?: { id?: string } | null } } | undefined;
    if (out?.repository?.id) ids.repositoryId = out.repository.id;
    // closeIssue and updateIssue answer with the issue too: only a new issue becomes "$issueId".
    if (m.name === "createIssue" && out?.issue?.id) ids.issueId = out.issue.id;
    if (out?.projectV2?.id) ids.projectId = out.projectV2.id;
    if (out?.projectV2?.field?.id) ids.statusFieldId = out.projectV2.field.id;
  }
  return { ok: true };
}
