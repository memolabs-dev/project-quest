# Levels, slice 4b: the Journeyman rank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A volunteer who reached the Apprentice rank plays levels 8 to 11 on their practice site: edits a file in the game (a branch and a commit, no terminal), opens a pull request that closes their issue, answers the inspector by pushing a fix, then merges, and the floor grows on their own site.

**Architecture:** Same engine as 4a (`docs/superpowers/plans/2026-11-17-levels-apprentice.md`): levels as data with pure checks over `Observed`, the server observing GitHub and stamping, practice gestures as a pure `prepare*` the confirmation shows and a server `apply` that rebuilds it and refuses any target outside the practice repository. New: the practice read covers branches, the README and pull requests; one REST step lays the first commit of an empty repository.

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-levels-design.md` (sections 3 to 9, levels 8 to 11).

## Global Constraints

- All of slice 4a's constraints hold (server decides stamps, writes only to the viewer's practice repository, every write shown then confirmed then logged, both locales, no em or en dash in French, personal progress, FICTIF content in tests and real runs).
- The game merges only the viewer's own pull request on their own practice repository; merging anywhere else stays on GitHub (`api-coverage.ts`).
- A file edited in the game is shown in plain text in the confirmation, with the exact request (base64 included).
- GitHub facts this plan relies on, checked on 2026-11-17: `createCommitOnBranch` and `createRef` need an existing commit (`expectedHeadOid`, `oid`, schema.docs.graphql); on an empty repository the REST `PUT /repos/{owner}/{repo}/contents/{path}` makes the first commit and the default branch, and the git APIs answer 409 until then (GitHub docs, "Using the REST API to interact with your Git database").

## Review Focus

1. The practice repository is empty (founded in 4a, no commit): level 8 lays the README first, then branches (Task 3 test `lays the foundation stone on an empty repository`).
2. The player edits again a branch that moved on GitHub meanwhile: the commit is refused by `expectedHeadOid`, nothing is overwritten, the player is told to look again (Task 3 test `edits on the branch head the server read`; Task 4 test `a moved branch is reported, not overwritten`).
3. A pull request that does not close an issue, or someone else's pull request: levels 9 to 11 never pass on it, and the game never merges it (Task 2 tests; Task 3 test `never merges a pull request that is not yours`).
4. The issue is closed by the merge but the board has no "Item closed" workflow: the pallet still stands in the last yard and the floor grows (Task 6 test `the unassigned building grows too`).
5. A file content with non-ASCII text (accents, emoji): the base64 round-trips exactly (Task 3 test `encodes any text exactly`).

---

### Task 1: Read branches, the README and pull requests

**Files:**
- Modify: `src/shared/levels/types.ts`, `src/server/github/read-practice.ts`, `src/server/github/__fixtures__/practice-response.json`
- Test: `src/server/github/read-practice.test.ts`

**Interfaces:**
- Produces, on `PracticeSnapshot`:
  - `defaultBranch: { name: string; oid: string } | null` (null: the repository has no commit yet)
  - `readme: string | null` (text of `README.md` on the default branch)
  - `branches: { name: string; oid: string; author: string; url: string }[]` (heads other than the default; `author` is the head commit's author login, `"ghost"` when none)
  - `pulls: PracticePull[]`, newest first, with `interface PracticePull { id: string; number: number; url: string; author: string; state: "OPEN" | "CLOSED" | "MERGED"; createdAt: string; headRefName: string; headRefOid: string; closes: number[]; commits: { oid: string; url: string; committedDate: string }[] }`
- Query additions: `defaultBranchRef { name target { oid } }`, `object(expression: "HEAD:README.md") { ... on Blob { text } }`, `refs(refPrefix: "refs/heads/", first: 20) { nodes { name target { ... on Commit { oid url author { user { login } } } } } }`, `pullRequests(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { id number url state createdAt headRefName headRefOid author { login } closingIssuesReferences(first: 5) { nodes { number } } commits(last: 20) { nodes { commit { oid url committedDate } } } } }`.

- [ ] **Step 1: Write the failing tests:** `maps branches, the README and pull requests` (fixture extended, FICTIF); `reads an empty repository as no default branch, no README, no branches` (`defaultBranchRef: null`, `object: null`, empty refs).
- [ ] **Step 2: Run** `npx vitest run src/server/github/read-practice.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**; update every `PracticeSnapshot` literal in existing tests with the new fields (empty).
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: read the practice site's branches, README and pull requests (#5)`.

### Task 2: The Journeyman checks

**Files:**
- Create: `src/shared/levels/journeyman.ts`, `src/shared/levels/index.ts`
- Modify: `src/shared/levels/progress.ts`, `src/server/levels.ts`, `src/client/levels.ts`, `src/client/ui/SkillBook.tsx`
- Test: `src/shared/levels/journeyman.test.ts`, `src/shared/levels/progress.test.ts`

**Interfaces:**
- Produces: `JOURNEYMAN: Level[]` (ids `a8-edit-file`, `a9-open-pull`, `a10-answer-review`, `a11-merge`, rank `"journeyman"`, where `"practice"`); `LEVELS = [...APPRENTICE, ...JOURNEYMAN]` in `index.ts`, used everywhere `APPRENTICE` was used to run or show levels; `unlocks()` gains `trowel` (the Apprentice rank reached) and `firstBuilding` (`a11-merge` stamped).
- Check rules (case-insensitive logins; "the viewer's pull" = authored by the viewer with a non-empty `closes`):
  - `a8-edit-file`: a branch other than the default whose head author is the viewer. Proof: its head commit URL.
  - `a9-open-pull`: a viewer's pull, open or merged. Proof: the pull's URL.
  - `a10-answer-review`: a viewer's pull with a commit dated after the pull's `createdAt`. Proof: that commit's URL.
  - `a11-merge`: a viewer's pull merged, and every issue in `closes` closed in `issues`. Proof: the pull's URL.

- [ ] **Step 1: Write the failing tests**, one `describe` per level with done and not yet, plus `a9 ignores a pull request that closes no issue`, `a9 ignores someone else's pull request`, `a10 needs a commit after the pull request was opened`, `a11 waits for the issue to be closed`, and in `progress.test.ts` `the trowel comes with the Apprentice rank, the first building with the merge`.
- [ ] **Step 2: Run** `npx vitest run src/shared/levels`. Expected: FAIL.
- [ ] **Step 3: Implement**; the skill book shows one page per rank.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS (existing tests updated for `LEVELS` where they count all levels).
- [ ] **Step 5: Commit** `feat: the Journeyman checks: edit, pull request, review, merge (#5)`.

### Task 3: Prepare editing, the pull request and the merge

**Files:**
- Modify: `src/shared/gestures/practice.ts`
- Test: `src/shared/gestures/practice.test.ts`

**Interfaces:**
- Consumes: Task 1 snapshot.
- Produces:
  - `PracticeMutationName` gains `"createOrUpdateFileContents"` (REST), `"createRef"`, `"createCommitOnBranch"`, `"createPullRequest"`, `"mergePullRequest"`.
  - `interface PreparedEdit { kind: "edit"; repo: string; branch: string; path: "README.md"; content: string; message: string; foundation: boolean; mutations: PracticeMutation[] }`, `prepareEdit(practice: PracticeSnapshot, viewer: { login: string; id: string }, issueNumber: number, content: string, message: string): PreparedEdit`. Branch name `practice-<issueNumber>`. Steps:
    - empty repository (`defaultBranch` null): `createOrUpdateFileContents` `{ path: "README.md", message: "Lay the foundation stone", content: base64("# <repo name>\n") }`, then `createRef` `{ repositoryId, name: "refs/heads/practice-<n>", oid: "$headOid" }`, then `createCommitOnBranch` `{ branch: { repositoryNameWithOwner, branchName }, expectedHeadOid: "$headOid", message: { headline: message }, fileChanges: { additions: [{ path: "README.md", contents: base64(content) }] } }`; `foundation: true`;
    - default branch present, branch missing: `createRef` with `oid: defaultBranch.oid`, then the commit with `expectedHeadOid: defaultBranch.oid`;
    - branch present (the inspector's fix): only the commit, `expectedHeadOid` the branch's `oid`.
    - Refuses an empty message, and an issue not assigned to the viewer.
  - `interface PreparedPull { kind: "pull"; repo: string; branch: string; issueNumber: number; title: string; body: string; mutations: PracticeMutation[] }`, `preparePull(practice, viewer, issueNumber, title, why): PreparedPull`: body is `why`, a blank line, then `Closes #<n>`; one `createPullRequest` `{ repositoryId, baseRefName: defaultBranch.name, headRefName: "practice-<n>", title, body }`. Refuses when the branch does not exist, or a pull from it is already open.
  - `interface PreparedMerge { kind: "merge"; repo: string; pullNumber: number; mutations: PracticeMutation[] }`, `prepareMerge(practice, viewer, pullNumber): PreparedMerge`: one `mergePullRequest` `{ pullRequestId, expectedHeadOid: headRefOid, mergeMethod: "MERGE" }`. Refuses a pull not open, not the viewer's, or closing no issue.
  - `PreparedPractice` includes the three; `base64` from `TextEncoder` and `btoa` (works in Node and the browser).

- [ ] **Step 1: Write the failing tests:** `lays the foundation stone on an empty repository`; `branches from the default branch head`; `edits on the branch head the server read`; `encodes any text exactly` (content `"Façade 🧱 bleue"` decodes back equal); `refuses an issue not assigned to you`; `opens a pull request that closes the issue`; `never opens a second pull request from the same branch`; `merges your pull request on its head`; `never merges a pull request that is not yours`.
- [ ] **Step 2: Run** `npx vitest run src/shared/gestures/practice.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat: prepare editing a file, a pull request and the merge (#5)`.

### Task 4: Sending them, behind the same guard

**Files:**
- Modify: `src/server/github/client.ts` (a `githubRest(method, path, body)` beside `githubGql`, same token, same error mapping), `src/server/github/practice-apply.ts`, `src/server/deps.ts`, `src/server/app.ts`, `src/github/api-coverage.ts`, `docs/github-api/COVERAGE.md`
- Test: `src/server/github/practice-apply.test.ts`, `src/server/levels.test.ts`, `src/github/api-coverage.test.ts`

**Interfaces:**
- `applyPractice(gql: Gql, rest: Rest, prepared)`: `createOrUpdateFileContents` goes through `rest("PUT", "/repos/{owner}/{repo}/contents/README.md", { message, content })` and fills `$headOid` from `commit.sha`; GraphQL steps as before.
- The route accepts `:kind{found|issue|take|edit|pull|merge}`; the zod claim gains the three shapes; the server rebuilds with a fresh read, compares, sends, logs, answers with the levels.
- `api-coverage.ts`: `createRef`, `createCommitOnBranch`, `createPullRequest`, `mergePullRequest` and `rest.repos/create-or-update-file-contents` become gestures with the practice-site wording; `mergePullRequest`'s text says the game merges only your own pull request on your practice site.

- [ ] **Step 1: Write the failing tests:** `lays the README through REST, then branches from its commit` (fake gql and rest record calls); `a moved branch is reported, not overwritten` (GitHub's error on `createCommitOnBranch` gives `ok: false` with `applied`); `refuses an edit, a pull request or a merge outside the practice repository` (409, nothing sent); `merging is a gesture only on your practice site` (coverage wording test).
- [ ] **Step 2: Run** `npx vitest run src/server src/github`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check && npm run api:coverage`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: send an edit, a pull request and a merge, behind the practice guard (#5)`.

### Task 5: Mémé Truelle and the inspector, in both languages

**Files:**
- Modify: `src/locales/en/common.json`, `src/locales/fr/common.json`, `src/locales/parity.test.ts`

**Interfaces:**
- Keys: `levels.<a8..a11>.{skill,goal,lesson,done}`; `skills.rank.journeyman` (Journeyman / Compagnon); `inspector.name` ("The inspector" / "L'inspectrice"); `inspector.remark` (her one remark at level 10: add a line saying why you made the change, then send it again, because a pull request takes new commits); dialog keys under `practice.edit`, `practice.pull`, `practice.merge` and `practice.summary.{edit,foundation,pull,merge}`.
- `levels.a9-open-pull.lesson` is the spec's line verbatim: "A pull request is you knocking on the door: 'I've done this, can you look?'" / « Une pull request, c'est toi qui frappes à la porte : "J'ai fait ça, tu peux regarder ?" » (French quotes inside « »).
- The parity test checks `.done` too (a deferred minor of #2).

- [ ] **Step 1: Extend the failing test** to every id of `LEVELS` and to `.done`.
- [ ] **Step 2: Run** `npx vitest run src/locales`. Expected: FAIL.
- [ ] **Step 3: Write** the keys.
- [ ] **Step 4: Run** the same, then the humanizer lint on the French file. Expected: PASS, no dash.
- [ ] **Step 5: Commit** `feat: Mémé Truelle and the inspector for the Journeyman levels (#5)`.

### Task 6: The trowel on screen, and the floor that grows on your site

**Files:**
- Modify: `src/client/levels.ts`, `src/client/api.ts`, `src/client/ui/PracticeDialogs.tsx`, `src/client/ui/Mentor.tsx`, `src/client/scene/show.ts`, `src/client/scene/Site.tsx`, `src/client/scene/Building.tsx`
- Test: `src/client/levels.test.ts`, `src/client/scene/show.test.ts`, `e2e/levels.spec.ts`

**Interfaces:**
- `mentorAction` gains `"edit"` (a8 and a10), `"pull"` (a9), `"merge"` (a11); at a10 the bubble shows the inspector's remark under Mémé's lesson.
- Dialogs: **Edit README** (the file's current text from `LevelsView` (new field `practice.readme`), or `"# <name>\n"` before the foundation; a commit message field; the summary says when the foundation stone is laid first); **Open a pull request** (title, "why", and the plain line that `Closes #<n>` is added); **Merge** (the pull, its title, one Send).
- `newlyLaid` counts the unassigned building too (`epicNumber === null`), keyed as `"unassigned"`, so the floor grows on a practice site with no epic.
- `LevelsView` gains `practice.readme: string | null`, `practice.issue: number | null` (the viewer's open assigned issue, for the dialogs) and `practice.pull: number | null` (the viewer's open pull).

- [ ] **Step 1: Write the failing tests:** `asks to edit, then to open a pull request, then to answer, then to merge` (levels.test); `the unassigned building grows too` (show.test); e2e `a journeyman's edit dialog asks for the text and the message, and sends nothing` on the demo (the dialog opened through the store with a FICTIF `LevelsView` at a8: its fields, the foundation line, no Send button; the exact requests are pinned by Task 3 and Task 4 unit tests, since the demo has no practice site to prepare against).
- [ ] **Step 2: Run** `npx vitest run src/client && npx playwright test --project=main e2e/levels.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check && npx playwright test`. Expected: PASS, ui-check included.
- [ ] **Step 5: Commit** `feat: edit, open a pull request, merge: the Journeyman dialogs and the growing floor (#5)`.

### Task 7: The real run, the review, the close

- [ ] **Step 1: Real run, after the owner says go**, on `guillaume-flambard/my-first-site` (private, FICTIF, founded in 4a, still empty): lay the foundation and edit the README on `practice-1`, open the pull request closing #1, push the inspector's fix, merge; check on GitHub (branch, commits, pull request merged, issue #1 closed) and in the game (a8 to a11 stamped with proofs, the floor grown). Record the URLs.
- [ ] **Step 2: Independent review** of the slice against this Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] **Step 3:** Show the owner the screenshots; close #5 with the evidence once seen.
