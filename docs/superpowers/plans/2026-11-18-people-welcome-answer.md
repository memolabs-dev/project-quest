# The people of the site, slice 7b: welcome and answer. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The lead sees on the site who waits for an answer ("?" above a pallet) and who just made a first pull request ("👋" above its pallet, or a visitor at the site office), and answers or welcomes them with a comment written from an editable draft; every write is shown and confirmed; the person waves; the skill book stamps each gesture the first time.

**Architecture:** The rules are pure (`src/shared/people.ts`: who waits, who is a newcomer; `src/shared/gestures/talk.ts`: what is sent, what is refused). The server reads one more field per issue (its last comment) and the open first-time pull requests, computes the signs for a lead (and for the demo), and prepares and applies the comment exactly like the warm gestures (prepare, confirm, rebuild from a fresh read, send, log). The client draws the bubbles and the visitor, offers the gesture near the pallet and on the card, holds a draft dialog then a confirmation, and plays the existing greet moment.

**Tech Stack:** as the repo (Hono server, `@octokit/graphql`, React 19, R3F 9.8, drei 10.7, zustand, Howler, Vitest, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-18-welcome-and-answer-design.md` (slice 7b), with the principles of `2026-11-17-people-of-the-site-design.md` section 3.

## Global Constraints

- The team is `authorAssociation` `OWNER`, `MEMBER` or `COLLABORATOR`, plus the player. Someone waits when the issue's last comment is not the team's and is older than `WAIT_MS = 24 * 60 * 60 * 1000`. No question mark is required.
- A newcomer is the author of an open pull request whose `authorAssociation` is `FIRST_TIMER` or `FIRST_TIME_CONTRIBUTOR`, on which the player has not commented (`viewerDidAuthor`).
- One mutation only: `addComment { subjectId, body }` (already in `practice-apply.ts` `MUTATIONS`). The game never adds an @mention or an assignment; when the player's words hold `@login`, the confirmation says "These words will notify @login." (both languages, the warm gestures' wording).
- The game never writes the answer's substance: the answer draft is the quoted comment and an empty line; the welcome draft thanks, says someone will review, and links `CONTRIBUTING.md` when the repository has one.
- The lead only on the real project: the signs and the gestures need `levels.path === "lead"` and `levels.ranks.lead !== null`; the server refuses the routes otherwise (403, nothing sent). The demo site shows and plays them for everyone and sends nothing. The public visit shows no sign.
- Every write is prepared, shown, confirmed, rebuilt from a fresh read, sent, and logged (`deps.log.record`). The browser never holds a token. Writes go only to `config.owner/config.repo`.
- No count, no points. Stamps `talk-answer` and `talk-welcome`, first applied write only, proof the comment's URL.
- No new sound and nothing downloaded: the moment reuses `cheer` and the worker's `Interact` clip.
- Real run: none in this slice (spec section 7); the issue lists it as still open.

## Review Focus

1. The team answers (or the player answers on GitHub) between prepare and apply: nothing is sent, the message says why, the bubble goes on refresh (Task 2 test `an answer is refused when the team spoke meanwhile`).
2. A bot or a deleted account wrote last (`author` null, or a login ending in `[bot]`): nobody waits on that issue (Task 1 test `bots and deleted accounts never wait`).
3. A waiting comment of many lines, markdown, or 5 000 characters: the draft quotes at most 200 characters cut on a word, every quoted line starting with `> ` (Task 3 test `the answer draft quotes every line, 200 characters at most`).
4. A volunteer, or any page, calling `/api/talk/answer/apply` directly: refused with 403 and nothing sent (Task 2 test `a volunteer cannot answer or welcome, even through the API`).
5. A double click on Send: one comment, never two (Task 3 e2e `Send twice sends one comment`, the button disabled while sending as in `ConfirmWarm`).

---

### Task 1: Who waits, who is new, and the reads

**Files:** Create `src/shared/people.ts`:
- `TEAM = ["OWNER", "MEMBER", "COLLABORATOR"] as const`; `WAIT_MS = 86_400_000`; `NEWCOMER = ["FIRST_TIMER", "FIRST_TIME_CONTRIBUTOR"] as const`;
- `interface LastComment { author: string | null; association: string; createdAt: string; excerpt: string }` (excerpt: the first 200 characters of `bodyText`, cut on a word);
- `interface Waiting { pallet: number; login: string; since: string; excerpt: string }`; `interface Newcomer { login: string; avatarUrl: string; pr: { id: string; number: number; title: string; url: string }; pallet: number | null; contributingUrl: string | null }`;
- `waitingOn(issue: BoardItem, viewer: string, now: number): Waiting | null` (open issues only; null when no last comment, author null or ending in `[bot]`, author is the viewer, association in `TEAM`, or younger than `WAIT_MS`);
- `peopleOf(board: BoardSnapshot, newcomers: Newcomer[], viewer: string, now: number): { waiting: Waiting[]; newcomers: Newcomer[] }` (a newcomer's `pallet` is the first of their PR's closing issues that is a pallet of the board, else null).
Modify `src/shared/site.ts` (`BoardItem.lastComment?: LastComment | null`; `Site.people?: { waiting: Waiting[]; newcomers: Newcomer[] }`, absent when the player may not see them), `src/server/github/read-board.ts` (each issue reads `comments(last: 1) { nodes { author { login } authorAssociation createdAt bodyText } }`), create `src/server/github/read-newcomers.ts` (`readNewcomers(gql: Gql, config: QuestConfig): Promise<Newcomer[]>`: `repository.pullRequests(states: OPEN, first: 50, orderBy: {field: UPDATED_AT, direction: DESC})` with `authorAssociation`, `author { login avatarUrl }`, `closingIssuesReferences(first: 5) { nodes { number } }`, `comments(last: 100) { nodes { viewerDidAuthor } }`, and `object(expression: "HEAD:CONTRIBUTING.md") { id }` on the repository; keeps first-time authors not yet commented by the viewer), `src/server/deps.ts` (`readNewcomers(): Promise<Newcomer[]>`; the demo returns one FICTIF newcomer whose PR closes an open demo pallet, and one with no pallet), `src/shared/demo/demo-board.json` (one open pallet whose `lastComment` is a FICTIF question from `fictif-maria`, association `NONE`, two days old), `src/server/app.ts` (`/api/site` on the main board and the demo adds `site.people = peopleOf(...)` only when the player may see them, see Global Constraints; never on a practice, team or visit site).
**Tests:** `src/shared/people.test.ts`: `the team's last word means nobody waits`, `the player's own last word means nobody waits`, `a word younger than a day does not wait yet`, `no question mark is needed`, `bots and deleted accounts never wait`, `a closed issue never waits`, `a newcomer's pallet is the first closing issue on the board, else none`. `read-newcomers.test.ts` (fixture): `only first-time authors the viewer has not commented on`, `the contributing guide is linked when it exists`. `app.test.ts`: `a lead sees the people of the site, a volunteer does not`, `the demo shows its FICTIF people to everyone`.
- [ ] Steps: failing tests; run `npx vitest run src/shared/people.test.ts src/server` (FAIL); implement; `npm run check` (PASS); commit `feat: who waits for an answer, who makes a first pull request (#18)`.

### Task 2: The two gestures, server side

**Interfaces:** Consumes `Waiting`, `Newcomer`, `waitingOn`, `peopleOf` (Task 1). Produces for Task 3: `type TalkKind = "answer" | "welcome"`; `interface PreparedTalk { kind: TalkKind; repo: string; to: string; target: { kind: "issue" | "pull"; number: number; title: string; url: string }; words: string; mentions: string[]; mutations: PracticeMutation[] }`; routes `POST /api/talk/:kind{answer|welcome}/prepare` with `{ number: number; words: string }` and `POST /api/talk/:kind/apply` with the `PreparedTalk`, answering `{ ok: true; site: Site; levels: LevelsView | null; url: string }` or the warm gestures' refusals.

**Files:** Create `src/shared/gestures/talk.ts`: `prepareAnswer(board: BoardSnapshot, repo: string, issueNumber: number, words: string, viewer: string, now: number): PreparedTalk` (refused unless `waitingOn` holds: "Nobody waits for an answer on #N any more"; words trimmed, refused when empty; `mentions` through `mentionsIn` from `warm.ts`); `prepareWelcome(newcomers: Newcomer[], repo: string, prNumber: number, words: string): PreparedTalk` (refused unless the PR is in `newcomers`: "This newcomer was already welcomed"). Modify `src/server/deps.ts` (`applyTalk(p: PreparedTalk): Promise<PracticeResult>`: live through `applyPractice`; the demo clears the pallet's `lastComment` or drops the newcomer in memory, and answers a fake URL marked FICTIF), `src/server/app.ts` (the two routes: lead guard (403), home-origin guard as every write, rebuild from a fresh `readBoard` / `readNewcomers`, deep-equal check against the claim, apply, log, stamp `talk-answer` / `talk-welcome` the first time with the comment's URL as proof), `src/github/api-coverage.ts` (the wording of `addComment`: thank, answer and welcome).
**Tests:** `src/shared/gestures/talk.test.ts`: `an answer sends one comment on the waiting issue, nothing else`, `a welcome sends one comment on the pull request`, `empty words are refused`, `words with an @mention carry the warning`. `app.test.ts`: `an answer is refused when the team spoke meanwhile`, `a welcome is refused once the newcomer was welcomed`, `a volunteer cannot answer or welcome, even through the API`, `a tampered claim is refused and nothing is sent`, `the first answer stamps talk-answer, the second does not`, `the demo answers and sends nothing`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: answer and welcome, prepared and confirmed like a move (#18)`.

### Task 3: On the site: the bubbles, the visitor, the dialog

**Interfaces:** Consumes `Site.people`, the Task 2 routes and `PreparedTalk`.

**Files:** Modify `src/client/scene/Pallet.tsx` (an `Html` bubble above the pallet: "?" with "maria · 2 d" when it is in `site.people.waiting`, "👋" with the login when a newcomer's `pallet` is it; class `talk-bubble`, so the photo draws it: add it to `LABELS` in `src/client/ui/photo-draw.ts`), `src/client/scene/Site.tsx` (a visitor per newcomer with no pallet, standing in a row beside the site office at `[-width / 2 + 3 + 1.2 * i, 0, YARD_Z - 2.5]`, drawn with `Worker` and its badge, with the 👋 bubble), `src/client/scene/Player.tsx` (the visitor within reach counts as near, as a worker does), `src/client/store.ts` (`talk: { kind: TalkKind; number: number } | null`, `openTalk`; `talkPrepared: PreparedTalk | null`; both hold the keys like the other dialogs, and `TouchControls` hides for them), `src/client/ui/Hud.tsx` (the prompt "E: answer maria" / "E: welcome lucas", touch wording "Tap to answer maria"), `src/client/ui/Overlays.tsx` (the card's "Answer" / "Welcome" button; `TalkDialog`: what the person wrote or the PR's title and link, then a textarea holding the draft; `ConfirmTalk`: the target, the exact words, the mention warning, Send / Cancel, one send at a time), create `src/client/talk.ts` (`say` is `(key: string, o?: Record<string, unknown>) => string`, as `radioDraft` in `levels.ts`; `answerDraft(excerpt: string, say): string`: every line of the excerpt prefixed `> `, then two line breaks; `welcomeDraft(login: string, contributingUrl: string | null, say): string`); a refusal from GitHub plays the `refused` moment and shows its message, as `ConfirmWarm` does, `src/client/api.ts` (`prepareTalk(kind, number, words)`, `applyTalk(p)`), the locales (both languages, the drafts' wording from the spec section 3).
**Tests:** `src/client/talk.test.ts`: `the answer draft quotes every line, 200 characters at most`, `the welcome draft links the contributing guide only when there is one`. e2e `e2e/talk.spec.ts` (demo site): `E near a waiting pallet opens the draft, the confirmation shows the words, nothing leaves, the bubble goes`, `a newcomer with no pallet waits at the office and can be welcomed`, `Send twice sends one comment`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: the people who wait show on the site, and the lead answers or welcomes them (#18)`.

### Task 4: The moment and the stamp

**Files:** Modify `src/client/store.ts` (after an applied talk, `greetWith({ login: p.to, pallet, kind: "talked" })`, only once GitHub accepted), `src/client/moments/list.ts` (`talked`: sound `cheer`, react `cheer`, reduced text null), `src/client/scene/Worker.tsx` (on `talked` for them: `Interact`, no rising emoji; the visitor too), `src/client/ui/SkillBook.tsx` (the warm gestures page gains "Answer" and "Welcome", stamped from `talk-answer` and `talk-welcome`, both languages).
**Tests:** `list.test.ts` `talked has its sound and no reduced text`; client helper test `a refusal never greets`; e2e `reduced motion: the bubble goes, no wave` (the worker keeps its idle clip; the sound call is made).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: the person waves when answered or welcomed, the skill book stamps it (#18)`.

### Task 5: The measures, the review, the evidence

- [ ] Measures before (`1a07faa`) and after on the demo site: frames per second and draw calls (the bubbles are HTML: they should not move the draw calls).
- [ ] A short video of the demo site: the "?" bubble, E, the draft, the confirmation, the wave; the visitor at the office welcomed.
- [ ] Independent review against this Review Focus; Critical and Important fixed with a failing test first; minors listed on the issue.
- [ ] The issue closed with its evidence once the owner has seen the video; the real run listed in the Vault project note as still open (needs real people outside the team: the second test stage).
