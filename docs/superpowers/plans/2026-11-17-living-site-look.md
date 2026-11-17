# The living site, slice 6c: the look, the setting's life, the speed. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The site looks drawn (flat comic shading, softer shadows, a light miniature effect the player can switch off), the setting lives (tapes in the wind, birds now and then, the light drifting from morning to evening), and the game draws fewer things and lowers its own quality on a weak machine.

**Architecture:** Every decision is a small pure module, tested: `toon.ts` (standard material to toon material), `daylight.ts` (sun and light over time, the shadow box following the player), `wind.ts` (the vertex sway injected through `onBeforeCompile`), `birds.ts` (when a flock crosses, and where each bird is), `rows.ts` (where the fence pieces and road dashes stand), `quality.ts` (what a lower quality level turns down). The components apply them: `kit.tsx`, `Worker.tsx`, `Foreman.tsx`, `Site.tsx`, `Life.tsx`, `Effects.tsx`, `Settings.tsx`. Nothing is downloaded: three r187, drei and `@react-three/postprocessing` already hold `MeshToonMaterial`, `PerformanceMonitor` and `TiltShift2`.

**Tech Stack:** as the repo (three 0.187, R3F 9.8, drei 10.7, @react-three/postprocessing 3.2.2 with postprocessing 6.39 and n8ao 2.1).

**Spec:** `docs/superpowers/specs/2026-11-17-living-site-design.md` (section 5, and sections 2, 6 and 8; slice 6c).

## Global Constraints

- Flat comic shading: `MeshToonMaterial` with a three-tone ramp (light, shadow, deep shadow), on the kit, the foreman and the workers. The comic outlines stay. No painted textures.
- Shadows: `shadow.radius` about 2 to 3 with the r187 PCF shadow (`PCFSoftShadowMap` is removed in r187 and falls back to PCF; PCF reads `radius`), the shadow camera following the player.
- Miniature effect: `TiltShift2`, light, on by default (`DEFAULT_SETTINGS.miniature` is already `true`), switched off in the settings panel; remembered in the browser.
- Wind on the yard tapes through a vertex shader in `onBeforeCompile`; no new dependency.
- Birds: a small flock, instanced, crossing the sky now and then.
- Light: from morning to evening over 10 to 15 minutes, never down to night: everything stays readable.
- Speed: the fence and the road dashes drawn as instances; draw calls measured before and after with `gl.info.render.calls`. On a dropping frame rate (`PerformanceMonitor`) the game lowers, in order: the pixel ratio, then ambient occlusion to half resolution, then the miniature effect.
- Reduced motion (spec, principle 3): no sway and no birds; the light still drifts (a slow change of light is not motion); the miniature effect is a look, not motion, and follows its own setting.
- Both languages for every new word.

## Review Focus

1. A long session (20 minutes and more): the light keeps drifting back and forth, never reaches night, never jumps (Task 2 test `the light goes from morning to evening and back, never night`).
2. Walking across a wide board: the player's shadow and the shadows near them never disappear or shimmer as the shadow box follows (Task 2 test `the shadow box follows the player in whole texels`).
3. A weak machine whose frame rate keeps dropping: quality steps down once per drop in the spec's order and never past the last step; recovering steps back up (Task 5 test `quality steps down in order and back up`).
4. The miniature switch turned off, then the page reloaded: the effect stays off (Task 5 e2e `the miniature effect is remembered across a reload`).
5. A recoloured piece (a crate in its zone colour, a jacket in its trade colour): the toon material keeps that colour, and two pieces of the same colour share one material (Task 1 test `a toon material keeps the colour and is shared`).

---

### Task 1: The drawn look

**Files:** Create `src/client/scene/toon.ts`:
- `toonRamp(): THREE.DataTexture` (one shared 3×1 texture, the three tones about 0.45, 0.75 and 1.0, `NearestFilter` for min and mag, `generateMipmaps = false`);
- `toonOf(base: THREE.Material): THREE.Material` (a `MeshStandardMaterial` becomes a `MeshToonMaterial`, cached by the base's `uuid`, copying `name`, `color`, `map`, `transparent`, `opacity`, `side`, with `gradientMap = toonRamp()`; any other material comes back unchanged).
Modify `src/client/scene/kit.tsx` (each piece's material goes through `toonOf`, after `tinted`), `src/client/scene/Worker.tsx` (the cloned body's meshes, the jacket after its recolour), `src/client/scene/Foreman.tsx` (the foreman's meshes).
**Tests:** `toon.test.ts`: `the ramp has three tones and no smoothing` (width 3, `NearestFilter`), `a toon material keeps the colour and is shared` (a tinted standard material: same colour hex, `toonOf(a) === toonOf(a)`, two calls on two different bases give two materials), `a material that is not standard is left alone` (a `MeshBasicMaterial` comes back as itself).
- [ ] Steps: failing tests; run `npx vitest run src/client/scene/toon.test.ts` (FAIL: no module); implement; `npm run check` (PASS); look at the demo site (screenshot at 1280 px, the outlines still drawn); commit `feat: the site drawn in flat comic shading (#14)`.

### Task 2: The light of the day, the softer shadows

**Files:** Create `src/client/scene/daylight.ts`:
- `DAY_SECONDS = 12 * 60` (morning to evening; then evening back to morning, so a long session never jumps);
- `daylight(seconds: number): { sun: [number, number, number]; color: string; intensity: number; sky: number }` where `sky` in [0, 1] is the time of day (0 morning, 0.5 noon, 1 evening, ping-pong over `2 * DAY_SECONDS`); the sun turns from east to west, its height `y` never below 6 (low evening light, never night); warm colours at both ends (`#FFC98F` about), white-gold at noon (`#FFE9C7` about); intensity between 2.0 and 2.8;
- `shadowBox(player: { x: number; z: number }, half: number, mapSize: number): { x: number; z: number }` (the box centre snapped to whole shadow texels, texel = `2 * half / mapSize`).
Modify `src/client/scene/Site.tsx`: the directional light and the `Sky` read `daylight(clock.elapsedTime)` each frame (through refs, no re-render: the `Sky` mesh's `material.uniforms.sunPosition.value`, the light's `position`, `color`, `intensity`, the hemisphere's colour); the light's `target` and position follow `shadowBox(playerPosition, 30, 2048)`; the shadow camera box shrinks from ±45 to ±30 (sharper for the same map); `shadow-radius={2.5}`.
**Tests:** `daylight.test.ts`: `the light goes from morning to evening and back, never night` (sample every 10 s over 3 days: `sun[1] >= 6`, intensity in [2.0, 2.8]; `sky` is 0 at 0 s, 1 at `DAY_SECONDS`, 0 again at `2 * DAY_SECONDS`; two samples 1 s apart differ by less than 0.01 in `sky`), `the sun rises east and sets west` (sun x at morning < 0 < sun x at evening), `the shadow box follows the player in whole texels` (for player x = 10.37, the box x is a whole multiple of `60 / 2048` and within one texel of 10.37).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: the light drifts from morning to evening, softer shadows follow the player (#14)`.

### Task 3: Wind and birds

**Files:** Create `src/client/scene/wind.ts`:
- `windUniforms = { uWindTime: { value: 0 }, uWindStrength: { value: 1 } }` (one shared set, ticked once per frame by the site);
- `withWind(material: THREE.Material): THREE.Material` (sets `onBeforeCompile`: adds the two uniforms and replaces `#include <begin_vertex>` with it plus a sway of `transformed.z` by `sin(uWindTime * 2.0 + position.x * 1.7) * 0.02 * uWindStrength`; sets `customProgramCacheKey` to `"wind"`; returns the same material).
Create `src/client/scene/birds.ts`:
- `FLOCK = 7`; `flockAt(seconds: number, seed: number): { x: number; y: number; z: number; flap: number }[] | null` (a crossing every 45 to 75 s, seeded, lasting 14 s, from one side of the site to the other along x, at a height of 14 to 18 m, in a loose V; `null` between crossings).
Modify `src/client/scene/Site.tsx` (the yard tapes' material goes through `withWind`; the site's frame sets `uWindTime` and `uWindStrength = reduceMotion ? 0 : 1`), `src/client/scene/Life.tsx` (`Birds({ reduceMotion })`: one `instancedMesh` of `FLOCK` small dark wings, matrices from `flockAt`, count 0 when `null` or with reduced motion).
**Tests:** `wind.test.ts`: `the wind is added to the vertex shader` (calling `onBeforeCompile` on a fake `{ vertexShader: "a\n#include <begin_vertex>\nb", uniforms: {} }` keeps `#include <begin_vertex>`, adds `uWindTime` to the uniforms and to the shader source); the reduced-motion wiring is checked by the e2e of Task 5. `birds.test.ts`: `a flock crosses now and then` (over 10 minutes, `flockAt` is not `null` between 15 % and 35 % of the samples; each crossing returns 7 birds), `birds stay high and cross the site` (y in [14, 18]; x goes from below -20 to above 20 within one crossing).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check` (PASS); commit `feat: tapes sway in the wind, birds cross the sky now and then (#14)`.

### Task 4: Fewer draws: the fence and the road dashes as instances

**Files:** Create `src/client/scene/rows.ts`:
- `fenceAt(width: number): number[]` (the x of each fence piece: `Math.ceil((width + 8) / 2)` pieces from `-(width + 8) / 2 + 1`, step 2, as today);
- `dashesAt(width: number): number[]` (the x of each road dash: `Math.ceil((width + 40) / 3)` dashes from `-(width + 40) / 2 + 1.5`, step 3, as today).
Modify `src/client/scene/kit.tsx`: `PieceRow({ name, xs, z, outline })` draws each mesh of a kit piece as one `instancedMesh` of `xs.length` instances (matrix = translation × the mesh's own world matrix), toon material, cast and receive shadows, the drei `Outlines` inside (it supports instanced meshes). Modify `src/client/scene/Site.tsx`: the fence row through `PieceRow`, the road dashes as one `instancedMesh`.
**Tests:** `rows.test.ts`: `the fence and the dashes stand where they stood` (for width 60: same count and same first and last x as the old formulas, step 2 and 3).
- [ ] Steps: measure draw calls on the demo site before (5 s walk, `gl.info.autoReset = false`, as in 6a); failing test; run (FAIL); implement; `npm run check` (PASS); measure after (expected: about 130 fewer, the real number written in the issue); commit `perf: the fence and the road dashes drawn as instances (#14)`.

### Task 5: The miniature effect and the quality that lowers itself

**Files:** Create `src/client/scene/quality.ts`:
- `QUALITY_LEVELS = 4`; `quality(level: number, miniature: boolean): { dpr: [number, number]; aoHalf: boolean; tiltShift: boolean }` (level 0: `[1, 2]`, full AO, tilt-shift if `miniature`; 1: dpr `[1, 1]`; 2: plus AO at half resolution; 3: plus no tilt-shift);
- `stepQuality(level: number, change: "decline" | "incline"): number` (one step, clamped to 0..3).
Modify `src/client/scene/Effects.tsx` (`Effects({ aoHalf, tiltShift })`: `N8AO halfRes={aoHalf}`; `TiltShift2` with a light blur (about 0.15) and a band around the middle of the screen when `tiltShift`), `src/client/scene/Site.tsx` (`SiteCanvas` holds the level; drei `PerformanceMonitor` `onDecline`/`onIncline` call `stepQuality`; the canvas `dpr` from `quality`), `src/client/ui/Settings.tsx` (the miniature checkbox shown again, in both languages: "Miniature effect" / "Effet maquette"), the i18n files.
**Tests:** `quality.test.ts`: `quality steps down in order and back up` (from 0, three declines give dpr `[1, 1]`, then `aoHalf`, then no tilt-shift; a fourth decline stays at 3; one incline goes back to 2), `the miniature setting turns the effect off at every level`. E2e `e2e/look.spec.ts`: `the miniature effect is remembered across a reload` (uncheck in the settings, reload, still unchecked; `html` or the composer reports no tilt-shift), `reduced motion: no birds and no sway` (with motion forced to "Reduced", the birds' instanced mesh has count 0 and `uWindStrength` is 0).
- [ ] Steps: failing tests; run (FAIL); implement; `npm run check && npm run test:e2e` (PASS); commit `feat: the miniature effect, switchable, and a quality that lowers itself on a weak machine (#14)`.

### Task 6: Measures, the real look, the review, the close

- [ ] Measures before (`32fb948`) and after on the demo site, one server at a time: frames per second and draw calls, written in the issue.
- [ ] A short video for the owner (the drone arrival, a walk, the tapes, a flock, the miniature switch); screenshots at 1280 px and at phone width.
- [ ] Independent review against this Review Focus; Critical and Important fixed with a failing test first; minors to #12.
- [ ] Show the owner; close the issue with its evidence once seen.
