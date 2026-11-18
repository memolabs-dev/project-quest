# The people of the site, slice 7c: the site radio. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coming back to a site, a radio in front of the site office crackles and tells, in at most five lines, what moved since the player's last visit (or presents the site on a first visit), from a picture of the site kept in the browser; E replays it; a setting mutes it.

**Architecture:** All of it is client-side and pure where it can be. `src/client/radio.ts` takes a compact picture of a site (`snapshotOf`), compares two pictures into lines (`radioLines`), and keeps the picture per site in `localStorage`. The store plays the lines once the arrival camera is done and no card or dialog is open. The scene draws a radio from simple boxes with a bubble; the settings gain a "Radio" switch. No server change, no GitHub read or write.

**Tech Stack:** as the repo (React 19, R3F 9.8, drei 10.7, zustand, Howler, i18next, Vitest, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-18-site-radio-design.md` (slice 7c), with the principles of `2026-11-17-people-of-the-site-design.md` section 3.

## Global Constraints

- No GitHub read or write and no server change: the radio works on the site already loaded.
- Never a count per person: no line holds both a login and a number. A new worker is named ("A new helmet: lucas!"), never counted.
- Facts in this order, five lines at most; with more facts, the fifth line is "and more besides": floors laid per building; pallets laid; pallets newly at "In review" or "In progress"; new issues (parcels); bugs new or driven out; new workers.
- First visit (no picture, an unreadable one, or one of another version): the welcome line ("Welcome to the site of {{site}}: …"). Nothing moved: one kind "dead calm" line, never a reproach.
- Two or three variants per kind of line, in both languages, chosen by the date (`YYYY-MM-DD`, the day's number modulo the count), never by chance. The locale namespace is `onAir` (the existing `radio` keys belong to the lead's evening bulletin).
- Storage: `localStorage` key `project-quest.radio.<site>`, `<site>` one of `main`, `demo`, `practice`, `team`, `visit:<owner/repo lowercased>`; the stored object carries `v: 1`. The picture is written as soon as the lines are chosen, muted or not. A throwing or missing `localStorage` means a first visit every time; nothing breaks.
- Lines last about 3 seconds each (`RADIO_LINE_MS = 3000`); the radio starts about one second after the arrival fly-over ends (`RADIO_DELAY_MS = 1000`); it never starts while a card or a dialog is open, and waits; the mentor's panel does not hold it back.
- The crackle: `public/audio/radio.ogg`, copied from the Interface Sounds pack already downloaded (Kenney, CC0, `glitch_002.ogg`, found at `/private/tmp/claude-501/-Users-memo-memolabs-products-project-quest/de507fb5-417a-416c-98ab-d82c31d6b8af/scratchpad/kenney/interface-sounds/Audio/glitch_002.ogg`), recorded in `public/audio/LICENSES.md`. If that file is gone, stop and report: nothing is downloaded without the owner.
- No em or en dashes in any string.

## Review Focus

1. The page is reloaded right after the radio spoke: the same news is not told again (Task 1 test `the picture is saved as soon as the lines are chosen`, Task 2 e2e `a reload does not repeat the news`).
2. `localStorage` throws on read or write (private window): the radio presents the site as a first visit and the game plays on (Task 1 test `blocked storage means a first visit, never a crash`).
3. A repository with hundreds of changes since the last visit: still five lines, the fifth "and more besides" (Task 1 test `more facts than lines end with and more besides`).
4. The radio's turn comes while a card or a dialog is open: it waits and starts after it closes, never under it (Task 2 e2e `the radio waits for an open card`).
5. Two public repositories, or the same one typed with other capitals: each keeps its own picture, and `Vitejs/Vite` and `vitejs/vite` share one (Task 1 test `the site key lowercases a visited repository`).

---

### Task 1: The picture, the comparison, the lines

**Interfaces:** Produces for Task 2: `RADIO_VERSION = 1`, `MAX_LINES = 5`, `interface SiteSnapshot { v: 1; at: string; pallets: Record<number, { zone: string; closed: boolean; discarded: boolean; bug: boolean }>; floors: Record<string, number>; workers: string[] }` (floors keyed like the layout's building keys: `epic-<n>` or `unassigned`), `interface RadioLine { key: string; values: Record<string, string | number>; pallet?: number }`, `snapshotOf(site: Site, at: string): SiteSnapshot`, `radioLines(before: SiteSnapshot | null, now: Site, date: string, site: string): RadioLine[]` (`site` is the name the welcome line says), `radioSiteKey(kind: SiteKind, visitRepo: string | null): string`, `loadSnapshot(key: string, storage?: Storage | null): SiteSnapshot | null`, `saveSnapshot(key: string, s: SiteSnapshot, storage?: Storage | null): void`.

**Files:** Create `src/client/radio.ts` (the above; `variantOf(date: string, count: number): number` picks the variant from the day of the month; lines carry keys like `onAir.floors`, `onAir.laid`, `onAir.review`, `onAir.progress`, `onAir.parcels`, `onAir.termitesIn`, `onAir.termitesOut`, `onAir.helmet`, `onAir.more`, `onAir.welcome`, `onAir.calm`, each with a `variant` value; a floors line per building names the building's title, a pallet line points at the pallet when it is a single one), the locales (`onAir.*`, two or three variants each as arrays or `_0`/`_1`/`_2` keys, both languages, the counts through i18next plurals).
**Tests:** `src/client/radio.test.ts`: `the first visit presents the site`, `nothing moved says the calm line`, `floors laid come first, building by building`, `laid, review, progress, parcels, termites and helmets, in that order`, `more facts than lines end with and more besides`, `no line holds a login and a number`, `the variant follows the date`, `a reopened or deleted pallet never breaks the comparison`, `a picture of another version is ignored`, `the picture is saved as soon as the lines are chosen` (the store helper used by Task 2: `chooseLines(key, site, date, name, storage)` returns the lines and has already written the new picture), `blocked storage means a first visit, never a crash`, `the site key lowercases a visited repository`. `src/locales/parity.test.ts` keeps both languages in step (existing).
- [ ] Steps: failing tests; run `npx vitest run src/client/radio.test.ts` (FAIL); implement; `npm run check` (PASS); commit `feat: the radio compares two pictures of the site and chooses its lines (#20)`.

### Task 2: The radio on the site

**Interfaces:** Consumes Task 1 (`chooseLines`, `radioSiteKey`, `RadioLine`, `RADIO_LINE_MS`, `RADIO_DELAY_MS`).

**Files:** Create `public/audio/radio.ogg` (see Global Constraints) and its line in `public/audio/LICENSES.md`; `src/client/sound.ts` (`FILES` gains `radio: ["radio"]`); create `src/client/scene/RadioSet.tsx` (a box, a grille and an antenna from the `Box` helper of `Rewards.tsx`, standing in front of the site office at the office's x plus 2, `YARD_Z - 2`; the antenna sways and a light blinks while it speaks, only the light with reduced motion; an `Html` bubble with class `radio-bubble` showing the current line, in a polite `aria-live` region; a click on a pallet line opens that pallet's card; a click elsewhere on the bubble or Escape skips to silence), `src/client/scene/Site.tsx` (places it), `src/client/store.ts` (`radio: { lines: RadioLine[]; at: number } | null` with `at` the index shown, `playRadio(lines)`, `skipRadio()`, `nearRadio: boolean`), `src/client/scene/Player.tsx` (the radio within 2.5 m sets `nearRadio`; the nearest of pallet, worker, visitor and radio wins), `src/App.tsx` (E near the radio replays the last chosen lines; on arrival, once the fly-over is done plus `RADIO_DELAY_MS` and no card or dialog is open, `chooseLines` then play unless muted), `src/client/ui/Hud.tsx` (prompt "E: listen to the radio again", touch "Tap the radio"), `src/client/settings.ts` and `src/client/ui/Settings.tsx` (`radio: boolean`, default true; muted, the radio does not start by itself and E still replays), `src/client/ui/photo-draw.ts` (`.radio-bubble` joins `LABELS`), the locales.
**Tests:** `settings.test.ts` `the radio setting defaults to on and survives a reload`; `store.test.ts` `the radio waits for an open card`, `skip silences the radio`; e2e `e2e/radio.spec.ts` (demo site): `the first visit's welcome plays after the arrival`, `a reload does not repeat the news`, `after a pallet is moved and the page reloaded, the radio tells it`, `E near the radio replays`, `muted, the radio does not speak by itself`, `the radio waits for an open card`, `reduced motion: the antenna stays still, the light blinks`, `the radio makes no request to the server` (the page's requests during the radio are the same as without it).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e -- --workers=1` (PASS); commit `feat: a radio in front of the office tells what moved since the last visit (#20)`.

### Task 3: The measures, the review, the evidence

- [ ] Draw calls per frame on the demo before (`4b05aaf`) and after, the scene settled, as in slice 7b.
- [ ] A short video of the demo: the arrival, the radio's welcome, a move, a reload, the news, E to replay.
- [ ] Independent review against this Review Focus; Critical and Important fixed with a failing test first; minors listed on the issue.
- [ ] After deployment, two visits of one public repository on https://project-quest.memolabs.dev: the welcome, then the calm or the news.
- [ ] The issue closed with its evidence once the owner has seen the video.
