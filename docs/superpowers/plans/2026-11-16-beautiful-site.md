# A Beautiful, Lively Site (#3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the site beautiful and alive without hiding the project's state (issue #3).

**Architecture:** Pure functions in `src/client/scene/` decide what to show (floors, scaffolds, worker spots, crate sizes, newly laid floors) and are unit-tested; the R3F components only draw them. New geometry comes from `scripts/blender/site_kit.py`; painted numbers and ground textures are canvas textures drawn in code (no font or texture download). Avatars load from `avatars.githubusercontent.com`, which allows cross-origin use (`access-control-allow-origin: *`, checked 2026-11-16).

**Spec:** `docs/superpowers/specs/2026-11-16-project-quest-design.md` (principles 7 and 9, sections 3, 8, 9).

## Global Constraints

- Lively, and always clear: no effect may hide a pallet's zone, a building's progress or who carries what.
- One expressive moment: the floor growing when a pallet reaches the last zone (about 560 ms). Other motion 100 to 300 ms or ambient and slow.
- Reduced motion: no fly-over, no particles, no floor growth animation; colours and labels unchanged.
- Assets: CC0 or our own Blender scripts; no new downloads.
- Performance: site visible in under 10 s in Chrome on the owner's Mac (Playwright measure), no frame drops on walking (visual check).
- Tests and screenshots on the demo board; live checks only on the fictitious sandbox.

## Review Focus

1. A building with many floors (20+): scaffolding and labels stay readable, nothing collides with the next building.
2. A worker carrying several pallets: stands once, by the first one; no duplicated worker.
3. An avatar that fails to load: the badge falls back to the worker's initial, the scene keeps rendering.
4. Several pallets moved to the last zone at once (refresh after an outside change): each building grows once, no stacked effects.
5. A board with no sizes set: every crate has the default size.

## Tasks

### Task 1: Before screenshots
- [ ] `e2e/look.spec.ts`: three fixed views (overview from the road, a building close-up, a yard close-up), saved to `e2e/screenshots/look-<view>-<tag>.png`, the tag read from `LOOK_TAG` (default `after`). Run once with `LOOK_TAG=before`.

### Task 2: What to show (pure, tested): `src/client/scene/show.ts`
- [ ] `buildingPlan(b: Building): { built: number; scaffold: number; roof: boolean }` (roof when `floorsTotal > 0 && floorsDone === floorsTotal`).
- [ ] `crateScale(size: string | null): number` (XS 0.7, S 0.85, M 1, L 1.15, XL 1.3, default 1).
- [ ] `workerSpots(site: Site, pallets: {number, x, z}[]): { login, avatarUrl, trade, x, z }[]`: one per worker, beside their lowest-numbered pallet (Review Focus 2).
- [ ] `newlyLaid(prev: Site | null, next: Site): number[]`: epic numbers whose `floorsDone` grew, once each (Review Focus 4).
- [ ] `facade(epicNumber: number | null): { wall: string; trim: string }` deterministic per epic from a small palette.
- Tests first in `show.test.ts`, covering Review Focus 1, 2, 4, 5.

### Task 3: Ground, light, yards
- [ ] Canvas textures in `src/client/scene/textures.ts` (ground noise with gravel and tyre tracks; painted zone number), cached.
- [ ] Yards bordered with tape posts and painted numbers; warm directional light, hemisphere fill, fog.

### Task 4: Buildings
- [ ] `site_kit.py` gains `scaffold_module` and `roof`; `npm run assets`; asset test lists them.
- [ ] `Building.tsx` draws `buildingPlan`, facade colours, and the magic growth (sparkles via drei `Sparkles`, scale-in of the new floor) when `newlyLaid` names it.

### Task 5: Pallets
- [ ] Number painted on two faces of the crate; crate scaled by `crateScale`.

### Task 6: Workers
- [ ] `Worker.tsx`: foreman model cloned with `SkeletonUtils.clone`, jacket recoloured by trade, avatar on a badge (texture, fallback to the initial: Review Focus 3), idle clip with a random offset.

### Task 7: Life and arrival
- [ ] Crane turning slowly; dust puffs when the foreman moves; termites on bug pallets (instanced, small).
- [ ] Drone fly-over at load (3 s, any key or click skips), skipped with reduced motion; e2e waits for the end of the fly-over or presses a key.

### Task 8: Measures and review
- [ ] Load time e2e test < 10 s; ui-check sweep 0; `LOOK_TAG=after` screenshots; independent review; fix pass; close #3 with evidence after the owner sees the screenshots.
