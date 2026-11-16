# project-quest: design

Status: draft for the owner's review, 2026-11-16. Decisions below were taken one by one with the owner (Guillaume) during the brainstorm of 16 November 2026.

## 1. Purpose

project-quest turns a GitHub project into a 3D video game. The lead of the project manages the real repository and its Projects (v2) board by playing: every gesture in the game is a real, confirmed GitHub change.

It is for:

- **leads and project managers**, who manage their project while having fun;
- **people learning project management**, who learn good practice by playing;
- **non-technical people (PO, PM, partners)**, who see at a glance where the project stands;
- later, **every contributor**, who plays their own character.

Success means: a lead prefers the game to the GitHub board for their daily round; a newcomer understands a project's state in under a minute; nobody gets bored, and the repository is good enough to be adopted widely as open source ("turn your project into a video game").

## 2. Principles

1. **GitHub is the truth.** The game never invents project facts. Gags that do not come from data are decoration only (a chicken crossing, a song on the radio). Anything about the project (a hammock, termites, a queue) matches a real fact.
2. **Every write is shown, then confirmed.** Before a GitHub mutation, the game shows exactly what will be sent: the issue, the change, the full text. Nothing leaves without the player's click. Every write is logged.
3. **No pressure on contributors.** Only the lead scores. Contributors are never ranked. The game never assigns someone who did not ask for the issue ("je prends", "I'll take it").
4. **Nothing is forgotten in the API.** Every GitHub API operation has a written decision (`src/github/api-coverage.ts`, enforced by a test).
5. **Bilingual from day one.** English and French for every word in the game and in the docs.
6. **Legal assets only.** Everything committed is CC0 or made by us, so the repository can be redistributed.
7. **Big vision, small slices.** Each slice ships something beautiful and complete; no grey prototype promised to become pretty later.

## 3. World and story

**The universe is a building site.** The project is a site; each epic is a building that grows one floor per finished task.

**The story: "the impossible site"** (main story A, with the site radio from story B and a touch of magic from story C).

- You are the new site manager of a site nobody believes can be finished on time.
- **The mayor** ordered the building. She has many "small ideas", which fall from the sky as parcels: new issues, scope creep made visible. She visits at each milestone: brass band if it is ready, a grimace if not.
- **Grisaille & Lenteur** ("Greyness & Slowness"), a rival company, bet that you will fail. Their foreman sneers at the fence. The bet gauge is the real burn-up against the next milestone.
- **The site radio**: an over-excited commentator who narrates gestures live, opens the day and closes it.
- **The inspector**, with her checklist and her stamp: the Definition of Ready and code review.
- **Gérard, the crane operator**, often on a coffee break: blocked tasks.
- **Magic**: when a floor is finished, it grows in a swirl of sparks. It is the one expressive moment of the game.
- **Chapters**: each milestone opens a chapter, with a short scene, a new character (the prefect on a visit, a quirky tax inspector) and a new corner of the site.

A story bible (cast, voice of each character, the stock of lines per GitHub event, in both languages) is written before the dialogue system is built.

## 4. From GitHub to the site

| GitHub | On the site |
|---|---|
| Repository and board | The site |
| Epic (issue of type Epic, or parent issue) | A building, one floor per finished sub-issue |
| Issue | A pallet, coloured by its board column |
| Board column (status) | A zone of the site: stock, ready to lay, being laid, inspection, laid |
| Iteration (sprint) | The truck's round |
| Milestone | The mayor's visit, with its date on a ribbon |
| "Blocked by" | A rope between two pallets; Gérard's crane is busy |
| Bug | Termites eating a floor |
| Pull request waiting for review | A queue at the inspection, the inspector tapping her foot |
| Assigned issue with no news for 7 days | The worker asleep in a hammock |
| New issue | A parcel delivered by the mayor, grumbling |
| Contributor | A worker, with their GitHub avatar on their helmet badge and their trade from the labels they work on (back: mason, front: painter, data: surveyor, design: architect) |
| Board status update | The evening bulletin |
| Notifications | The mail at the site office |

The board's field names (status, iteration, size) and the label meanings (trades, bug) are set in one configuration file, so any project can be mapped.

## 5. A day on the site (the game loop)

One game session is one working day, 10 to 15 minutes, matching the lead's real daily round.

1. **Morning: the radio.** The project's "weather" (its health), then three quests of the day taken from real process gaps: a contributor waiting for an answer, a pallet stuck in the stock with an incomplete checklist, a pull request to review, a task with no news for 7 days. Then the bet gauge.
2. **The day: gestures.** The player walks the site and acts. Each gesture is listed in `docs/github-api/COVERAGE.md`. Version 1:
   - open the mayor's parcel and drop it at the right building (attach to its epic, set labels and type);
   - take a pallet to the inspector (tick the DoR checklist, move to Ready); she refuses, with a line, if a box is missing;
   - load the sprint truck (iteration); the truck creaks when overloaded;
   - push a pallet to another zone (status), reorder a zone;
   - hand a pallet to the worker who asked for it, or take it yourself;
   - talk to a worker (a comment, read back before sending), wake the one in the hammock gently;
   - catch termites (bug triage);
   - send the inspector (request a review) and open the pull request on GitHub;
   - rope two pallets or cut the rope (dependencies);
   - lay the last floor (close as completed): the magic moment;
   - set up a mayor's visit (create or move a milestone; REST only);
   - cheer a worker (a reaction).
3. **Evening: the recap.** The radio sums up what moved. The player can post the board's status update (the evening bulletin). If a milestone is near, the mayor visits.

## 6. Progression and novelty

- **Unlocks earned by real progress**: the giant crane at the first milestone met, the forklift at 10 tasks finished, the termite net at the first bug fixed. There is always a next thing to unlock.
- **At most one new lesson a day**: the inspector introduces one gesture at a time (the DoR, the limit of work in progress, review, splitting a task too big), in a few words. No up-front tutorial.
- **Chapters** open with milestones (section 3).
- **The site manager's logbook**: management trophies for the lead (first triage, first contributor unblocked, a week without a hammock). Never a ranking of contributors.
- **Surprises that do not cheat**: radio shows, the mayor's ideas, the end-of-sprint party.

## 7. People and participation

- Contributors appear with their public GitHub avatar and login, only if they are active on the repository. A configuration line lets anyone ask not to appear.
- Phases: **v1** the lead plays alone; **v2** each contributor signs in with GitHub and plays their own worker (takes a pallet, sees the floor they built), with GitHub enforcing their rights; **v3** live site, everyone sees the others move.

## 8. Cameras

- **Site manager**: third person, to play.
- **Site plan**: isometric top view, for the overview a PO or PM needs.
- **Drone**: cinematic fly-over for the mayor's visits, the end of the day and the README video.

## 9. Art direction, sound and assets

- **Style: the model kit with a comic-strip line.** Warm, readable volumes like a toy building site on a table, with black outlines, flat bright colours and speech bubbles for the humour.
- **Base assets**: one CC0 family (Kenney and KayKit, glTF), checked pack by pack. Quaternius's newer packs are excluded (their licence forbids redistribution as packs).
- **Our own cast and buildings** are made by **versioned Blender scripts** run headless (`blender --background --python ...`), not through the Blender MCP server, which runs generated code without guards. Any contributor regenerates every asset with one command.
- **Pipeline**: Blender 5.3 export to glTF, then `@gltf-transform/cli` (Draco or meshopt, KTX2 textures) before the browser loads them.
- **Rendering**: outline pass, soft shadows and ambient occlusion, tone mapping, bloom for the magic only (`@react-three/postprocessing`). Interface motion 100 to 300 ms; one expressive moment (the floor growing, about 560 ms or more).
- **Sound**: CC0 sound packs, positional audio through Three.js's audio listener, the radio as the voice of the game.
- **Reduced motion** reduces, it does not remove: no camera swoops, no particles, colour and focus feedback kept.

## 10. Languages

- English and French from the first slice: every string, dialogue line and radio line lives in `locales/en/*.json` and `locales/fr/*.json`, through `i18next` and `react-i18next` (chosen because contributors and translation platforms know its JSON format).
- The game follows the browser language and has a switch. A test fails when a key exists in one language and not the other.
- README and docs in English, with a French README.

## 11. Architecture

One package, three folders:

- `src/client`: the game. React 19, React Three Fiber 9, Three.js r187, drei, Rapier (`@react-three/rapier`), ecctrl 2 for the character, zustand for state.
- `src/server`: Hono 4 on Node, the only place that talks to GitHub. Types shared with the client through Hono RPC.
- `src/shared`: the GitHub-to-site mapping, the quest rules, zod schemas, locale keys.

**GitHub layer.** Reads and writes through GraphQL (`@octokit/graphql`); milestones through REST. Every gesture is a function `prepare(gesture) -> { target, change, text }` (what the confirmation shows) and `apply(prepared)` (the mutation), so the confirmation always shows exactly what is sent.

**Authentication.** v1 local: the server uses the player's `gh` login on their machine; no token ever reaches the browser. v2 hosted: a GitHub App with user access tokens (the app needs read and write on organization projects and on issues), sessions in Postgres, tokens encrypted at rest.

**Live updates.** v1 polls and refreshes after each gesture. v3 receives GitHub webhooks (signature checked with `@octokit/webhooks`), stores them, and broadcasts to players over WebSocket.

**Database: Postgres 18 with Drizzle ORM** (migrations with drizzle-kit; Postgres in Docker locally). GitHub keeps the project; Postgres keeps what GitHub does not:

- `players` (GitHub id, login, language, preferences);
- `action_log` (who, gesture, target, payload sent, GitHub response, time);
- `unlocks` and `trophies` (lead progression);
- `lessons_seen`;
- `days` (quests drawn, what changed since the last visit);
- `opt_outs` (people who asked not to appear);
- later: `sessions`, `webhook_events`.

## 12. Errors

- A GitHub error is shown in plain words next to the pallet, with what to do next; the player's text is kept.
- **Stale data**: before applying, the server re-reads the item; if it changed since the confirmation, it shows the new state and asks again.
- **API budget**: the remaining rate limit is read and shown discreetly; the game slows its polling before running dry.
- A failed write is never retried silently.

## 13. Testing

- **Vitest**: mapping, quest rules, `prepare` of every gesture, locale parity, API coverage (already in place).
- **Server tests** against recorded GraphQL responses (no network in CI).
- **Integration** against the fictitious sandbox only (`memolabs-dev/project-quest-sandbox`, board `memolabs-dev` project 10, every issue `FICTIF`), run by hand. Never a real organisation's board.
- **Playwright**: the site loads, a pallet card opens, the confirmation shows the exact payload; screenshots at 375 and 1280 px.
- **Local first**: lefthook runs lint and types before each commit, tests before each push.

## 14. Open source readiness

- MIT licence for the code; CC0 or our own assets.
- **A demo site** shipped with the game: an invented project (`FICTIF`) to walk around in 30 seconds, no account needed.
- **One command** to play your own repository: `npx project-quest`, using your `gh` login.
- A README that opens with a short video of the drone camera over the site, in English, with a French README.
- Contributor guide, issue templates, code of conduct.

## 15. Slices

1. **First playable slice (#1)**: walk the site of the test board, see buildings and pallets, open a pallet card, move a pallet to another column for real, through the confirmation, with the action log. English and French. Demo site.
2. Morning radio and quests of the day; evening recap and bulletin.
3. The rest of the v1 gestures, one at a time.
4. Progression, lessons, chapters, trophies.
5. Cameras: plan and drone; README video; `npx project-quest`.
6. v2: contributors sign in and play.
7. v3: live site.

Each slice is an issue of this repository on the public board https://github.com/orgs/memolabs-dev/projects/9, created when the previous one ships.

## 15b. Several projects, several structures

The owner's requirements (2026-11-16): the player chooses which project to play, and the game adapts to each project's structure.

- **A project picker**: several configurations side by side (one per board), chosen at the start of a day; the last one played is remembered.
- **Any structure**: column names and order, the iteration and size fields (or none), which labels mean bug and which mean a trade, epics as issue types or as parent issues, user or organisation boards. Everything structural lives in the configuration, never in the code.
- **A setup helper**: reads a board's fields and columns and proposes a configuration to confirm, so adapting the game to a new project takes minutes.
- **Test stages**: the fictitious sandbox first; then a copy of the SOS MEDITERRANEE project (kept outside this public repository); the real SOS MEDITERRANEE project only once the game is validated.

## 16. Out of scope for now

- Unity, Unreal and the Blender MCP server.
- Line-by-line code review and merging inside the game (GitHub's own page does it; see the API coverage).
- Testing on any real organisation's board (SOS MEDITERRANEE, Data for Good, the Rescue Atlas lab): only the fictitious sandbox.
- Any ranking of contributors.
