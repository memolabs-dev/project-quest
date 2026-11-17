# Levels, slice 4c: the Team leader rank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Journeyman plays levels 12 to 15 with real git on their machine, guided by the commands the game shows, each level stamped only on what GitHub sees: a branch pushed from the machine, main's latest brought into it, a pull request fixed from the machine, then merged and its branch deleted.

**Architecture:** Same engine as 4a and 4b (plans `2026-11-17-levels-apprentice.md`, `2026-11-17-levels-journeyman.md`). New: the practice read gives each branch its recent history (oid, date, `committedViaWeb`) and each pull request commit's `committedViaWeb`; one new gesture, the mayor's change on main; the pull request gesture takes the player's own branch; the mentor shows copyable commands.

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-levels-design.md` (section 3, levels 12 to 15, and "Why the Team leader rank is cut this way").

## Global Constraints

- Every 4a and 4b constraint holds.
- The game never runs anything on the player's machine: it shows commands to copy, and checks the result on GitHub.
- The work branch is named `work-<issue number>`; the commands use the practice repository's HTTPS clone URL.
- A commit "made on your machine" is one with `committedViaWeb` false, on a branch other than the default and `practice-N`, whose head is beyond the default branch's head (checked on GitHub on 2026-11-17: API commits read `true`; a REST contents commit reads `false`).
- The mayor's change is a confirmed gesture like any other: one `createCommitOnBranch` on the default branch, adding a line to `PLAN.md` (never the README, so the player's merge has no conflict).

## Review Focus

1. A branch pushed with no new commit (only `git switch -c` then `git push`): level 12 does not pass (Task 2 test `a12 needs a commit beyond main`).
2. Main has not moved since the branch was made: level 13 does not pass on a branch that merely contains main (Task 2 test `a13 needs main to have moved, then come in`).
3. A fix pushed from GitHub's web editor or through the game's trowel: level 14 does not pass, it asks for the machine (Task 2 test `a14 ignores a fix made on the web`).
4. GitHub's "automatically delete head branches" is on: level 15 passes at the merge, which is right (Task 2 test `a15 passes when the branch is gone, however it went`).
5. The player names their branch otherwise than `work-N`: levels 12 to 15 still pass on any branch other than the default and `practice-N` (Task 2 test `any branch name of the player's counts`).

---

### Task 1: Read branch histories and how each commit was made

**Files:** Modify `src/shared/levels/types.ts`, `src/server/github/read-practice.ts`, its fixture; Test `src/server/github/read-practice.test.ts`.

**Interfaces:**
- Produces: `PracticeSnapshot.defaultBranch` gains `committedDate: string`; each branch gains `history: { oid: string; committedDate: string; viaWeb: boolean }[]` (newest first, up to 30) and `viaWeb: boolean` (its head); each pull request commit gains `viaWeb: boolean`.
- Query: branch target `committedViaWeb history(first: 30) { nodes { oid committedDate committedViaWeb } }`; default target `committedDate`; pull request commits `committedViaWeb`.

- [ ] Steps: failing test `maps each branch's history and how its commits were made` on the extended FICTIF fixture; run it (FAIL); implement and update every snapshot literal; `npm run check` (PASS); commit `feat: read branch histories and how each commit was made (#6)`.

### Task 2: The Team leader checks

**Files:** Create `src/shared/levels/team-leader.ts`; Modify `src/shared/levels/index.ts`, `src/shared/levels/progress.ts` (`unlocks.van`: the Journeyman rank reached; `unlocks.realProjects`: `a15` stamped); Test `src/shared/levels/team-leader.test.ts`, `progress.test.ts`.

**Interfaces:**
- `TEAM_LEADER: Level[]`, ids `a12-push-branch`, `a13-bring-main`, `a14-fix-from-machine`, `a15-clean-up`, rank `"team-leader"`.
- "A work branch" = a branch whose name is neither the default nor `practice-<n>`. "Made on the machine" = `viaWeb` false.
- Rules:
  - `a12-push-branch`: a work branch whose head is made on the machine, authored by the viewer, and differs from the default head. Proof: the head commit's URL.
  - `a13-bring-main`: a work branch whose history contains the default head's oid, where the default head is newer than the branch's oldest commit made on the machine. Proof: the branch head's URL.
  - `a14-fix-from-machine`: a viewer's pull request (closing an issue) from a work branch, with a commit made on the machine dated after the pull request's `createdAt`. Proof: that commit's URL.
  - `a15-clean-up`: a viewer's merged pull request from a work branch, whose head branch is no longer among the branches. Proof: the pull request's URL.

- [ ] Steps: failing tests (done and not yet for each, plus the five Review Focus tests above and `the van comes with the Journeyman rank`); run (FAIL); implement; `npm run check` (PASS); commit `feat: the Team leader checks: push, bring main, fix from the machine, clean up (#6)`.

### Task 3: The mayor's change, and a pull request from your own branch

**Files:** Modify `src/shared/gestures/practice.ts`, `src/server/app.ts`, `src/github/api-coverage.ts` (no new operation: `createCommitOnBranch` is already a gesture; its wording gains the mayor); Test `practice.test.ts`, `src/server/levels.test.ts`.

**Interfaces:**
- `interface PreparedMayor { kind: "mayor"; repo: string; branch: string; line: string; mutations: PracticeMutation[] }`, `prepareMayor(practice): PreparedMayor`: one `createCommitOnBranch` on the default branch at its head, writing `PLAN.md` = the current `PLAN.md` text (read in Task 1's query as `plan`, from `HEAD:PLAN.md`) plus the line `- FICTIF The mayor wants a bench by the gate.`, headline `The mayor changes the plan`. Refuses an empty repository.
- `preparePull(practice, viewer, issueNumber, title, why, branch?)`: `branch` defaults to `practice-<n>`; any branch of the practice repository is accepted except the default.
- Routes: `/api/practice/mayor/prepare` (no body) and the `mayor` kind on `/apply`; `/api/practice/pull/prepare` accepts `branch`; the zod claims follow.

- [ ] Steps: failing tests `the mayor adds a line to PLAN.md on main, at its head`, `opens a pull request from your own branch`, `refuses a pull request from the default branch`, route test `sends the mayor's change the server rebuilt`; run (FAIL); implement; `npm run check` (PASS); commit `feat: the mayor's change, and a pull request from your own branch (#6)`.

### Task 4: The commands to type, and Mémé's words

**Files:** Create `src/client/commands.ts`; Modify `src/client/levels.ts`, `src/client/ui/Mentor.tsx`, `src/client/ui/PracticeDialogs.tsx`, `src/shared/api.ts`, `src/server/levels.ts`, both locales, `src/locales/parity.test.ts`; Test `src/client/commands.test.ts`, `src/client/levels.test.ts`.

**Interfaces:**
- `commandsFor(level: string, repo: { nameWithOwner: string; defaultBranch: string }, issue: number): string[]` (pure): a12 `git clone https://github.com/<repo>.git`, `cd <name>`, `git switch -c work-<n>`, a line telling to edit `README.md`, `git commit -am "..."`, `git push -u origin work-<n>`; a13 `git switch <default>`, `git pull`, `git switch work-<n>`, `git merge <default>`, `git push`; a14 edit, `git commit -am "..."`, `git push`; a15 `git switch <default>`, `git pull`, `git branch -d work-<n>`, `git push origin --delete work-<n>`.
- `LevelsView.practice` gains `defaultBranch: string | null`, `workBranch: string | null` (the viewer's newest work branch) and `mainMoved: boolean` (the default head is newer than the work branch's oldest machine commit).
- `mentorAction`: a12 → `"write"` / `"take"` when the viewer has no open issue, else `"commands"`; a13 → `"mayor"` until main moved, then `"commands"`; a14 → `"pull"` (from the work branch) until a pull request is open, then `"commands"`; a15 → `"merge"` until merged, then `"commands"`.
- The bubble shows the commands in a copyable block with a "Copy" button (Clipboard API, falls back to selecting the text).
- Keys: `levels.a12..a15.{skill,goal,lesson,done}`, `skills.rank.team-leader` (Team leader / Chef d'équipe), `mentor.rankDone.team-leader`, `mentor.copy`, `mentor.copied`, `practice.mayor.{open,title,body}`, `practice.summary.mayor`.

- [ ] Steps: failing tests `writes the clone, branch, commit and push commands`, `brings main in with the default branch's real name`, `asks for an issue, then the commands`, `asks the mayor first, then the commands`, parity extended to the new rank; run (FAIL); implement; `npm run check` and `npx playwright test` (PASS, ui-check included); commit `feat: the commands to type and Mémé's words for the Team leader rank (#6)`.

### Task 5: The real run, the review, the close

- [ ] **Real run, after the owner says go**, on `guillaume-flambard/my-first-site`: write and take issue #3 in the game; clone into a scratch folder, `work-3`, a commit, push (a12); the mayor's change, then merge main into `work-3` and push (a13); open the pull request from `work-3` in the game, a fix commit from the machine, push (a14); merge in the game, delete the branch with git (a15). Check each step on GitHub and in the game; record the URLs.
- [ ] **Independent review** against this Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] Show the owner the screenshots; close #6 with the evidence once seen.
