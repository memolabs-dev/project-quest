# The lead's path, slice 5a: choosing the path, and the Site foreman rank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player chooses "run the site", founds their team site `my-first-team` (board with five zones and a Size field), receives the mayor's six FICTIF parcels, sorts them (labels, the duplicate closed as such), writes the inspector's Definition of Ready on one and moves it to Ready, and sizes the Ready work; each level stamped only on what GitHub shows.

**Architecture:** The levels engine gains paths: each level belongs to `"volunteer"` or `"lead"`; the server checks both paths and the view follows the path the player chose. The lead's site is a second practice repository read by the same reader, extended with what the lead's levels need (Status options, fields, repository labels, each issue's labels, body, close reason, Size). New gestures follow the practice pattern (pure prepare, server rebuild, guard on `my-first-team`).

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-lead-path-design.md` (sections 2 to 7, levels L1 to L4), with `2026-11-17-levels-design.md` for the engine.

## Global Constraints

- Every levels constraint holds (server decides stamps; every write shown, confirmed, logged; both locales; no em or en dash in French; FICTIF content in tests and real runs).
- The lead's writes go only to `<viewer>/my-first-team` (env `QUEST_TEAM_REPO`), refused by the server otherwise; the volunteer's practice guard is untouched.
- Everything the fictitious team writes carries `FICTIF` in its title and the line `Written by project-quest for practice.` in its body. The game assigns nobody.
- The five zones are the main spec's: `Backlog`, `Ready`, `In progress`, `In review`, `Done` (the locales already name them Stock, Ready to lay, Being laid, Inspection, Laid). Sizes: `XS`, `S`, `M`, `L`, `XL`.
- API facts checked in the schema on 2026-11-17: `updateProjectV2Field` takes `singleSelectOptions` (name, color, description required); `createProjectV2Field` takes `dataType: SINGLE_SELECT`; `closeIssue` takes `stateReason: DUPLICATE` and `duplicateIssueId`; `Issue.stateReason` and `Issue.duplicateOf` are readable; `addLabelsToLabelable` takes label ids.

## Review Focus

1. A player already deep in the volunteer's path chooses the lead's: the volunteer's stamps stay, and neither path's stamps count for the other (Task 1 test `stamps never count across paths`).
2. `my-first-team` exists with a board but the default Status options (Todo, In Progress, Done): founding offers the setup steps only, never a second repository or board (Task 4 test `sets up an existing team board`).
3. The duplicate closed as "not planned" or "completed" instead of "duplicate": L2 does not pass, Mémé says why (Task 3 test `l2 needs the duplicate closed as a duplicate`).
4. A checklist written with `* [ ]` or `- [x]` (all ticked): L3 still passes (Task 3 test `any task list counts`).
5. An issue moved out of Ready after being sized: L4 is judged on what is in Ready now, and needs at least one (Task 3 test `l4 needs something in Ready, all of it sized`).

---

### Task 1: Paths in the engine

**Files:** `src/shared/levels/types.ts` (`Level.path: "volunteer" | "lead"`; `Rank` gains `"site-foreman" | "site-manager" | "project-director"`), every level file (volunteer levels get `path: "volunteer"`), `src/shared/levels/progress.ts` (`currentLevel`, `rankReached` take the levels of one path), `src/server/db/schema.ts` (`players.path`), a drizzle migration, `src/server/db/progress.ts` (`path(login)`, `setPath(login, path)`), `src/server/levels.ts` (checks both paths, each stopping at its first level not passed), `src/shared/api.ts` (`LevelsView.path: "volunteer" | "lead" | null`; `current` and `rank` follow the chosen path, `null` path counts as volunteer; `ranks: { volunteer: Rank | null; lead: Rank | null }`), `src/server/app.ts` (`POST /api/levels/path { path }`).
**Tests:** `progress.test.ts` `each path has its own current level and rank`; `levels.test.ts` (server) `stamps never count across paths`, `choosing a path is remembered`; `progress.test.ts` (db) `remembers the chosen path`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` and `npm run test:db` (PASS); commit `feat: two paths in the levels engine, volunteer and lead (#8)`.

### Task 2: Read the team site

**Files:** `src/shared/levels/types.ts` (`PracticeSnapshot` gains `board.statusOptions: string[]`, `board.fields: { id: string; name: string; dataType: string; options: { id: string; name: string }[] }[]`, `board.statusFieldId: string`, `labels: { id: string; name: string }[]`; `PracticeIssue` gains `labels: string[]`, `body: string`, `stateReason: string | null`, `duplicateOf: number | null`, `itemId: string | null`, `size: string | null`), `src/server/github/read-practice.ts` and its fixture.
**Tests:** `read-practice.test.ts` `maps the board's fields, the repository's labels and each issue's labels, body, close reason and size`.
- [ ] Steps: failing test; run (FAIL); implement, updating snapshot literals; `npm run check` (PASS); commit `feat: read what the lead's levels need from a team site (#8)`.

### Task 3: The Site foreman checks

**Files:** Create `src/shared/levels/lead.ts` (`SITE_FOREMAN: Level[]`: `l1-found-team`, `l2-sort-parcels`, `l3-ready`, `l4-size`, path `"lead"`, rank `"site-foreman"`), `src/shared/levels/parcels.ts` (the mayor's six parcels: titles, bodies, which one duplicates which; the marker line), `src/shared/levels/index.ts` (`LEVELS_BY_PATH`).
- Rules (on `Observed.team`, the team site's snapshot):
  - `l1-found-team`: a board whose Status options are exactly the five zones in order, and a single-select field `Size` with the five sizes. Proof: the board URL.
  - `l2-sort-parcels`: the six parcels exist (found by their marker), each open one has at least one label, and the parcel written as a duplicate is closed with `stateReason` `DUPLICATE`. Proof: the duplicate's URL.
  - `l3-ready`: an open parcel whose body has a task list (a line starting `- [ ]`, `- [x]`, `* [ ]` or `* [x]`) and whose status is `Ready`. Proof: its URL.
  - `l4-size`: at least one issue in `Ready`, every one of them with a Size. Proof: the board URL.
**Tests:** `lead.test.ts`: done and not yet for each, plus `l2 needs the duplicate closed as a duplicate`, `any task list counts`, `l4 needs something in Ready, all of it sized`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Site foreman checks: found, sort, ready, size (#8)`.

### Task 4: The lead's gestures

**Files:** Create `src/shared/gestures/team.ts`; Modify `src/server/github/practice-apply.ts` (new mutation names; `createProjectV2` returns `projectV2 { id field(name: "Status") { ... on ProjectV2SingleSelectField { id } } }` so `$projectId` and `$statusFieldId` can be filled), `src/github/api-coverage.ts` (`updateProjectV2Field`, `createProjectV2Field` become gestures: setting up your team board).
- `prepareFoundTeam(viewer, existing, name, visibility)`: missing repository → `createRepository`; missing board → `createProjectV2`; Status options not the five zones → `updateProjectV2Field` (`fieldId` the status field, `singleSelectOptions` the five zones with colors and one-line descriptions); no `Size` field → `createProjectV2Field` (`SINGLE_SELECT`, the five sizes). Refuses when nothing is missing.
- `prepareParcels(team)`: the six parcels from `parcels.ts`, each `createIssue` then `addProjectV2ItemById`; refuses when the parcels already arrived.
- `prepareLabel(team, issueNumber, labelName)`: `addLabelsToLabelable` with the repository label's id; refuses an unknown label.
- `prepareCloseDuplicate(team, issueNumber, originalNumber)`: `closeIssue` with `stateReason: "DUPLICATE"` and `duplicateIssueId`.
- `prepareChecklist(team, issueNumber, items)`: `updateIssue` with the body plus a `## Definition of Ready` block of `- [ ]` lines; refuses an empty list.
- `prepareSize(team, issueNumber, size)`: `updateProjectV2ItemFieldValue` on the Size field.
**Tests:** `team.test.ts`: `founds a team site: repository, board, five zones, sizes`, `sets up an existing team board`, `the mayor's six parcels, each put on the board`, `refuses the parcels twice`, `labels with the repository's own label`, `closes the duplicate as a duplicate of its original`, `writes the Definition of Ready under the body`, `sizes on the board's Size field`; `practice-apply.test.ts` `fills the new board's and its status field's ids`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the lead's gestures: found the team site, the mayor's parcels, sort, ready, size (#8)`.

### Task 5: Server routes and the team guard

**Files:** `src/server/deps.ts` (`teamName`), `src/server/app.ts` (`/api/team/:kind/prepare|apply` for `found`, `parcels`, `label`, `duplicate`, `checklist`, `size`; `/api/site?site=team`; `/api/team/moves/*`; the guard: target `<viewer>/<teamName>`, `?demo=1` never sends, rebuild from a fresh read, `isDeepStrictEqual`, log), `src/server/levels.ts` (`Observed.team`).
**Tests:** `levels.test.ts`: `refuses a lead gesture outside the team site`, `sends a lead gesture the server rebuilt and logs it`, `a page marked demo never sends`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the team site's routes behind their own guard (#8)`.

### Task 6: Choosing the path, the team site on screen, the voices

**Files:** `src/client/levels.ts` (`SiteKind` gains `"team"` from `?site=team`; `mentorAction` for the lead's levels: `"choose"` with no path chosen, `"to-team"`, `"found-team"`, `"parcels"`, then card gestures), `src/client/ui/Mentor.tsx` (the first question: "lend a hand" or "run the site"; the speaker of each lead level: Mémé, the mayor, the inspector), `src/client/ui/Overlays.tsx` (on the team site, a parcel's card offers Label, Close as duplicate, Definition of Ready, Size, depending on the level), `src/client/ui/PracticeDialogs.tsx` (the lead's dialogs, each with its plain sentence and the exact request), `src/client/ui/SkillBook.tsx` (both paths, a switch), `src/client/scene/Site.tsx` (on the team site at rank Site foreman, each yard sign shows its count), both locales (`levels.l1..l4.*`, `skills.rank.site-foreman`, `mentor.choose.*`, `mentor.rankDone.site-foreman`, `speakers.*`, `team.*`).
**Tests:** `levels.test.ts` (client): `asks the path first`, `sends a lead to their team site`, `founds, then the parcels, then the card gestures`; parity extended; e2e on the demo: choosing "run the site" sets the lead's path, and the founding dialog shows its requests without Send.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npx playwright test` (PASS, ui-check included); commit `feat: choose your path, and the Site foreman rank on screen (#8)`.

### Task 7: The real run, the review, the close

- [ ] **After the owner says go**, on `guillaume-flambard/my-first-team` (private, FICTIF): choose "run the site", found it, receive the parcels, sort them, write the Definition of Ready, size; check each on GitHub and in the game.
- [ ] Independent review against this Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] Show the owner the screenshots; close #8 with the evidence once seen.
