# The lead's path, slice 5b: the Site manager rank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On their team site, the lead plans a sprint within a capacity they declared (L5), sets the mayor's visit as a milestone with a due date and issues (L6), splits the parcel too big into sub-issues (L7) and ropes one pallet behind another (L8); each level stamped only on what GitHub shows, except the capacity, named as the game's rule.

**Architecture:** Same pattern as 5a: the team site reader gains what these levels need, four pure checks join `lead.ts`, the new gestures join `team.ts` behind the same `/api/team/:kind` guard and rebuild. Two new things: a capacity kept with the player's progress (the game's rule, spec section 5), and a REST step in `applyPractice` for the milestone (GraphQL has no milestone mutation). The slice also fixes the bug seen in 5a: a duplicate closed counted as a floor laid.

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-lead-path-design.md` (sections 3 to 9, levels L5 to L8).

## Global Constraints

- Every 5a constraint holds: writes only to `<viewer>/my-first-team`, shown, confirmed, logged; `?demo=1` never sends; the game assigns nobody; both locales; no em or en dash in French; FICTIF content.
- What the game writes for the team carries `FICTIF` in its title and `Written by project-quest for practice.` in its body (sub-issues, the milestone's description).
- The sprint field is named `Sprint`, an `ITERATION` field of 7 days. Points per size (game rule, shown as such): `XS 1, S 2, M 3, L 5, XL 8`. Capacity: an integer from 1 to 100.
- API facts checked in `docs/github-api/schema.docs.graphql` on 2026-11-17: `createProjectV2Field` takes `iterationConfiguration { startDate, duration, iterations: [{ title, startDate, duration, id? }] }`; `updateProjectV2Field` takes the same and overwrites (existing iterations keep their identity only when their `id` is sent); `ProjectV2FieldValue.iterationId`; `clearProjectV2ItemFieldValue`; `addSubIssue { issueId, subIssueId }`; `addBlockedBy { issueId, blockingIssueId }`; `UpdateIssueInput.milestoneId`; readable `Issue.subIssues`, `Issue.blockedBy`, `Issue.milestone`, `Repository.milestones`, `Milestone { number title dueOn url state }`. No GraphQL milestone mutation: REST `POST /repos/{owner}/{repo}/milestones { title, description, due_on }`, whose answer carries `node_id`.
- A milestone's due date is sent as `<date>T12:00:00Z` (midday, so no timezone moves it a day); the real run checks the date GitHub shows.

## Review Focus

1. The sprint loaded over capacity, then one pallet unloaded: L5 passes once the load fits (Task 4 test `l5 passes again once the load fits`).
2. The player founds the sprint field, comes back after the week: no current sprint; the sprint gesture adds a new one starting today and keeps the past ones by id (Task 5 test `adds the next sprint, keeping the past ones`).
3. A pallet in the sprint without a size: L5 does not pass, the mentor says which (Task 4 test `l5 needs every pallet of the sprint sized`).
4. A due date in the past or malformed, or a milestone title already used: refused before anything is shown (Task 5 test `refuses a past or malformed due date, and a title in use`).
5. Two pallets roped both ways, or a pallet roped to itself: refused (Task 5 test `refuses a rope to itself or a circle`).

---

### Task 1: A duplicate is not a floor

**Files:** `src/shared/site.ts` (`BoardItem.stateReason: string | null`; `Pallet.discarded: boolean`, true when closed as `DUPLICATE` or `NOT_PLANNED`; `floorsOf` counts neither done nor total for a discarded pallet), `src/server/github/read-board.ts` (read `stateReason`), its fixture, `src/server/demo/*` literals.
**Tests:** `site.test.ts` `a duplicate or a parcel not planned is no floor, done or to do`.
- [ ] Steps: failing test; run (FAIL); implement; `npm run check` (PASS); commit `fix: a duplicate closed is not a floor laid (#9)`.

### Task 2: Read what the Site manager needs

**Files:** `src/shared/levels/types.ts`:
- `BoardField.iterations?: { id: string; title: string; startDate: string; duration: number }[]`
- `PracticeSnapshot.milestones?: { id: string; number: number; title: string; dueOn: string | null; url: string; closed: boolean }[]`
- `PracticeIssue` gains `iteration?: string | null` (iteration id on the `Sprint` field), `milestone?: number | null`, `subIssues?: number[]`, `blockedBy?: number[]`

`src/server/github/read-practice.ts` (`... on ProjectV2IterationField { id name dataType configuration { iterations { id title startDate duration } completedIterations { ... } } }` with both lists merged, newest last; item `fieldValueByName(name: "Sprint") { ... on ProjectV2ItemFieldIterationValue { iterationId } }`; `repository.milestones(first: 20, states: [OPEN, CLOSED])`; issue `milestone { number }`, `subIssues(first: 20) { nodes { number } }`, `blockedBy(first: 10) { nodes { number } }`) and its fixture.
**Tests:** `read-practice.test.ts` `maps the sprint field's iterations, each item's sprint, the milestones, sub-issues and what blocks each issue`.
- [ ] Steps: failing test; run (FAIL); implement; `npm run check` (PASS); commit `feat: read sprints, milestones, sub-issues and ropes on the team site (#9)`.

### Task 3: The capacity, the game's rule

**Files:** `src/server/db/schema.ts` (`players.capacity integer`), migration `0003`, `src/server/db/progress.ts` (`capacity(login): Promise<number | null>`, `setCapacity(login, points)`), `src/shared/levels/types.ts` (`Observed.capacity?: number | null`, `Observed.today?: string` as `YYYY-MM-DD`), `src/server/levels.ts` (fills both for a lead), `src/server/app.ts` (`POST /api/levels/capacity { points }`, zod `int().min(1).max(100)`, same demo handling as `/api/levels/path`).
**Tests:** `progress.test.ts` (db) `remembers the declared capacity`; `levels.test.ts` (server) `the capacity is refused outside 1 to 100`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` and `npm run test:db` (PASS); commit `feat: the sprint's capacity, kept as the game's rule (#9)`.

### Task 4: The Site manager checks

**Files:** `src/shared/levels/lead.ts` (`SITE_MANAGER: Level[]`, rank `"site-manager"`, path `"lead"`; `SIZE_POINTS`; `currentIteration(field, today)`: the iteration with `startDate <= today < startDate + duration`; `sprintLoad(team, today)`: `{ iteration, pallets, points, unsized }`), `src/shared/levels/index.ts` (`LEAD = [...SITE_FOREMAN, ...SITE_MANAGER]`).
- `l5-sprint`: a `Sprint` field of type `ITERATION`; its current iteration holds at least one open issue; every one sized; their points `<= o.capacity` (capacity declared). Proof: the board URL.
- `l6-milestone`: an open milestone with a due date and at least one issue whose `milestone` is its number. Proof: the milestone URL.
- `l7-split`: an issue with at least two sub-issues. Proof: its URL.
- `l8-rope`: an open issue with at least one `blockedBy`. Proof: its URL.
**Tests:** `lead.test.ts`: done and not yet for each, plus `l5 passes again once the load fits`, `l5 needs every pallet of the sprint sized`, `l5 needs a capacity declared`, `l5 counts only the current sprint`, `l6 needs a due date and an issue under it`, `l7 needs two parts at least`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Site manager checks: sprint, milestone, split, rope (#9)`.

### Task 5: The Site manager's gestures

**Files:** `src/shared/gestures/team.ts` (`TeamKind` gains `"sprint-field" | "load" | "unload" | "milestone" | "attach" | "split" | "rope"`; `TeamArgs` gains `title?`, `dueOn?`, `issues?: number[]`, `milestone?`, `titles?: string[]`, `blocking?`; `rebuildTeam(kind, args, viewer, name, team, today)`), `src/shared/gestures/practice.ts` (`PracticeMutationName` gains `"createMilestone"` (REST), `"addSubIssue"`, `"addBlockedBy"`, `"clearProjectV2ItemFieldValue"`), `src/server/github/practice-apply.ts` (REST step `createMilestone` posting to `/repos/<repo>/milestones`, its `node_id` filling `$milestoneId`; the three mutations in `MUTATIONS`), `src/github/api-coverage.ts` (decisions already gestures; check the test stays green).
- `prepareSprintField(team, today)`: no `Sprint` field: `createProjectV2Field` (`ITERATION`, `iterationConfiguration { startDate: today, duration: 7, iterations: [{ title: "Sprint 1", startDate: today, duration: 7 }] }`); field with no current iteration: `updateProjectV2Field` with every iteration it has (ids kept) plus `Sprint <n+1>` from today; a current iteration: refused.
- `prepareLoad(team, issueNumber, today)`: `updateProjectV2ItemFieldValue` with `{ iterationId }` of the current iteration; refused without a current sprint, off the board, or already loaded. `prepareUnload(team, issueNumber)`: `clearProjectV2ItemFieldValue` on the Sprint field; refused when not loaded.
- `prepareMilestone(team, title, dueOn, issues, today)`: `createMilestone { title, description: PRACTICE_LINE, due_on: "<dueOn>T12:00:00Z" }`, then `updateIssue { id, milestoneId: "$milestoneId" }` per issue; refused: blank title, title of an open milestone, `dueOn` not `YYYY-MM-DD` or before today, no issue. `prepareAttach(team, issueNumber, milestoneNumber)`: one `updateIssue`.
- `prepareSplit(team, issueNumber, titles)`: per non-blank title, `createIssue` (title prefixed `FICTIF ` unless it starts so; body `Part of #<n>.\n\n` + `PRACTICE_LINE`), `addProjectV2ItemById` (`$issueId`), `addSubIssue { issueId: parent, subIssueId: "$issueId" }`; refused under two titles or on a closed issue.
- `prepareRope(team, issueNumber, blockingNumber)`: `addBlockedBy`; refused: itself, already roped, or the other already waits for this one.
**Tests:** `team.test.ts`: `creates the Sprint field with its first week`, `adds the next sprint, keeping the past ones`, `loads and unloads a pallet on the current sprint`, `sets the mayor's visit and puts issues under it`, `refuses a past or malformed due date, and a title in use`, `splits into FICTIF parts, each a sub-issue on the board`, `refuses a split in fewer than two parts`, `ropes one pallet behind another`, `refuses a rope to itself or a circle`; `practice-apply.test.ts` `creates the milestone over REST and fills its id`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Site manager's gestures: sprint, milestone, split, rope (#9)`.

### Task 6: Routes and the view

**Files:** `src/server/app.ts` (the `:kind` regex gains the seven kinds; `today` from the server clock in UTC, the same for prepare and apply), `src/server/levels.ts` and `src/shared/api.ts` (`LevelsView.team` gains `sprint: { field: boolean; current: string | null; points: number; capacity: number | null; unsized: number[] }` and `milestones: { number: number; title: string; dueOn: string | null }[]`).
**Tests:** `levels.test.ts` (server): `a sprint gesture is rebuilt with the server's date`, `the view tells the sprint's load against the capacity`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Site manager's routes and view (#9)`.

### Task 7: The Site manager on screen

**Files:** `src/client/levels.ts` (`MentorAction` gains `"sprint-field" | "capacity" | "milestone"`: at `l5-sprint`, `"sprint-field"` without a current sprint, then `"capacity"` without one declared, then the card's Load or Unload; at `l6-milestone`, `"milestone"`; L7 and L8 on the cards; `Speaker` gains `"crane"` for `l7-split` and `l8-rope`, the mayor for `l6-milestone`), `src/client/ui/Mentor.tsx`, `src/client/ui/Overlays.tsx` (card buttons Load, Unload, Split, Rope, Under the milestone), `src/client/ui/PracticeDialogs.tsx` (capacity dialog naming the game's rule and the points per size; sprint, milestone, split and rope dialogs with their exact requests), `src/client/scene/Site.tsx` (on the team site from L5: the sprint truck by the road, built from boxes, a label with points against capacity; the mayor's ribbon post with the next due date), both locales (`levels.l5..l8.*`, `skills.rank.site-manager`, `mentor.rankDone.site-manager`, `speakers.crane`, `team.*`).
**Tests:** `levels.test.ts` (client): `the sprint first, then the capacity, then the loading`, `the mayor sets the visit`, `Gérard teaches the split and the rope`; parity extended; e2e on the demo: the capacity dialog shows the points per size, the milestone dialog shows its REST request without Send.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npx playwright test` (PASS); commit `feat: the Site manager rank on screen (#9)`.

### Task 8: The real run, the review, the close

- [ ] **After the owner says go**, on `guillaume-flambard/my-first-team` (private, FICTIF): create the sprint, declare a capacity, load within it, set the mayor's visit, split "Rebuild the whole town square", rope two pallets; check each on GitHub (iteration dates, milestone due date shown) and in the game.
- [ ] Independent review against this Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] Show the owner the screenshots; close #9 with the evidence once seen.
