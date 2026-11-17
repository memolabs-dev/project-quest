# The living site, slice 6b: characters that live. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The workers (the project's real people) work on their crate or change gesture at their own rhythm, turn their head toward the foreman and wave once per visit with their name; the foreman sits down when the player does nothing and stands up at the first input.

**Architecture:** The behaviour is pure (`src/client/scene/people.ts`: which gesture, when, how far the head turns, who greets, who stays plain) and tested; `Worker.tsx` and `Foreman.tsx` apply it each frame. The foreman's position is shared through one module-level vector the `Player` writes each frame, as the camera kick does. The clips are the ones already in `foreman.glb`: nothing is downloaded.

**Tech Stack:** as the repo.

**Spec:** `docs/superpowers/specs/2026-11-17-living-site-design.md` (sections 2 and 4; slice 6b).

## Global Constraints

- No gesture judges a real person's pace: workers only work, wait, pick up, check, look, wave. Never Hit_A, never sleep or lie down (Lie_Idle) for a worker. The hammock is dropped (spec, principle 4).
- Nothing is sent to GitHub in this slice: greeting and looking are the game's own.
- Reduced motion: no head turn and no wave; the name still shows when the foreman comes near; gestures keep their loops (a character standing frozen reads as broken, and a loop is not a moment).
- Performance: beyond the 12 workers nearest the foreman, workers keep a plain idle, without looking or waving.
- Numbers from the spec: gesture change every 4 to 9 s, seeded by the login; head turn within 4 m, damped, clamped to 60°; one wave per visit; the foreman sits after 12 s without input.

## Review Focus

1. A worker whose crate moves to another yard: the worker walks over with it, not left in the old yard as an invisible wall (Task 2 e2e `a worker follows their pallet to its new yard`; a fixed body does not follow a new position, as found in 6a).
2. The foreman standing still beside a worker for a long time: the worker keeps looking without jitter, waves only once (Task 1 tests `one wave per visit`, `the head turn is clamped and damped`).
3. Twenty or more workers on the board: only the 12 nearest look and wave; the frame rate holds (Task 1 test `only the twelve nearest live fully`, Task 4 measure).
4. Any key, click or touch while the foreman sits: he stands up at once and the input is not lost (Task 3 test `the first input ends the rest`).
5. Reduced motion: no head turn, no wave, the name still shows (Task 1 test `reduced motion keeps the name only`).

---

### Task 1: The people's behaviour, pure

**Files:** Create `src/client/scene/people.ts`:
- `GESTURES = ["Idle", "PickUp", "Interact"] as const`; `gestureAt(login: string, n: number): { clip: (typeof GESTURES)[number] | "Use_Item"; seconds: number }` (seeded by `idleOffset(login)` and `n`; seconds in [4, 9]; never the same clip twice in a row);
- `workerBusy(site: Site, carrying: number[]): boolean` (an open pallet they carry stands in a middle zone: not the first, not the last);
- `headYaw(worker: { x: number; z: number; facing: number }, player: { x: number; z: number }, reduced: boolean): number` (0 beyond 4 m or with reduced motion; else the angle toward the player relative to the facing, clamped to ±60°);
- `greeting(state: { greeted: Set<string> }, login: string, distance: number, reduced: boolean): "wave" | "name" | null` (within 4 m: the first time in the visit `"wave"` (`"name"` with reduced motion) and records the login; later `"name"`; beyond: `null`);
- `livelyWorkers(spots: { login: string; x: number; z: number }[], player: { x: number; z: number }, max = 12): Set<string>`;
- `restAfter(idleSeconds: number): boolean` (true from 12 s).
**Tests:** `people.test.ts`: `a gesture lasts 4 to 9 seconds and changes`, `busy workers use their tool`, `the head turn is clamped and damped` (yaw clamp; the damping itself is applied in Task 2 with maath `damp`), `one wave per visit`, `reduced motion keeps the name only`, `only the twelve nearest live fully`, `the foreman rests after 12 seconds`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: how the site's people behave, pure and tested (#13)`.

### Task 2: Workers that live

**Files:** Modify `src/client/scene/show.ts` (`WorkerSpot` gains `busy: boolean` from `workerBusy`), `src/client/scene/Worker.tsx` (the body keyed by its place, so it follows its crate; the gesture plan with 0.35 s cross-fades, `Use_Item` while busy; the `head` bone turned by `headYaw`, damped with maath `easing.damp`, applied after the mixer; a wave plays `Interact` once and the badge shows the login for 3 s; plain idle when not in `livelyWorkers`), Create `src/client/moments/player.ts` (`playerPosition = { x, z }`, written by `Player.tsx` each frame).
**Tests:** `show.test.ts` `a worker is busy while their pallet is in a middle zone`; e2e `e2e/people.spec.ts` `a worker follows their pallet to its new yard` (demo site: move a carried pallet, the worker's body is near the new place), `a worker shows their name when the foreman comes near`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: workers work, look at the foreman and wave once (#13)`.

### Task 3: The foreman rests

**Files:** Modify `src/client/scene/Foreman.tsx` (after 12 s without input, he plays `Sit_Floor_Idle`; any key, pointer or touch makes him stand; a moment's reaction still wins), `src/client/scene/Player.tsx` (records the last input time).
**Tests:** `people.test.ts` `the first input ends the rest` (a pure `restState(lastInput: number, now: number): "rest" | "awake"`); e2e `the foreman sits after a while and stands at a key` (reads the foreman's playing clip through the scene).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: the foreman sits when nothing happens, stands at the first input (#13)`.

### Task 4: Measures, the real look, the review, the close

- [ ] Measures before and after on the demo site (frames per second, draw calls), as in 6a, written in the issue.
- [ ] A short video of the demo site (walk past the workers, stand still, move a pallet) for the owner; a look at the sandbox board (`memolabs-dev/project-quest-sandbox`, project 10) on the live server, read only: nothing is written to GitHub in this slice.
- [ ] Independent review against this Review Focus; fix Critical and Important with a failing test first; minors to #12.
- [ ] Show the owner; close the issue with its evidence once seen.
