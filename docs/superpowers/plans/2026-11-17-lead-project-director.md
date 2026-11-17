# The lead's path, slice 5c: the Project director rank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On their team site, the lead posts the evening bulletin as a board status update (L9), sets a work-in-progress limit on "Being laid", lets the fictitious team's day push it over and brings it back under (L10), and ends the mayor's visit: the milestone closed with all its jobs done, or its date moved (L11).

**Architecture:** Same pattern as 5a and 5b: the reader gains the board's status updates, the Status options' descriptions and the milestones' counts; three pure checks join `lead.ts`; new gestures join `team.ts` behind `/api/team/:kind`. Two writes are REST (milestone update). Two moments GitHub cannot show afterwards (the team's day happened, the visit was moved) are recorded by the server as game events after a successful send, like the tutorial's events.

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-lead-path-design.md` (sections 3, 4, 6, 8, 9: levels L9 to L11).

## Global Constraints

- Every 5a and 5b constraint holds: writes only to `<viewer>/my-first-team`, shown, confirmed, logged; `?demo=1` never sends; nobody assigned; both locales; no em or en dash in French; FICTIF content.
- **The WIP limit lives on GitHub** (decision of this plan, keeping spec principle 5: the only game rule stays the capacity): GitHub's board column limit is not in the API (`ProjectV2View` has no limit, checked 2026-11-17), so the limit is written in the description of the `In progress` Status option, as `Being laid. Limit: <n>.`, read back from `options { id name description }`. Limit: an integer from 1 to 10.
- API facts checked in `docs/github-api/schema.docs.graphql` on 2026-11-17: `createProjectV2StatusUpdate { projectId, status, body, startDate?, targetDate? }`, `status` one of `ON_TRACK`, `AT_RISK`, `OFF_TRACK`, `COMPLETE`, `INACTIVE`; `ProjectV2.statusUpdates(first, orderBy default CREATED_AT DESC) { status body createdAt }`; `ProjectV2SingleSelectFieldOption.description`; `closeIssue { stateReason: COMPLETED }`; milestones update over REST only: `PATCH /repos/{owner}/{repo}/milestones/{number}` with `state: "closed"` or `due_on`.
- Game events, recorded only after GitHub accepted the gesture: `team-day`, `visit-moved`. They never come from the browser (`/api/levels/event` keeps accepting tutorial events only).

## Review Focus

1. The team's day sent twice, or after the player already lowered the limit: it pushes exactly to limit + 2 from what is there now, and is refused when fewer open jobs exist than needed (Task 4 test `the team's day pushes "Being laid" two over its limit`).
2. The limit rewritten while items sit in "In progress": the option keeps its id, so no item loses its column (Task 4 test `writes the limit and keeps every option's id`).
3. A milestone whose jobs are not all closed: closing it is refused, the mayor says which remain (Task 4 test `refuses to close a visit with jobs still open`).
4. A date moved to the past, or to the same day: refused (Task 4 test `moves the visit to a later day only`).
5. L10 before the team's day: a site already under its limit does not pass (Task 3 test `l10 needs the team's day first`).

---

### Task 1: Read the bulletin, the limit and the visits' progress

**Files:** `src/shared/levels/types.ts` (`PracticeSnapshot.board.statusOptionIds` items gain `description?: string`; `board.statusUpdates?: { status: string | null; body: string; createdAt: string }[]`; `Milestone` gains `openIssues: number; closedIssues: number`), `src/server/github/read-practice.ts` (`field(name: "Status") { ... options { id name description } }`, `statusUpdates(first: 5) { nodes { status body createdAt } }`, milestone `openIssueCount closedIssueCount`), its fixture. Validate the query once against GitHub (read only) as in 5b.
**Tests:** `read-practice.test.ts` `maps the board's status updates, the zones' descriptions and each visit's progress`.
- [ ] Steps: failing test; run (FAIL); implement; `npm run check` (PASS); commit `feat: read the bulletin, the zones' limits and the visits' progress (#10)`.

### Task 2: Game events for the lead

**Files:** `src/shared/levels/types.ts` (`LEAD_EVENTS = ["team-day", "visit-moved"] as const`; `GameEvent = TutorialEvent | LeadEvent`; `Observed.events: GameEvent[]`), `src/server/db/progress.ts` (`events`/`addEvent` take `GameEvent`; the table already stores text).
**Tests:** `progress.test.ts` (db) `keeps a lead's events like the tutorial's`; `levels.test.ts` (server) `the browser cannot send a lead's event`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` and `npm run test:db` (PASS); commit `feat: the lead's game events, recorded by the server only (#10)`.

### Task 3: The Project director checks

**Files:** `src/shared/levels/lead.ts` (`PROJECT_DIRECTOR: Level[]`, rank `"project-director"`; `wipLimit(team): number | null` parses `Limit: <n>` in the `In progress` option's description; `inProgress(team): number` counts its open issues), `src/shared/levels/index.ts` (`LEAD` gains them).
- `l9-bulletin`: the board has at least one status update with a status and a non-blank body. Proof: the board URL.
- `l10-wip`: `wipLimit` set, the `team-day` event recorded, and `inProgress <= wipLimit`. Proof: the board URL.
- `l11-visit`: a milestone closed with `closedIssues >= 1` and `openIssues === 0`, or the `visit-moved` event recorded and an open milestone with a due date. Proof: that milestone's URL.
**Tests:** `lead.test.ts`: done and not yet for each, plus `l9 needs a status and words`, `l10 needs the team's day first`, `l10 reads the limit from the zone's description`, `l11 passes on a visit closed with all its jobs done, or moved`.
Locale words for `l9..l11` and `mentor.rankDone.project-director` land in this task (parity test).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Project director checks: bulletin, limit, visit (#10)`.

### Task 4: The Project director's gestures

**Files:** `src/shared/gestures/team.ts` (`TeamKind` gains `"bulletin" | "wip-limit" | "team-day" | "finish" | "close-visit" | "move-visit"`; `TeamArgs` gains `status?`, `body?`, `limit?`), `src/shared/gestures/practice.ts` (`"createProjectV2StatusUpdate"`, REST `"updateMilestone"`), `src/server/github/practice-apply.ts` (`PATCH /repos/<repo>/milestones/<number>` with the input minus `number`), `src/server/github/client.ts` (`Rest` method gains `"PATCH"`).
- `prepareBulletin(team, status, body)`: `createProjectV2StatusUpdate { projectId, status, body }`; refuses an unknown status or a blank body. `radioRecap(team, today, capacity)` (pure, in `lead.ts`): the draft the radio offers, one line each for the sprint load, "Being laid" against its limit, the next visit's progress; the player edits it.
- `prepareWipLimit(team, limit)`: `updateProjectV2Field` on the Status field, every option sent with its id, name, color and description, `In progress` with `Being laid. Limit: <n>.`; refuses outside 1 to 10.
- `prepareTeamDay(team)`: `updateProjectV2ItemFieldValue` to `In progress` for the lowest-numbered open issues not already there, as many as bring it to `limit + 2`; refuses without a limit, or with too few open issues. Each move listed in the confirmation (spec section 4).
- `prepareFinish(team, issueNumber)`: `closeIssue { issueId, stateReason: "COMPLETED" }`, then the move to `Done` when on the board.
- `prepareCloseVisit(team, milestoneNumber)`: `updateMilestone { number, state: "closed" }`; refuses while `openIssues > 0`.
- `prepareMoveVisit(team, milestoneNumber, dueOn, today)`: `updateMilestone { number, due_on: "<dueOn>T12:00:00Z" }`; refuses a malformed date, a past one, or the same day.
- The server records `team-day` and `visit-moved` after a send GitHub accepted (Task 5).
**Tests:** `team.test.ts`: `posts the evening bulletin`, `refuses a bulletin without words or with an unknown status`, `writes the limit and keeps every option's id`, `the team's day pushes "Being laid" two over its limit`, `finishes a job: closed as completed, laid in Done`, `refuses to close a visit with jobs still open`, `moves the visit to a later day only`; `lead.test.ts` `the radio drafts the bulletin from the board`; `practice-apply.test.ts` `updates the milestone over REST`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Project director's gestures: bulletin, limit, team's day, visit (#10)`.

### Task 5: Routes, events and the view

**Files:** `src/server/app.ts` (the `:kind` regex gains the six kinds; after an accepted `team-day` or `move-visit`, `progress.addEvent`), `src/server/levels.ts` and `src/shared/api.ts` (`LevelsView.team` gains `wip: { limit: number | null; count: number }`, `bulletin: { status: string | null; body: string } | null` (the newest), `radio: string` (the recap draft), and each milestone `openIssues`).
**Tests:** `levels.test.ts` (server): `records the team's day only once GitHub accepted it`, `the view tells "Being laid" against its limit and the last bulletin`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the Project director's routes, events and view (#10)`.

### Task 6: The Project director on screen

**Files:** `src/client/levels.ts` (`MentorAction` gains `"bulletin" | "wip-limit" | "team-day" | "visit"`: L9 `"bulletin"`; L10 `"wip-limit"` without a limit, then `"team-day"` before the event, then the card moves; L11 `"visit"`; `cardGestures` at L11 offers `finish` on an open issue under a visit; `Speaker` gains `"radio"` for `l9-bulletin`, the mayor for `l11-visit`; `teamRewards` gains `mast: { status, line } | null` from the newest bulletin), `src/client/ui/Mentor.tsx`, `src/client/ui/Overlays.tsx`, `src/client/ui/PracticeDialogs.tsx` (bulletin dialog: status choice and the radio's draft in a textarea; limit dialog; team's day dialog listing each move; visit dialog: close it, or move its date), `src/client/scene/Rewards.tsx` (the radio mast above the site office, its label the last bulletin's status and first line), both locales (`team.*`, `speakers.radio`, `rewards.mast`, `mentor.*`).
**Tests:** `levels.test.ts` (client): `the radio reads the bulletin`, `the limit, then the team's day, then the moves`, `the mayor's visit ends`, `the mast broadcasts the last bulletin`; parity extended to the new kinds; e2e on the demo: the bulletin dialog shows the radio's draft and the five statuses without Send.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npx playwright test` (PASS); commit `feat: the Project director rank on screen (#10)`.

### Task 7: The real run, the review, the close

- [ ] **After the owner says go**, on `guillaume-flambard/my-first-team` (private, FICTIF): post the bulletin, set the limit, send the team's day, bring "Being laid" back under, finish the visit's jobs and close it; check each on GitHub (status update on the board, the zone's description, the milestone closed) and in the game.
- [ ] Independent review against this Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] Show the owner the screenshots; close #10 with the evidence once seen.
