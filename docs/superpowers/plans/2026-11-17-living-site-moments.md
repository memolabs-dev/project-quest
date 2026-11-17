# The living site, slice 6a: gestures that answer. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every gesture that matters answers with a moment (motion, sound, dust, a camera kick, a reaction), played only after the fact, with a reduced version; sound on from the first gesture with a mute button; a settings panel.

**Architecture:** Moments are data (`src/client/moments/list.ts`) announced by the store when a site refresh shows what changed (`momentsBetween(prev, next)`, pure), when GitHub refuses a write, when a level is stamped, or when the player acts in the game. A `Director` inside the canvas plays sound, particles and the camera kick; objects animate their own motion when their position or state changes (the pallet's arc, the floor's overshoot), reading one motion setting. Settings live in the store and in `localStorage`.

**Tech Stack:** as the repo, plus `howler` 2.2.4 (MIT, about 7 kB) and its types.

**Spec:** `docs/superpowers/specs/2026-11-17-living-site-design.md` (sections 2, 3, 6, 7, 8; slice 6a).

## Global Constraints

- A moment follows a fact: only what GitHub accepted (seen in a refreshed site or an accepted answer) or what the player did in the game. A refused write never announces a celebration.
- Everyday gestures 100 to 300 ms; the floor laid about 600 to 800 ms; one big moment per refresh however many floors were laid.
- Reduced motion (forced in settings, or the system's when set to follow): no bounce, camera kick or particles; colour, words and sound stay.
- Sound on by default, starting at the first gesture (browsers allow sound only after one); a mute button; mute and volume remembered. Settings read and written in a `try`: the game works when `localStorage` is blocked.
- Sounds: Kenney CC0 packs only; **each download approved by the owner first** (file names, source, size); `public/audio/LICENSES.md` names each file's pack and licence. Ruling against the spec's "one sprite file": about twelve small files loaded by one Howler map; a sprite needs a build step and saves nothing at this size.
- Both locales for every new string; no em or en dash in French.

## Review Focus

1. A write GitHub refused: the crate shakes and a soft bonk sounds, never the celebration of the gesture (Task 2 test `a refused write never celebrates`).
2. Several floors laid in one refresh: one big moment, not one per floor (Task 2 test `one big moment for several floors`).
3. The first load of a site, or a switch between sites (demo, practice, team): no flood of moments for everything already there (Task 2 test `nothing announced on a first view or a new site`).
4. Sound before any gesture, sound with `localStorage` blocked, mute remembered across a reload (Task 1 test `settings survive a blocked storage`, Task 3 test `nothing plays before the first gesture`, e2e `mute is remembered`).
5. Reduced motion forced on: no particle, no camera kick, no arc; the sound and the words still come (Task 4 test `reduced moments keep sound and words`, e2e `reduced motion shows no particle`).

---

### Task 1: Settings, and one motion setting for the whole game

**Files:** Create `src/client/settings.ts` (`Settings { sound: boolean; volume: number; miniature: boolean; motion: "system" | "reduce" | "full" }`, `DEFAULT_SETTINGS = { sound: true, volume: 0.7, miniature: true, motion: "system" }`, `loadSettings(storage?: Storage): Settings`, `saveSettings(s: Settings, storage?: Storage): void`, `reduced(s: Settings, systemReduce: boolean): boolean`); Modify `src/client/store.ts` (`settings`, `setSettings(patch)`), `src/client/scene/Site.tsx` (`useReducedMotion` reads `reduced(settings, system)`); Create `src/client/ui/Settings.tsx` (a button beside the language choice opening a small panel: sound on/off, volume, miniature effect, motion: follow the system, reduce, full); both locales (`settings.*`).
**Tests:** `settings.test.ts`: `defaults when nothing is stored`, `settings survive a blocked storage` (a storage whose `getItem` and `setItem` throw), `a stored value out of range falls back`, `reduced follows the system unless forced`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: a settings panel, and one motion setting for the whole game (#11)`.

### Task 2: The moments and where they come from

**Files:** Create `src/client/moments/list.ts` (`MomentKind = "pallet-moved" | "floor-laid" | "parcel" | "cleared" | "stamp" | "refused" | "card-open" | "card-close" | "loaded" | "overloaded"`; `MOMENTS: Record<MomentKind, { sound: SoundName | null; dust: "puff" | "ring" | null; kick: number; react: "cheer" | "lean" | null; reduced: { sound: SoundName | null; text: string | null } }>`), `src/client/moments/diff.ts` (`Moment { kind: MomentKind; pallet?: number; building?: number | "unassigned" }`; `momentsBetween(prev: Site | null, next: Site): Moment[]`); Modify `src/client/store.ts` (`moments: Moment[]`, `announce(...m: Moment[])`, `takeMoments(): Moment[]`; `setSite` and `refresh` announce `momentsBetween`; the previous site is forgotten when the site kind changes), `src/client/ui/Overlays.tsx` (a refused move announces `refused` for its pallet; opening and closing a card announce `card-open` and `card-close`), `src/client/ui/Mentor.tsx` (a new stamp announces `stamp`), `src/client/ui/PracticeDialogs.tsx` (an accepted `load` announces `loaded`, or `overloaded` when the sprint goes over capacity; a refused gesture announces `refused`).
- `momentsBetween`: a pallet whose zone changed → `pallet-moved`; a pallet that is new → `parcel`; a pallet gone, or now discarded → `cleared`; buildings whose `floorsDone` grew → one `floor-laid` for the first of them only (the big moment), however many grew; `prev === null` → nothing.
**Tests:** `diff.test.ts`: `a moved pallet`, `a new parcel`, `a cleared duplicate`, `one big moment for several floors`, `nothing announced on a first view or a new site`; `list.test.ts`: `every moment has its reduced version`, `a refused write never celebrates` (the `refused` entry has no `react`, no `ring`, no chime); `store` test (or `levels.test.ts` style): `a refused move announces refused, never pallet-moved`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the moments, announced from facts only (#11)`.

### Task 3: The sounds

- [ ] **Owner approval first**: list the Kenney CC0 packs (Impact Sounds, Interface Sounds, RPG Audio), their page, the zip sizes and the files kept; download only after the owner says yes, into the scratchpad, never the repository's root.
**Files:** `public/audio/*.ogg` (about twelve: `thud`, `land`, `chime`, `stamp`, `rustle`, `bonk`, `poof`, `step1` to `step4`, `creak`; converted with ffmpeg when needed), `public/audio/LICENSES.md`; Create `src/client/sound.ts` (`SoundName`; `createSound(make: (src: string) => HowlLike): { play(name: SoundName, opts?: { rate?: number }): void; setVolume(v: number): void; setMuted(m: boolean): void; unlock(): void }`; nothing plays before `unlock()`, which the first key or pointer down calls; each name throttled to one play per 60 ms); `package.json` (`howler`, `@types/howler`).
**Tests:** `sound.test.ts` with a fake `HowlLike`: `nothing plays before the first gesture`, `muted plays nothing and stays muted after unlock`, `the volume reaches every sound`, `a sound asked twice within 60 ms plays once`.
- [ ] Steps: owner approval; download; failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the site's sounds, CC0, on from the first gesture (#11)`.

### Task 4: The director in the scene

**Files:** Create `src/client/scene/Director.tsx` (inside the canvas: each frame it takes the store's moments, plays the moment's sound, spawns `puff` or `ring` dust at the pallet's or building's place from one instanced pool of 64 particles, and adds the `kick` to a shared camera offset that decays in 300 ms; with reduced motion only the sound, and the moment's `text` goes to the notice); Modify `src/client/scene/Player.tsx` (adds the shared camera kick to its offset; footsteps every 0.45 m walked, one of four step sounds, rate from the speed), `src/client/scene/Foreman.tsx` (plays Cheer on `react: "cheer"`, Interact on `"lean"`, then back to idle), `src/client/scene/Site.tsx` (mounts the director).
- Pure helpers in `src/client/moments/play.ts`: `planMoment(m: Moment, reduced: boolean): { sound: SoundName | null; dust: "puff" | "ring" | null; kick: number; react: "cheer" | "lean" | null; text: string | null }`; `kickAt(t: number, strength: number): number` (decays to 0 at 300 ms).
**Tests:** `play.test.ts`: `reduced moments keep sound and words`, `a full moment carries its dust and kick`, `the kick fades to nothing in 300 ms`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the director plays each moment: sound, dust, camera, the foreman's reaction (#11)`.

### Task 5: The objects' own motion

**Files:** Modify `src/client/scene/Pallet.tsx` (the visual group inside the fixed body: when the pallet's place changes, it starts at the old place and travels on an arc to the new one in 420 ms, squats 80 ms before and squashes on landing; a new parcel falls from 6 m and bounces; a cleared pallet folds to nothing in 250 ms; a refused one shakes sideways 3 times in 300 ms; with reduced motion it is placed at once), `src/client/scene/Building.tsx` (the new floor overshoots to 1.12 and settles in 700 ms instead of the cubic growth).
- Pure curves in `src/client/moments/curves.ts`: `arc(t: number, height: number): { along: number; up: number }`, `squash(t: number): number`, `overshoot(t: number): number` (0 to 1.12 then 1, settled at t = 1), `shake(t: number): number`.
**Tests:** `curves.test.ts`: `the arc starts and ends on the ground, highest midway`, `the overshoot passes 1.1 and settles on 1`, `the shake ends at rest`.
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: pallets travel, land, fall, fold and shake; floors overshoot and settle (#11)`.

### Task 6: The interface's moments, the measures, the browser checks

**Files:** `src/client/ui/ui.css` and `SkillBook.tsx`, `Overlays.tsx` (the stamp comes down on the skill book's level, 200 ms; the card slides in, 180 ms; both none with reduced motion, through a `data-motion` attribute on the root); `e2e/moments.spec.ts`.
**Tests (Playwright, demo site):** `a moved pallet raises dust that fades`, `mute is remembered across a reload`, `reduced motion shows no particle and still the notice`.
- [ ] Measures before (at the base commit) and after on the demo site: `gl.info.render.calls` and frames per second over 5 s of walking; both written in the issue.
- [ ] Steps: failing e2e; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: the stamp and the card move too; measures (#11)`.

### Task 7: The real run, the review, the close

- [ ] **After the owner says go**, on `guillaume-flambard/my-first-site` (FICTIF): move a pallet, close an issue as done, see the moments fire on GitHub's real answers; a short video or screenshots for the owner.
- [ ] Independent review against this Review Focus; fix Critical and Important with a failing test first; minors in a new issue.
- [ ] Show the owner; close #11 with the evidence once seen.
