# The people of the site, slice 7a: cheer and thank. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The player cheers a worker with a positive reaction on their pallet, and thanks them when a pallet is laid (a reaction, and their own words if they wish); every write is shown and confirmed; the worker answers with a warm moment; the skill book stamps each gesture the first time.

**Architecture:** The gestures are pure (`src/shared/gestures/warm.ts`: which emojis, what is sent, what is refused), prepared and applied by the server on the configured board exactly like a move (prepare, confirm, rebuild from a fresh read, send, log). The board read gains the player's own reactions per issue. The client adds a "near a worker" hint (key R), an emoji picker above the worker and on the card, one confirmation dialog for the warm gestures, the thank offer after a pallet is laid, and the moment (`cheered`, `thanked`) played by the existing director.

**Tech Stack:** as the repo (Hono server, `@octokit/graphql`, React 19, R3F 9.8, drei 10.7, zustand, Howler, Vitest, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-17-people-of-the-site-design.md` (sections 3 to 8; slice 7a).

## Global Constraints

- Four emojis only: `HOORAY` 🎉, `HEART` ❤️, `ROCKET` 🚀, `THUMBS_UP` 👍. The server refuses any other content.
- The game never adds an @mention or an assignment. Words are the player's own; when they hold `@login`, the confirmation says "These words will notify @login." (both languages).
- Every write is prepared, shown, confirmed, rebuilt from a fresh read, sent, and logged (`deps.log.record`). The browser never holds a token. The demo site plays everything and sends nothing (its board keeps the reactions in memory).
- No count per person, no points per gesture. Stamps `warm-cheer` and `warm-thank`, first time only, proof the issue's address.
- A refusal from GitHub never celebrates: the `refused` moment (bonk) and the message.
- Open to every player from the start (no level gate).
- Writes only to the configured board's repository (`config.owner/config.repo`), as the ask does. Real runs on the sandbox only, the owner approving each write.
- New sound: `public/audio/cheer.ogg`, copied from the Interface Sounds pack already downloaded (Kenney, CC0, `confirmation_001.ogg`), recorded in `public/audio/LICENSES.md`. Nothing new is downloaded.

## Review Focus

1. A double click or a second R while the confirmation is open: one reaction is sent, never two, and the emoji ends ticked (Task 2 test `a second cheer of the same emoji is refused while it is given`).
2. A pallet the player already reacted to with 🎉, cheered again with 🎉 from the picker: the game offers to take it back, never to add it again (Task 1 test `an emoji already given can only be taken back`).
3. Words with an @mention, or only spaces: the warning shows for the first, the second is refused as empty (Task 1 tests `words with an @mention carry the warning`, `empty words are refused`).
4. A pallet laid while the player is away (seen on the next refresh), then the page reloaded: the thank offer appears once, not at every reload (Task 3 test `the thank offer shows once per laid pallet`).
5. Reduced motion: no rising emoji, no gesture; the emoji beside the badge and the sound stay (Task 4 test `reduced motion keeps the emoji and the sound only`).

---

### Task 1: The gestures and their reads, server side

**Files:** Create `src/shared/gestures/warm.ts`:
- `WARM_EMOJIS = ["HOORAY", "HEART", "ROCKET", "THUMBS_UP"] as const`; `type WarmEmoji`;
- `interface PreparedWarm { kind: "cheer" | "uncheer" | "thank"; repo: string; issueNumber: number; title: string; content: WarmEmoji; words: string | null; mentions: string[]; mutations: PracticeMutation[] }`;
- `prepareCheer(board: BoardSnapshot, repo: string, issueNumber: number, content: string): PreparedWarm` (open or closed issue on the board; content one of the four; refused when `myReactions` already holds it: "You already gave this one: take it back instead"; one `addReaction { subjectId, content }`);
- `prepareUncheer(...)` same arguments (refused when not given; one `removeReaction`);
- `prepareThank(board: BoardSnapshot, repo: string, issueNumber: number, content: string, words: string | null, thanked: boolean): PreparedWarm` (only a pallet closed as completed; content `HOORAY` or `HEART`; the reaction unless already given; words trimmed, refused when empty after trim if given, refused when `thanked` is true: "You already thanked with words on this pallet"; `mentions` = the `@login` found in the words; `addComment` after the reaction).
Modify `src/server/github/read-board.ts` (each issue reads `reactionGroups { content viewerHasReacted }`; `BoardItem.myReactions: string[]` keeps the contents the viewer gave), `src/shared/site.ts` (`Pallet.myReactions: WarmEmoji[]`, filtered to the four), `src/server/github/read-real.ts` or a new `src/server/github/read-thanked.ts` (`readThanked(gql, owner, name, number, login): Promise<boolean>`: true when a comment by the viewer exists after the issue's `closedAt`; this read is what "once per pallet" means: GitHub is the memory, not the action log), `src/server/deps.ts` (`applyWarm(p: PreparedWarm): Promise<PracticeResult>`; live through `applyPractice`, demo toggles `myReactions` in its in-memory board and remembers thanked words), `src/server/github/practice-apply.ts` (`MUTATIONS` gains `addReaction`, `removeReaction`), `src/server/app.ts` (`/api/warm/:kind{cheer|uncheer|thank}/prepare` and `/apply`: home guard, deep-equal rebuild, log, stamp `warm-cheer` / `warm-thank` on the first applied write, answers `{ ok, site, levels }`), `src/github/api-coverage.ts` (wording of `addReaction`, `removeReaction`, `addComment`), `src/shared/demo/demo-board.json` (no change needed: `myReactions` defaults to `[]`).
**Tests:** `src/shared/gestures/warm.test.ts`: `only the four positive emojis`, `a cheer sends one reaction on the issue`, `an emoji already given can only be taken back`, `thank needs a pallet laid as completed`, `words with an @mention carry the warning`, `empty words are refused`, `a second thank with words is refused`. `src/server/app.test.ts`: `a warm gesture goes only to the configured project`, `a stale claim is refused and nothing is sent`, `the first cheer stamps warm-cheer, the second does not`, `the demo site keeps the reaction and sends nothing`. `read-board.test.ts`: `the viewer's own reactions are read, nobody else's`.
- [ ] Steps: failing tests; run `npx vitest run src/shared/gestures/warm.test.ts src/server/app.test.ts src/server/github/read-board.test.ts` (FAIL); implement; `npm run check` (PASS); commit `feat: cheer and thank, prepared and confirmed like a move (#15)`.

### Task 2: Cheer in the scene and on the card

**Files:** Modify `src/client/keys.ts` (`CHEER_CODE = "KeyR"`, its letter in the hint), `src/client/store.ts` (`nearWorker: string | null`, `setNearWorker`; `warm: PreparedWarm | null`, `setWarm`; `picker: { login: string | null; pallet: number } | null`), `src/client/scene/Player.tsx` (the nearest worker within 4 m, from the worker spots passed in), `src/client/scene/Site.tsx` (passes the spots), `src/client/scene/Worker.tsx` (the four emojis in the badge's `Html` when the picker is on them; the given ones ticked), `src/client/ui/Overlays.tsx` (the hint "R: cheer maria"; the card's "Cheer" row; `ConfirmWarm` showing the issue, the emoji, the words and the mention warning, Send / Cancel, focus on Send, one send at a time), `src/client/api.ts` (`prepareWarm(kind, args)`, `applyWarm(p)`), the locales (both languages).
**Tests:** e2e `e2e/people.spec.ts` (demo site): `R near a worker opens the emojis and the confirmation shows the reaction` (nothing reaches GitHub; after Send the emoji is ticked), `a second cheer of the same emoji is refused while it is given` (the picker offers "take back"), `the card cheers a pallet with no worker`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: cheer a worker near them or from the card (#15)`.

### Task 3: Thank when a pallet is laid

**Files:** Modify `src/client/moments/diff.ts` (`momentsBetween` adds `{ kind: "laid", pallet }` for a pallet newly closed as completed; it plays no sound of its own: the floor's moment stays the one celebration), `src/client/store.ts` (`toThank: number[]`, filled by `laid` moments, emptied as the player thanks or dismisses; the pallets already offered are remembered in `localStorage` under `project-quest.thank-offered`, read in a `try`), `src/client/ui/Overlays.tsx` (the offer "Thank maria?" / several logins / "Thank the team?" with Thank and Not now; the thank dialog: 🎉 or ❤️, an optional words field, then `ConfirmWarm`), the card of a laid pallet (the same Thank button).
**Tests:** `diff.test.ts` `a pallet closed as completed is laid, a duplicate is not`; `store.test.ts` `the thank offer shows once per laid pallet` (offered, dismissed, a reload of the same site offers nothing); e2e `after a pallet is laid, Thank is offered and sends a reaction with words` (demo site, the site set through the store as the moments specs do).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: thank the people when their pallet is laid (#15)`.

### Task 4: The moment and the stamp

**Files:** Create `public/audio/cheer.ogg` (from the downloaded Interface Sounds pack, `confirmation_001.ogg`) and its line in `public/audio/LICENSES.md`. Modify `src/client/moments/list.ts` (`cheered`: sound `cheer`, react `lean`, reduced text null; `thanked`: sound `cheer`, react `cheer`), `src/client/scene/useGameSound.ts` (the new file), `src/client/store.ts` (`greet: { login: string | null; pallet: number; emoji: WarmEmoji; kind: "cheered" | "thanked"; at: number } | null`, set only after GitHub accepted), `src/client/scene/Worker.tsx` (on `greet` for them: `Interact` for a cheer, `Cheer` for a thanks, the emoji rising about 1.2 m over 1 s and fading; with reduced motion, no gesture and the emoji shown beside the badge for 2 s), `src/client/ui/SkillBook.tsx` (a "Warm gestures" page with "Cheer" and "Thank", stamped from `warm-cheer` and `warm-thank`, both languages).
**Tests:** `list.test.ts` `cheered and thanked have their sound and their reduced version`; `warm.test.ts` (client helper `greetFor(result, prepared)`) `a refusal never greets`; e2e `reduced motion keeps the emoji and the sound only` (no rising: the emoji element has no animation class; the sound call is made).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: the worker answers a cheer, the skill book stamps it (#15)`.

### Task 5: The sandbox, the measures, the review, the real run

- [ ] `scripts/seed-sandbox.ts` assigns the viewer (the owner's own account, `viewer { id }`) to two open FICTIF issues of the sandbox, only when they have no assignee; shown to the owner and run only with his go-ahead (a real write).
- [ ] Measures before (`a4f09b2`) and after on the demo site: frames per second and draw calls.
- [ ] A short video of the demo site: R near a worker, the confirmation, the moment; a laid pallet, the thank with words.
- [ ] Independent review against this Review Focus; Critical and Important fixed with a failing test first; minors to #12.
- [ ] Real run on the sandbox, the owner approving each write: a cheer, taking it back, a thanks with words on a laid pallet; checked on GitHub.
- [ ] Show the owner; close the issue with its evidence once seen.
