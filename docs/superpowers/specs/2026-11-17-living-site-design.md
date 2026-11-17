# project-quest: the living site

Status: written for the owner's review, 2026-11-17. Decisions taken with the owner (Guillaume) in the brainstorm of 17 November 2026, after the research in `docs/research/2026-11-17-what-makes-a-good-game.md`. First of three projects to make the game more alive: **the living site** (look, feel, sound, characters), then **the people of the site** (warm interaction with the project's real people), then **a day on the site** (the story and the day loop of the main spec, section 5).

## 1. Purpose

Every gesture answers, the site looks drawn and feels alive, the characters move like people at work. Success means a first-time player feels each action land (sound, motion, a trace), wants to come back, and the game stays as fast and as calm as today.

## 2. Principles

1. **A moment follows a fact.** A moment plays only for what GitHub accepted, or for what the player did in the game (open a card, walk, pass by a worker). Nothing is celebrated before GitHub's answer; a refusal is never celebrated.
2. **Medium juice that never hides what matters** (research, section 1): short for everyday gestures (100 to 300 ms), one expressive moment (the floor laid, about 600 to 800 ms). One celebration at a time: several floors laid together make one big moment, then the counter climbs.
3. **Reduced motion reduces, it does not remove** (main spec, section 9): no bounce, camera kick or particles, but colour, words and sound stay.
4. **No pressure on contributors** (main spec, principle 3): a real person's character never shows a gesture that judges their pace. The hammock of the main spec (a worker asleep when their task has no news for 7 days) is dropped: it would show a real person asleep, in public, for a delay.
5. **The game stays fast.** Measured before and after (draw calls, frames per second); quality lowers itself on a weak machine.
6. **Assets stay free and traceable.** Sounds come from CC0 packs (Kenney), each file's source and licence recorded in the repository. Every download is approved by the owner first, with each file's name and size.

## 3. The moments

### 3.1 How they flow

- **One list of moments** (`src/client/moments/`): for each moment its sound, its animation, the characters' reaction, an optional camera kick, and its reduced-motion version. Adding a gesture to the game is adding one line.
- **Sources**: the store announces a moment when a GitHub write it sent comes back accepted, when a refresh of the site shows what changed (a new floor, a new parcel, a pallet gone), or when the player acts in the game.
- **One director** reads the list and plays the moment through three parts:
  - **sound**: Howler (about 7 kB), one sprite file, unlocked by the first gesture (browsers allow sound only after one); on by default, a button mutes it; the volume and the mute are remembered;
  - **effects**: dust, sparks and marks on the ground, drawn from one pool of particles created once;
  - **camera**: a short kick that fades by itself, added to the follow camera's offset.
- **Settings** honoured in one place: mute, volume, reduced motion.

### 3.2 The list (slice 6a)

| What happens | What the player sees and hears | With reduced motion |
|---|---|---|
| Pallet moved (status changed) | The crate squats, travels on an arc, lands with a squash, a puff of dust, a dull thud; the zone sign's count changes | It slides to its place; the thud and the count stay |
| Floor laid (issue closed as completed), the big moment | The floor squashes, overshoots a little and settles, the existing sparks, a ring of dust, a small camera kick, a chime; the foreman cheers | The floor appears, the board shows "New floor laid", the chime plays |
| The mayor's parcel (new issue) | The crate falls from the sky, bounces, thud, a little dust | It appears in place, thud |
| Duplicate cleared | The crate folds and vanishes in a "poof" | It fades, "poof" |
| Stamp earned (level passed) | The stamp comes down on the skill book with a sharp sound; Mémé raises a thumb | The stamp appears, sharp sound |
| Refused by GitHub | The crate shakes sideways, a soft "bonk", no celebration | A soft "bonk" and the message, no shake |
| Card opened or closed | It slides, with a paper rustle | It appears, rustle |
| Walking | Footsteps following the speed; the dust under the feet already there | Footsteps only |
| Sprint truck loaded | The crate hops onto the truck; the truck creaks when over capacity | It is placed; the creak when over capacity |

## 4. Characters that live (slice 6b)

The foreman model already holds clips the game never plays: Cheer, Interact, PickUp, Use_Item, Idle, Sit_Floor_Idle, Hit_A. They are used; nothing is bought or downloaded.

- **Workers** (the project's real people, with their GitHub avatar):
  - a worker whose task is in progress works on their crate (Use_Item);
  - the others change gesture every 4 to 9 seconds (Idle, PickUp, Interact), each at their own rhythm (seeded by their login), with short cross-fades;
  - within 4 metres, a worker turns their head toward the foreman, damped and clamped to a natural angle;
  - the first time in a visit, they wave (Interact) and their name shows; nothing is sent to GitHub.
- **The foreman (the player)**:
  - after 12 seconds without input, he sets his crate down and sits (Sit_Floor_Idle), and stands up at the first input;
  - he cheers when a floor is laid, and leans in (Interact) when the player opens a pallet's card near him.
- **Never used**: Hit_A. A refusal hurts nobody.
- **Performance**: beyond about twelve workers on screen, the farthest keep a plain idle, without looking at the player.

## 5. The setting, the look, the speed (slice 6c)

- **Look** (the owner's choice among four real renders, 2026-11-17): flat comic-style shading, `MeshToonMaterial` with a three-tone ramp (light, shadow, deep shadow), on the kit, the foreman and the workers. Shadows slightly softer than today (`shadow.radius` about 2 to 3 with the r187 PCF shadow), the shadow camera following the player. A light miniature effect (`TiltShift2`), which the settings can switch off.
- **Life**: the yard tapes and flags sway in the wind (a vertex shader through `onBeforeCompile`, no new dependency); a small flock of birds crosses the sky now and then (instanced); the light drifts from morning to evening over 10 to 15 minutes, never down to night, so everything stays readable.
- **Textures**: the kit has none, flat colours; with flat shading this keeps the style clean. No painted textures for now.
- **Speed**: the fence and the road dashes (about 130 draw calls, estimated) are drawn as instances; the count is measured before and after with `gl.info.render.calls`. When the frame rate drops (`PerformanceMonitor`), the game lowers, in order: the pixel ratio, then ambient occlusion to half resolution, then the miniature effect.

## 6. Settings

A small settings panel beside the language choice, remembered in the browser (`localStorage`, read in a `try`, the game works without it): sound on or off and its volume, the miniature effect, reduced motion (follows the system by default, can be forced on or off). In both languages.

## 7. Sounds

- About twelve short sounds from Kenney's CC0 packs (impacts, interface, footsteps): thud, chime, stamp, rustle, soft bonk, poof, footsteps, the truck's creak. One sprite file in `public/audio/`, with `public/audio/LICENSES.md` naming each source pack and its licence.
- Each download is approved by the owner first (file names, source, size).
- Voices and the site's background ambience wait for "a day on the site".

## 8. Testing

- **Unit**: every moment in the list has its normal and its reduced version; an accepted GitHub answer announces its moment, a refused one never a celebration; one big moment for several floors laid together; the settings read and write safely.
- **Browser (Playwright)**: effects appear and fade; mute and reduced motion are remembered across a reload; no animation shown with reduced motion.
- **Measures before and after each slice**: draw calls and frames per second on the demo site, written into the slice's issue.
- **Real run** on the owner's `my-first-site` (FICTIF): moments fire on real GitHub answers.
- **For the owner**: a short video or screenshots of each slice; an independent review; the issue closed with its evidence.

## 9. Slices

- **6a**: the moments, the nine gestures, sound with its button, the settings panel.
- **6b**: characters that live.
- **6c**: the look, the life of the setting, the speed.

Each slice is an issue on board 9, with its plan, built test-first, reviewed independently, closed with its evidence once the owner has seen it.

## 10. Out of scope for now

- Voices, the site radio's speech and background ambience (a day on the site).
- Interaction with the project's people: cheering, welcoming, thanking (the people of the site).
- Painted textures, new 3D models, Mémé as a 3D character.
