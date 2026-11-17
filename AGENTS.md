# project-quest

Project rules: `~/memolabs/AGENTS.md` (git regime A: small commits on `main`, checked locally before the push).

## What it is

A 3D game that manages a GitHub repository and its Projects (v2) board. Every action in the game is a real GitHub write. Generic: nothing in the code names a specific organisation or project.

## Stack

React 19 + Three.js r187 via React Three Fiber 9, drei, `@react-three/rapier`, ecctrl 2, zustand. Hono server on Node for every GitHub call (`@octokit/graphql`). Vite 8, TypeScript, Vitest, oxlint.

Skills to load: `router` (gamedev), `threejs-react-three-fiber`, `threejs-interaction`, `camera-systems`, `game-ui-ux`, `game-feel`.

## Backlog

The backlog lives in GitHub: issues of this repository on the public board https://github.com/orgs/memolabs-dev/projects/9, whose columns are the game's zones (Backlog, Ready, In progress, In review, Done). The game can manage its own board. Reference the issue (`#N`) in commit messages. Linear is no longer used (moved on 2026-11-16).

## Commands

- `npm run dev:demo`: the demo site (nothing sent to GitHub); `npm run dev`: the configured board (`quest.config.json`)
- `npm test`: Vitest; `npm run test:e2e`: Playwright on the installed Chrome; `npm run test:db`: the database tests on Docker Postgres (port 5442), on their own `quest_test` database (`npm run db:test:setup` once); they empty their tables and refuse any database not named `*_test`
- `npm run check`: types, lint, unit tests (lefthook runs it before each push)
- `npm run assets`: rebuild the 3D kit with Blender 5.3 headless

## GitHub API

Every GitHub API operation (GraphQL mutations and root queries, REST endpoints, webhook events: 1873 on 2026-11-16) is listed in `docs/github-api/inventory.json` and decided in `src/github/api-coverage.ts`: a gesture, a read, later, or out with its reason. `npm test` fails if one is missing. To refresh: `npm run api:download && npm run api:inventory && npm run api:coverage`, then decide the new operations. Readable summary: `docs/github-api/COVERAGE.md`.

## Rules

- **Where to test, in three stages (owner's rule, 2026-11-16)**:
  1. Now: the fictitious sandbox only, `memolabs-dev/project-quest-sandbox` and its board `memolabs-dev` project 10 (invented FICTIF issues, `scripts/seed-sandbox.ts`).
  2. Later, when the owner says so: a copy of the SOS MEDITERRANEE project, kept outside this public repository (partner data never enters the repo), and tested there from then on.
  3. Only once the game is fully validated: the real SOS MEDITERRANEE project.
  Never test on a real organisation's project before its stage: not SOS MEDITERRANEE, not Data for Good (`dataforgoodfr`), not the Rescue Atlas lab (`memolabs-dev` project 6).
- **Every write is confirmed**: before a GitHub mutation, the game shows exactly what will be sent (issue, change, text). Nothing is written without the player's click. Each write goes to an action log.
- **The browser never holds a token**: only the server talks to GitHub.
- **No pressure on contributors**: only the player (the lead) scores. Never assign someone who did not ask for the issue.
- Test data is invented and marked `FICTIF`. No real data from a partner organisation in the repo.
