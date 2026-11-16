# Levels, slice 4a: the Apprentice rank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A volunteer who has never used GitHub plays levels 1 to 7: the tutorial on the fictitious site, then founds their practice site in their own account, writes, takes and moves an issue there, each level stamped in a skill book only once GitHub confirms it, guided by Mémé Truelle.

**Architecture:** Levels are data in `src/shared/levels/` with pure check functions over an `Observed` object. The server builds `Observed` (tutorial events it stored, or a read of the practice repository on GitHub), runs the checks, stores stamps with their proof in a `progress` store (Postgres live, memory in demo and tests). Practice gestures follow the move gesture's pattern: a pure `prepare*` the confirmation shows, a server `apply` that rebuilds it and refuses any target outside the practice repository.

**Tech Stack:** as the repo: React 19, R3F 9, zustand 5, Hono 4, `@octokit/graphql`, zod 4, Drizzle 0.45 on Postgres 18, i18next, Vitest 5, Playwright 1.65.

**Spec:** `docs/superpowers/specs/2026-11-17-levels-design.md` (and `2026-11-16-project-quest-design.md` principles 2, 3, 5).

## Global Constraints

- A level passes only when the server's check says so; the browser never stamps.
- During levels, writes go only to the practice repository in the viewer's own account; the server refuses any other target (409, nothing sent).
- Every write is shown, then confirmed, and recorded in `action_log`.
- Practice repository default name `my-first-site`, overridable with env `QUEST_PRACTICE_REPO`; public by default, private on request; never overwritten, never deleted.
- Every word in `src/locales/{en,fr}/common.json`; parity test green; no em or en dash in French copy.
- Progress is personal: no API returns another player's stamps.
- Tests and manual runs: FICTIF content only, never a real organisation's project. The manual practice run happens on an account the owner names, after the owner says go.

## Review Focus

1. The viewer already has a repository named `my-first-site` with real content: the game reuses it, never overwrites, and the confirmation says plainly that it exists and will be used (Task 4 test `reuses an existing repository`).
2. The repository exists but has no linked board: founding creates only the board (Task 4 test `creates only the board when the repository exists`).
3. The practice board's columns are not "Todo / In Progress / Done" (renamed, or extra columns): level 7 still passes when the issue leaves the first column (Task 1 test `a7 passes on any column after the first`).
4. A level gesture whose target is another repository, or the same name under another owner (case differs): refused by the server (Task 5 test `refuses a target outside the practice repository`).
5. The token lacks the `project` scope when founding: the player sees the `gh auth refresh -s project` hint, nothing half-created is hidden (Task 5 test `founding without project scope answers github-scope`).

---

### Task 1: Levels as data, the Apprentice checks

**Files:**
- Create: `src/shared/levels/types.ts`, `src/shared/levels/apprentice.ts`, `src/shared/levels/progress.ts`
- Test: `src/shared/levels/apprentice.test.ts`, `src/shared/levels/progress.test.ts`

**Interfaces:**
- Produces:
  - `type Rank = "apprentice" | "journeyman" | "team-leader" | "real-project"`
  - `type TutorialEvent = "walked" | "card-opened" | "card-read" | "pallet-moved"`
  - `interface PracticeIssue { number: number; url: string; author: string; assignees: string[]; comments: { author: string; url: string }[]; status: string | null; closed: boolean }`
  - `interface PracticeSnapshot { repo: { nameWithOwner: string; url: string }; board: { number: number; url: string; columns: string[] } | null; issues: PracticeIssue[] }`
  - `interface Observed { viewer: string; events: TutorialEvent[]; practice: PracticeSnapshot | null }`
  - `interface Check { done: boolean; proof: string | null }` (proof: a GitHub URL, or `"tutorial"`)
  - `interface Level { id: string; rank: Rank; where: "tutorial" | "practice"; check(o: Observed): Check }` (locale keys derive from `id`: `levels.<id>.skill`, `.goal`, `.lesson`)
  - `APPRENTICE: Level[]` with ids in order `a1-walk`, `a2-read-issue`, `a3-read-board`, `a4-found-site`, `a5-write-issue`, `a6-take-issue`, `a7-move-issue`
  - `currentLevel(levels: Level[], stamped: ReadonlySet<string>): Level | null` (first not stamped)
  - `rankReached(levels: Level[], stamped: ReadonlySet<string>): Rank | null` (a rank is reached when all its levels are stamped)
  - `unlocks(stamped: ReadonlySet<string>): { helmet: boolean; skillBook: boolean; ownSite: boolean }` (helmet and skill book after `a1-walk`; own site after `a4-found-site`)

Check rules (case-insensitive logins):
- `a1-walk`: events include `walked` and `card-opened`; `a2-read-issue`: `card-read`; `a3-read-board`: `pallet-moved`. Proof `"tutorial"`.
- `a4-found-site`: practice non-null and `board` non-null. Proof: board URL.
- `a5-write-issue`: an issue whose `author` is the viewer. Proof: its URL (lowest number).
- `a6-take-issue`: an open issue assigned to the viewer with a comment by the viewer. Proof: the comment URL.
- `a7-move-issue`: an open issue assigned to the viewer whose status is non-null and not `board.columns[0]`. Proof: issue URL.

- [ ] **Step 1: Write the failing tests** in `apprentice.test.ts`, using a `snapshot(overrides)` helper building a FICTIF `PracticeSnapshot` (`repo.nameWithOwner: "fictif-volunteer/my-first-site"`, columns `["Todo", "In Progress", "Done"]`). One `describe` per level with a "done" and a "not yet" case, plus:
  - `a5 ignores an issue written by someone else` (author `"someone-else"` gives `done: false`)
  - `a6 needs both the assignment and the viewer's own comment`
  - `a7 passes on any column after the first` (columns `["Inbox", "Doing", "Shipped"]`, status `"Doing"` gives done; status `"Inbox"` or `null` gives not yet)
  - `logins compare without case` (viewer `"Fictif-Volunteer"`, author `"fictif-volunteer"` gives done)
  - in `progress.test.ts`: `currentLevel` returns `a1-walk` with nothing stamped and `null` with all seven; `rankReached` is `null` at six stamps and `"apprentice"` at seven; `unlocks` after `a1-walk` gives `{ helmet: true, skillBook: true, ownSite: false }`.
- [ ] **Step 2: Run** `npx vitest run src/shared/levels`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the three files to the interfaces above.
- [ ] **Step 4: Run** `npx vitest run src/shared/levels`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: levels as data, the Apprentice checks (#4)`.

### Task 2: Mémé Truelle's words

**Files:**
- Modify: `src/locales/en/common.json`, `src/locales/fr/common.json`
- Modify: `src/locales/parity.test.ts`

**Interfaces:**
- Consumes: `APPRENTICE` ids (Task 1).
- Produces: keys `mentor.name` ("Mémé Truelle" in both), `mentor.checkAgain`, `mentor.notYet`, `mentor.stamped` (with `{{skill}}`), `mentor.toTutorial`, `mentor.toPractice`, `mentor.connectGithub`, `skills.title`, `skills.proof`, `skills.rank.apprentice`, and for each level `levels.<id>.skill`, `levels.<id>.goal`, `levels.<id>.lesson`.

The four lines fixed by the spec (section 5) go in verbatim: `levels.a2-read-issue.lesson` is the "That's an issue…" line, `levels.a6-take-issue.lesson` the "You said 'I'll take it'…" line, `mentor.notYet` the "Not yet…" line; the pull request line waits for 4b. Other lines: Mémé's voice, short sentences, one "why", no deadline.

- [ ] **Step 1: Add the failing test** `has a skill, a goal and a lesson for every level` in `parity.test.ts`: for each `APPRENTICE` id, `en["levels.<id>.skill"]`, `.goal`, `.lesson` are truthy.
- [ ] **Step 2: Run** `npx vitest run src/locales`. Expected: FAIL on the new test.
- [ ] **Step 3: Write** the keys in both files.
- [ ] **Step 4: Run** `npx vitest run src/locales`, then `python3 ~/.claude/skills/humanizer/lint.py src/locales/fr/common.json`. Expected: PASS; no dash flagged.
- [ ] **Step 5: Commit** `feat: Mémé Truelle's words for the Apprentice levels, in English and French (#4)`.

### Task 3: The progress store

**Files:**
- Create: `src/server/db/progress.ts`, `drizzle/<generated>.sql`
- Modify: `src/server/db/schema.ts` (table `progress`; `players.practice_repo` text, nullable)
- Test: `src/server/db/progress.test.ts`

**Interfaces:**
- Produces:
  - `interface Stamp { levelId: string; stampedAt: string; proof: string }`
  - `interface ProgressStore { stamps(login: string): Promise<Stamp[]>; stamp(login: string, levelId: string, proof: string): Promise<void>; events(login: string): Promise<TutorialEvent[]>; addEvent(login: string, e: TutorialEvent): Promise<void>; practiceRepo(login: string): Promise<string | null>; setPracticeRepo(login: string, name: string): Promise<void> }`
  - The practice name used is `practiceRepo(login) ?? practiceName` (env default); a successful founding calls `setPracticeRepo`.
  - `memoryProgress(): ProgressStore`, `pgProgress(url: string): ProgressStore & { clearForTests(): Promise<void> }`
- Table `progress`: `player_login`, `level_id`, `stamped_at`, `proof`, unique (`player_login`, `level_id`); table `tutorial_events`: `player_login`, `event`, `created_at`, unique (`player_login`, `event`). Logins stored lower-case.

- [ ] **Step 1: Write the failing tests**, run against both stores (`describe.each`; the pg one skipped without `DATABASE_URL`, like `log.test.ts`): `stamping twice keeps the first date`; `one player's stamps are not another's`; `logins are case-insensitive`; `events are kept once each`; `remembers the practice repository's name`.
- [ ] **Step 2: Run** `npx vitest run src/server/db/progress.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement**, then `npx drizzle-kit generate` for the migration.
- [ ] **Step 4: Run** `npm run db:up && npm run db:migrate && npm run test:db`. Expected: PASS for memory and Postgres.
- [ ] **Step 5: Commit** `feat: the progress store, in memory and in Postgres (#4)`.

### Task 4: Reading the practice site, and its gestures

**Files:**
- Create: `src/server/github/read-practice.ts`, `src/server/github/__fixtures__/practice-response.json` (FICTIF, hand-written to the query's shape), `src/shared/gestures/practice.ts`
- Test: `src/server/github/read-practice.test.ts`, `src/shared/gestures/practice.test.ts`

**Interfaces:**
- Consumes: `PracticeSnapshot` (Task 1), `QuestConfig`, `readBoard` (existing).
- Produces:
  - `readPractice(gql: Gql, owner: string, name: string): Promise<PracticeSnapshot | null>`: one query `repository(owner, name) { nameWithOwner url projectsV2(first: 1) { nodes { number url field(name: "Status") { … options { name } } } } issues(first: 50, states: [OPEN, CLOSED]) { … author assignees comments(first: 20) { author url } } }`; status per issue from its project item on that board; `null` when the repository does not exist.
  - `practiceConfig(owner: string, name: string, boardNumber: number, columns: string[]): QuestConfig` (fields Status/Iteration/Size, zones = columns, no labels), so the existing `readBoard` and `buildSite` draw the practice site.
  - `interface PreparedFound { kind: "found"; owner: string; name: string; visibility: "PUBLIC" | "PRIVATE"; reuse: boolean; mutations: { name: "createRepository" | "createProjectV2"; input: Record<string, unknown> }[] }`
  - `prepareFound(viewer: { login: string; id: string }, existing: PracticeSnapshot | null, name: string, visibility: "PUBLIC" | "PRIVATE"): PreparedFound` (`createProjectV2` takes `repositoryId` from the created or existing repository: the input shows the placeholder `"$repositoryId"` when the repository is new, filled by `apply`)
  - `interface PreparedIssue { kind: "issue"; repo: string; title: string; body: string; mutations: […"createIssue", "addProjectV2ItemById"] }`, `prepareIssue(practice: PracticeSnapshot, title: string, body: string): PreparedIssue` (title required, trimmed, at most 256 characters, the `GestureError` otherwise)
  - `interface PreparedTake { kind: "take"; repo: string; issueNumber: number; comment: string; mutations: […"addAssigneesToAssignable", "addComment"] }`, `prepareTake(practice: PracticeSnapshot, viewer: string, issueNumber: number, comment: string): PreparedTake` (refuses a closed issue and an issue already assigned to someone else: nobody is taken from)
- Moving on the practice board reuses `prepareMove` on `readBoard(gql, practiceConfig(…))`.

- [ ] **Step 1: Write the failing tests.** `read-practice.test.ts` on the fixture: maps author, assignees, comments and status; returns `null` on `repository: null`. `practice.test.ts`:
  - `founds a new site: a repository then a board linked to it` (two mutations in that order, visibility as asked, `reuse: false`)
  - `reuses an existing repository` (no `createRepository`, `reuse: true`)
  - `creates only the board when the repository exists` (existing with `board: null`)
  - `founds nothing when the site is complete` (`GestureError`)
  - `refuses an empty or too long title`
  - `takes an open issue: assign yourself, then your comment`
  - `never takes an issue assigned to someone else`
- [ ] **Step 2: Run** `npx vitest run src/server/github/read-practice.test.ts src/shared/gestures/practice.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: read the practice site; prepare founding, an issue and taking it (#4)`.

### Task 5: Server routes, the guard, the API decisions

**Files:**
- Create: `src/server/github/practice-apply.ts`, `src/server/levels.ts`
- Modify: `src/server/app.ts`, `src/server/deps.ts`, `src/shared/api.ts`, `src/github/api-coverage.ts`
- Test: `src/server/levels.test.ts`, `src/server/github/practice-apply.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces:
  - `Deps` gains `progress: ProgressStore`, `practiceName: string`, `viewerId(): Promise<string>`, `readPractice(owner: string, name: string): Promise<PracticeSnapshot | null>`, `applyPractice(p: PreparedFound | PreparedIssue | PreparedTake): Promise<{ ok: true } | { ok: false; reason: string }>`. Demo deps: `readPractice` resolves `null`, `applyPractice` refuses ("connect GitHub").
  - `observe(deps: Deps): Promise<Observed>` and `checkLevels(deps: Deps): Promise<LevelsView>` in `levels.ts`: runs `APPRENTICE` checks in order, stamps each passing one not yet stamped, stops at the first not passing.
  - `interface LevelsView { stamps: Stamp[]; current: string | null; rank: Rank | null; unlocks: ReturnType<typeof unlocks>; practice: { name: string; exists: boolean } }` in `src/shared/api.ts`.
  - Routes: `GET /api/levels`; `POST /api/levels/check`; `POST /api/levels/event` `{ event: TutorialEvent }`; `GET /api/site?site=practice` (practice site via `practiceConfig`, 404 `{ error: "practice-missing" }` before founding); `POST /api/practice/{found,issue,take}/prepare` and `/apply` (apply rebuilds with `prepare*` from a fresh read and compares, like moves, then logs and returns the new `LevelsView`); `POST /api/practice/moves/{prepare,apply}`.
  - Level routes use the viewer of the live deps; with no GitHub access they fall back to the demo deps' viewer `"you"`.
- `api-coverage.ts`: `createRepository` and `createProjectV2` become `gesture("Found your practice site: your own repository and its board, in your account")`; `linkProjectV2ToRepository` stays out (the board links at creation through `repositoryId`); the COVERAGE report regenerated with `npm run api:coverage`.

- [ ] **Step 1: Write the failing tests** in `levels.test.ts` with fake deps (memory progress, a scripted `readPractice`):
  - `refuses a target outside the practice repository` (prepared issue for `fictif-volunteer/other-repo`, then for `FICTIF-OTHER/my-first-site`: 409, `applyPractice` never called)
  - `refuses a prepared gesture that does not match a fresh read` (409)
  - `founding without project scope answers github-scope` (`applyPractice` throws `GitHubScopeError`: 503 with hint `gh auth refresh -s project`)
  - `a tutorial event stamps its level on check` (event `walked` + `card-opened` then check: `a1-walk` stamped, `current` is `a2-read-issue`)
  - `stamps stop at the first level not passed` (practice snapshot with an issue but no board: `a4` not stamped, so `a5` not stamped even though its issue exists)
  - `a lost stamp comes back from GitHub` (empty store, full snapshot, check stamps a4 to a7)
  - `GET /api/levels never shows another player's stamps`
  In `practice-apply.test.ts`: `founding fills the new repository's id into the board's input` (fake gql records calls).
- [ ] **Step 2: Run** `npx vitest run src/server`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check`. Expected: PASS, API coverage test included.
- [ ] **Step 5: Commit** `feat: level routes, practice gestures behind a server guard (#4)`.

### Task 6: Mémé Truelle and the skill book on screen

**Files:**
- Create: `src/client/ui/Mentor.tsx`, `src/client/ui/SkillBook.tsx`, `src/client/levels.ts`
- Modify: `src/client/api.ts`, `src/client/store.ts`, `src/client/ui/Overlays.tsx` (with PalletCard), `src/client/ui/ui.css`, `src/client/scene/Player.tsx`
- Test: `src/client/levels.test.ts`

**Interfaces:**
- Consumes: `LevelsView` and routes (Task 5), locale keys (Task 2).
- Produces:
  - store: `levels: LevelsView | null`, `refreshLevels()`, `sendEvent(e: TutorialEvent)` (posts, then checks), `checkLevels()`.
  - `siteKindFromUrl(search: string): "main" | "demo" | "practice"` and `mentorAction(view: LevelsView, kind: "main" | "demo" | "practice"): "to-tutorial" | "to-practice" | "found" | "write" | "take" | "move" | "check" | null` in `src/client/levels.ts` (pure).
  - Events sent: `walked` (Player, first time the foreman moves), `card-opened` (PalletCard mount), `card-read` (the card's "Got it, Mémé" button, shown only while `a2-read-issue` is current), `pallet-moved` (a confirmed move on the demo site).
- **Mentor bubble** (bottom left, above the controls bar): name, the current level's lesson and goal, one action button from `mentorAction`, "Check again"; on a new stamp, the bubble shows `mentor.stamped` for 3 s with a stamp animation (none under reduced motion, the text stays).
- **Skill book**: a "Skills" button beside the logbook; one page for the Apprentice rank; a stamp per level with date and a proof link (opens GitHub in a new tab), an outline with the skill's line when not yet earned. Shown only once `unlocks.skillBook`.

- [ ] **Step 1: Write the failing tests** in `levels.test.ts`: `sends a new player to the tutorial` (nothing stamped, kind `main`: `"to-tutorial"`); `sends a tutorial graduate to their site` (a1 to a3 stamped, kind `demo`: `"to-practice"`); `asks to found when the site is missing` (kind `practice`, `practice.exists: false`: `"found"`); `asks for the level's gesture` (a5 current: `"write"`); `reads the site kind from the address` (`?demo=1` gives `demo`, `?site=practice` gives `practice`).
- [ ] **Step 2: Run** `npx vitest run src/client/levels.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the pure functions, then the store, the bubble, the book, the events.
- [ ] **Step 4: Run** `npm run check`, then the ui-check sweep `npx playwright test e2e/ui-check.spec.ts`. Expected: PASS, 0 findings at 375 and 1280 px.
- [ ] **Step 5: Commit** `feat: Mémé Truelle's bubble and the skill book (#4)`.

### Task 7: Practice dialogs and the Apprentice rewards

**Files:**
- Create: `src/client/ui/PracticeDialogs.tsx`
- Modify: `src/client/api.ts`, `src/client/ui/Overlays.tsx`, `src/client/scene/Site.tsx`, `src/client/scene/Player.tsx` (helmet initial), `src/App.tsx` (site kind from the address)
- Test: `e2e/practice-dialogs.spec.ts`

**Interfaces:**
- Consumes: Task 4 `Prepared*`, Task 5 routes, Task 6 `mentorAction`.
- Produces: three dialogs reusing the ConfirmMove layout (what is sent, as text, then Send / Cancel):
  - **Found your site**: name (default from `LevelsView.practice.name`, read-only in 4a), public/private choice, the plain sentence when `reuse` is true ("This repository already exists in your account: the game will use it, nothing in it is changed"), the mutations.
  - **Write an issue**: title, body, the mutations.
  - **Take an issue**: the issue, the comment (prefilled with the locale's "I'll take it", editable), the mutations.
- Rewards: a badge with the player's initial above the foreman once `unlocks.helmet`; on the practice site, a gate sign "<login>'s site" at the road (Html label at the site's left end) once `unlocks.ownSite`.
- In demo mode the dialogs open but Send is replaced by `mentor.connectGithub`.

- [ ] **Step 1: Write the failing e2e** `practice-dialogs.spec.ts` on the live test server with no GitHub access (port 5198, as `site.spec.ts` does for errors): open `?site=practice`, the mentor offers "found", the Found dialog shows `createRepository` and `createProjectV2` and the connect-GitHub line instead of Send.
- [ ] **Step 2: Run** `npx playwright test e2e/practice-dialogs.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check && npx playwright test`. Expected: PASS, load test included.
- [ ] **Step 5: Commit** `feat: found your site, write and take an issue, the Apprentice rewards (#4)`.

### Task 8: The tutorial end to end, the real run, the review

**Files:**
- Create: `e2e/tutorial.spec.ts`
- Modify: `e2e/screenshots/*` (new `levels-*` captures)

- [ ] **Step 1: Write** `tutorial.spec.ts` on the demo server: a fresh player walks (KeyW), opens a pallet, clicks "Got it, Mémé", moves a pallet through the confirmation; after "Check again" the skill book shows three stamps and the mentor offers `to-practice`. Screenshots `levels-mentor.png`, `levels-skillbook.png` at 1280 and 375 px.
- [ ] **Step 2: Run** `npx playwright test e2e/tutorial.spec.ts`. Expected: PASS.
- [ ] **Step 3: Real run, by hand, only after the owner names the account and says go:** found the practice site, write a FICTIF issue, take it, move it; check in the game that a4 to a7 are stamped with proof links that open on GitHub; record the URLs.
- [ ] **Step 4: Independent review** of the slice's range against this plan's Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] **Step 5: Commit** the e2e and screenshots `test: the Apprentice tutorial end to end (#4)`; show the owner the screenshots; close #4 with the evidence once the owner has seen them.
