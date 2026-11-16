// The practice site's gestures: found it, write an issue, take an issue. Each prepare builds exactly what
// the confirmation shows; the server rebuilds it from a fresh read before sending. Ids a mutation only learns
// from the one before it are shown as "$repositoryId" or "$issueId" and filled in when sent.
import type { PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";

export type PracticeMutationName =
  | "createRepository" | "createProjectV2" | "createIssue" | "addProjectV2ItemById" | "addAssigneesToAssignable" | "addComment";
export interface PracticeMutation { name: PracticeMutationName; input: Record<string, unknown> }

export interface PreparedFound {
  kind: "found";
  owner: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  /** The repository already exists in the player's account: it is used as it is, nothing in it changes. */
  reuse: boolean;
  mutations: PracticeMutation[];
}
export interface PreparedIssue { kind: "issue"; repo: string; title: string; body: string; mutations: PracticeMutation[] }
export interface PreparedTake { kind: "take"; repo: string; issueNumber: number; comment: string; mutations: PracticeMutation[] }
export type PreparedPractice = PreparedFound | PreparedIssue | PreparedTake;

const MAX_TITLE = 256;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function prepareFound(
  viewer: { login: string; id: string }, existing: PracticeSnapshot | null, name: string, visibility: "PUBLIC" | "PRIVATE",
): PreparedFound {
  if (existing?.board) throw new GestureError(`Your site ${existing.repo.nameWithOwner} is already founded`);
  const board = (repositoryId: string): PracticeMutation => ({ name: "createProjectV2", input: { ownerId: viewer.id, title: name, repositoryId } });
  const mutations: PracticeMutation[] = existing
    ? [board(existing.repo.id)]
    : [
      { name: "createRepository", input: { name, visibility, hasIssuesEnabled: true, description: "My practice site (project-quest)" } },
      board("$repositoryId"),
    ];
  return { kind: "found", owner: viewer.login, name, visibility, reuse: existing !== null, mutations };
}

export function prepareIssue(practice: PracticeSnapshot, title: string, body: string): PreparedIssue {
  if (!practice.board) throw new GestureError("Found your site first: it has no board yet");
  const t = title.trim();
  if (!t) throw new GestureError("An issue needs a title");
  if (t.length > MAX_TITLE) throw new GestureError(`A title holds at most ${MAX_TITLE} characters`);
  return {
    kind: "issue", repo: practice.repo.nameWithOwner, title: t, body,
    mutations: [
      { name: "createIssue", input: { repositoryId: practice.repo.id, title: t, body } },
      { name: "addProjectV2ItemById", input: { projectId: practice.board.id, contentId: "$issueId" } },
    ],
  };
}

export function prepareTake(practice: PracticeSnapshot, viewer: { login: string; id: string }, issueNumber: number, comment: string): PreparedTake {
  const issue = practice.issues.find((i) => i.number === issueNumber);
  if (!issue) throw new GestureError(`Issue #${issueNumber} is not on your site`);
  if (issue.closed) throw new GestureError(`Issue #${issueNumber} is closed`);
  if (issue.assignees.length > 0 && !issue.assignees.some((a) => same(a, viewer.login))) {
    throw new GestureError(`Issue #${issueNumber} is already someone else's: nobody is taken from`);
  }
  if (!comment.trim()) throw new GestureError("Say it in a comment: it cannot be empty");
  return {
    kind: "take", repo: practice.repo.nameWithOwner, issueNumber, comment,
    mutations: [
      { name: "addAssigneesToAssignable", input: { assignableId: issue.id, assigneeIds: [viewer.id] } },
      { name: "addComment", input: { subjectId: issue.id, body: comment } },
    ],
  };
}
