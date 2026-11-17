# Levels, slice 4d: the real project. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Team leader plays level 16: on the real project the game is configured on, they find an issue labelled "good first issue" and ask for it in a comment, through a confirmed gesture; the level is stamped when GitHub shows their comment. Nobody is ever assigned by the game.

**Architecture:** Same engine as 4a to 4c. "The real project" is the board in `quest.config.json` (today the fictitious sandbox `memolabs-dev/project-quest-sandbox`; a project picker comes later, spec 15b). New: a read of the real project's open good-first issues with their comments (only once level 15 is stamped), one gesture "ask for it" (`addComment` only), behind a guard that accepts only an open, unassigned good-first issue of the configured repository.

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-levels-design.md` (section 3 level 16, section 4 "Real project", principle 3 "no pressure on contributors").

## Global Constraints

- Every 4a to 4c constraint holds; the practice guard is untouched.
- The game only comments on the real project. It never assigns anyone, never labels, never closes: "On the real project, nobody is ever assigned without asking: the volunteer asks, a maintainer assigns." (spec section 3).
- The ask is shown in full (the issue, the exact comment text, editable) and sent only on the player's click; it is logged.
- Test stages (owner's rule): the real project is the sandbox while `quest.config.json` points there; never SOS MEDITERRANEE, Data for Good or the Rescue Atlas lab.
- The good-first label names come from `quest.config.json` (`labels.goodFirst`, default `["good first issue"]`), never from the code.

## Rulings in this plan

- **The reward "your badge among the real site's workers, only if you agree"** needs no new code: the game draws workers from GitHub's assignees, so the badge appears when a maintainer assigns the player, which is the player's agreement. The rank's visible reward is the skill book page and Mémé's last line.
- **The real project's read happens only after level 15**, so earlier levels cost no extra query.

## Review Focus

1. An issue already assigned to someone: the ask is refused (nobody is taken from) (Task 2 test `never asks for an issue someone has`).
2. An issue without the good-first label, closed, or from another repository: refused by the server, nothing sent (Task 2 tests).
3. A comment the player left on a good-first issue before reaching level 16 (or on any other issue): only a comment on an open good-first issue counts (Task 1 test `counts only a comment on an open good-first issue`).
4. The configured board has no good-first issue at all: the mentor says so plainly instead of offering a dead button (Task 3 test `says when the real project has no good first issue`).
5. The demo site: the ask is shown, never sent (Task 3 e2e).

---

### Task 1: The real project's good first issues, and level 16

**Files:** Modify `src/shared/config.ts` (`labels.goodFirst?: string[]`), `src/shared/levels/types.ts` (`Observed.real: RealSnapshot | null`; `interface RealSnapshot { repo: string; issues: { id: string; number: number; title: string; url: string; assignees: string[]; comments: { author: string; url: string }[] }[] }`), `src/server/github/read-real.ts` (`readGoodFirst(gql, config): Promise<RealSnapshot>`: `repository(owner, name) { issues(states: OPEN, labels: $labels, first: 30, orderBy: { field: CREATED_AT, direction: DESC }) { … comments(last: 50) … } }`), `src/server/levels.ts` (read only when `a15-clean-up` is stamped); Create `src/shared/levels/real-project.ts` (`REAL_PROJECT: Level[]` with `a16-ask-good-first`, rank `"real-project"`); `src/shared/levels/index.ts`, `progress.ts` (`unlocks` unchanged).
**Tests:** `read-real.test.ts` (FICTIF fixture; label names passed from the config), `real-project.test.ts`: done on a viewer's comment on an open good-first issue (proof: the comment URL); `counts only a comment on an open good-first issue`; not done with no `real` read.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS; parity test extended by the new rank in Task 3 may be added here too); commit `feat: the real project's good first issues, and level 16 (#7)`.

### Task 2: The ask, behind its own guard

**Files:** `src/shared/gestures/real.ts` (`interface PreparedAsk { kind: "ask"; repo: string; issueNumber: number; title: string; comment: string; mutations: [{ name: "addComment"; input: { subjectId; body } }] }`, `prepareAsk(real: RealSnapshot, viewer: string, issueNumber: number, comment: string): PreparedAsk`), `src/server/app.ts` (`/api/real/ask/prepare` and `/api/real/ask/apply`: rebuild from a fresh `readGoodFirst`, `isDeepStrictEqual`, the target must be `config.owner/config.repo`, `?demo=1` never sends, log), `src/server/deps.ts` (`readGoodFirst`, `applyAsk` reusing `applyPractice`'s mutation runner).
**Tests:** `real.test.ts`: `asks for a good first issue in the player's words`; `never asks for an issue someone has`; refuses an empty comment, a closed or unknown issue, a closing keyword aimed at any repository; `levels.test.ts`: `refuses an ask outside the configured project` (409, nothing sent), `sends an ask the server rebuilt and logs it`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: ask for a good first issue, behind its own guard (#7)`.

### Task 3: On screen, and in both languages

**Files:** `src/shared/site.ts` (`Pallet.goodFirst: boolean` from `config.labels.goodFirst`), `src/client/levels.ts` (`mentorAction` at a16: `"to-main"` off the main site, `"ask"` on it; `LevelsView.real: { issues: number }`), `src/client/ui/Overlays.tsx` (the card of a good-first pallet shows "Ask for it" at a16), `src/client/ui/PracticeDialogs.tsx` (the Ask dialog: the issue, the comment prefilled with the locale's line, the summary, the exact request, Send only when `canWrite`), `src/client/ui/Mentor.tsx`, locales (`levels.a16-ask-good-first.*`, `skills.rank.real-project`, `mentor.rankDone.real-project`, `mentor.toMain`, `mentor.noGoodFirst`, `practice.ask.*`, `practice.summary.ask`).
**Tests:** `levels.test.ts` (client): `sends the player to the real site, then asks them to pick a good first issue`; `says when the real project has no good first issue`; `show.test` or `site.test`: a pallet carries `goodFirst` from the configured labels; e2e on the demo: the card of a good-first pallet shows "Ask for it", the dialog shows `addComment` and the comment, no Send.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npx playwright test` (PASS); commit `feat: ask for a good first issue on the real site, in English and French (#7)`.

### Task 4: The real run, the review, the close

- [ ] **After the owner says go:** on the sandbox (FICTIF), put the "good first issue" label on one open, unassigned issue; in the game on the main site (the sandbox), open its pallet, ask for it; check the comment on GitHub and the stamp in the game. The game assigns nobody.
- [ ] Independent review against this Review Focus; fix Critical and Important with a failing test first; minors to #2.
- [ ] Show the owner the screenshots; close #7 with the evidence once seen.
