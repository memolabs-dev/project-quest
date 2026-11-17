// The practice site's gestures: found it, write an issue, take an issue. Each prepare builds exactly what
// the confirmation shows; the server rebuilds it from a fresh read before sending. Ids a mutation only learns
// from the one before it are shown as "$repositoryId" or "$issueId" and filled in when sent.
import type { PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";

export type PracticeMutationName =
  | "createRepository" | "createProjectV2" | "createIssue" | "addProjectV2ItemById" | "addAssigneesToAssignable" | "addComment"
  /** REST: the only way to lay the first commit of an empty repository. */
  | "createOrUpdateFileContents"
  | "createRef" | "createCommitOnBranch" | "createPullRequest" | "mergePullRequest";
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
export interface PreparedEdit {
  kind: "edit";
  repo: string;
  branch: string;
  path: "README.md";
  /** The whole new text of the file, shown in plain words before it is sent. */
  content: string;
  message: string;
  /** The repository is still empty: its first commit (a README) is laid before the branch. */
  foundation: boolean;
  mutations: PracticeMutation[];
}
export interface PreparedPull { kind: "pull"; repo: string; branch: string; issueNumber: number; title: string; body: string; mutations: PracticeMutation[] }
export interface PreparedMerge { kind: "merge"; repo: string; pullNumber: number; mutations: PracticeMutation[] }
export type PreparedPractice = PreparedFound | PreparedIssue | PreparedTake | PreparedEdit | PreparedPull | PreparedMerge;

const MAX_TITLE = 256;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function prepareFound(
  viewer: { login: string; id: string }, existing: PracticeSnapshot | null, name: string, visibility: "PUBLIC" | "PRIVATE",
): PreparedFound {
  if (existing?.board) throw new GestureError(`Your site ${existing.repo.nameWithOwner} is already founded`);
  if (existing && existing.repo.nameWithOwner.toLowerCase() !== `${viewer.login}/${name}`.toLowerCase()) {
    throw new GestureError(`${viewer.login}/${name} now leads to ${existing.repo.nameWithOwner}: the game founds only in your own account`);
  }
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

/** Base64 of the text's UTF-8 bytes, in Node and in the browser alike. */
export function base64(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export const practiceBranch = (issueNumber: number) => `practice-${issueNumber}`;

function ownIssue(practice: PracticeSnapshot, viewer: { login: string }, issueNumber: number) {
  const issue = practice.issues.find((i) => i.number === issueNumber);
  if (!issue || issue.closed || !issue.assignees.some((a) => same(a, viewer.login))) {
    throw new GestureError(`Take issue #${issueNumber} first: work happens on an issue that is yours`);
  }
  return issue;
}

export function prepareEdit(
  practice: PracticeSnapshot, viewer: { login: string; id: string }, issueNumber: number, content: string, message: string,
): PreparedEdit {
  ownIssue(practice, viewer, issueNumber);
  const headline = message.trim();
  if (!headline) throw new GestureError("Say in a few words what you changed: the message cannot be empty");
  const repo = practice.repo.nameWithOwner;
  const branch = practiceBranch(issueNumber);
  const existing = practice.branches.find((b) => b.name === branch);
  const head = existing?.oid ?? practice.defaultBranch?.oid ?? "$headOid";
  const commit: PracticeMutation = {
    name: "createCommitOnBranch",
    input: {
      branch: { repositoryNameWithOwner: repo, branchName: branch },
      expectedHeadOid: head,
      message: { headline },
      fileChanges: { additions: [{ path: "README.md", contents: base64(content) }] },
    },
  };
  const ref: PracticeMutation = { name: "createRef", input: { repositoryId: practice.repo.id, name: `refs/heads/${branch}`, oid: head } };
  const foundation = practice.defaultBranch === null;
  const mutations: PracticeMutation[] = existing ? [commit]
    : foundation ? [
      { name: "createOrUpdateFileContents", input: { path: "README.md", message: "Lay the foundation stone", content: base64(`# ${repo.split("/")[1]}\n`) } },
      ref, commit,
    ]
      : [ref, commit];
  return { kind: "edit", repo, branch, path: "README.md", content, message: headline, foundation, mutations };
}

export function preparePull(
  practice: PracticeSnapshot, viewer: { login: string }, issueNumber: number, title: string, why: string,
): PreparedPull {
  ownIssue(practice, viewer, issueNumber);
  const branch = practiceBranch(issueNumber);
  if (!practice.defaultBranch || !practice.branches.some((b) => b.name === branch)) {
    throw new GestureError(`Edit a file first: there is no branch ${branch} yet`);
  }
  if (practice.pulls.some((p) => p.headRefName === branch && p.state === "OPEN")) {
    throw new GestureError(`A pull request from ${branch} is already open`);
  }
  const t = title.trim();
  if (!t) throw new GestureError("A pull request needs a title");
  const body = `${why.trim()}\n\nCloses #${issueNumber}`;
  return {
    kind: "pull", repo: practice.repo.nameWithOwner, branch, issueNumber, title: t, body,
    mutations: [{ name: "createPullRequest", input: { repositoryId: practice.repo.id, baseRefName: practice.defaultBranch.name, headRefName: branch, title: t, body } }],
  };
}

export function prepareMerge(practice: PracticeSnapshot, viewer: { login: string }, pullNumber: number): PreparedMerge {
  const pull = practice.pulls.find((p) => p.number === pullNumber);
  if (!pull || !same(pull.author, viewer.login)) throw new GestureError(`Pull request #${pullNumber} is not yours: the game merges only your own`);
  if (pull.state !== "OPEN") throw new GestureError(`Pull request #${pullNumber} is not open`);
  if (pull.closes.length === 0) throw new GestureError(`Pull request #${pullNumber} closes no issue`);
  return {
    kind: "merge", repo: practice.repo.nameWithOwner, pullNumber,
    mutations: [{ name: "mergePullRequest", input: { pullRequestId: pull.id, expectedHeadOid: pull.headRefOid, mergeMethod: "MERGE" } }],
  };
}
