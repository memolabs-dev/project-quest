# project-quest

Project rules: `~/memolabs/AGENTS.md` (git regime A: small commits on `main`, checked locally before the push).

## What it is

A 3D game that manages a GitHub repository and its Projects (v2) board. Every action in the game is a real GitHub write. Generic: nothing in the code names a specific organisation or project.

## Stack

React 19 + Three.js r187 via React Three Fiber 9, drei, `@react-three/rapier`, ecctrl 2, zustand. Hono server on Node for every GitHub call (`@octokit/graphql`). Vite 8, TypeScript, Vitest, oxlint.

Skills to load: `router` (gamedev), `threejs-react-three-fiber`, `threejs-interaction`, `camera-systems`, `game-ui-ux`, `game-feel`.

## Backlog

The backlog of this project lives in Linear: project `project-quest` (P-MEM-9) in the Memo Lab team, https://linear.app/memo-labs-workspace/project/project-quest-b902eddbc5e3. Not in GitHub issues. Reference the Linear issue (`MEM-…`) in commit messages.

## Commands

- `npm run dev:demo`: the demo site (nothing sent to GitHub); `npm run dev`: the configured board (`quest.config.json`)
- `npm test`: Vitest; `npm run test:e2e`: Playwright on the installed Chrome; `npm run test:db`: logbook on Docker Postgres (port 5442)
- `npm run check`: types, lint, unit tests (lefthook runs it before each push)
- `npm run assets`: rebuild the 3D kit with Blender 5.3 headless

## GitHub API

Every GitHub API operation (GraphQL mutations and root queries, REST endpoints, webhook events: 1873 on 2026-11-16) is listed in `docs/github-api/inventory.json` and decided in `src/github/api-coverage.ts`: a gesture, a read, later, or out with its reason. `npm test` fails if one is missing. To refresh: `npm run api:download && npm run api:inventory && npm run api:coverage`, then decide the new operations. Readable summary: `docs/github-api/COVERAGE.md`.

## Rules

- **Test board only**: develop against `memolabs-dev` project 6 ("Rescue Atlas, le lab", private) and its repository `memolabs-dev/rescue-atlas-lab`. Never point the game at `dataforgoodfr` (project 44, the public SOS MEDITERRANEE repo) until the owner validates version 1.
- **Every write is confirmed**: before a GitHub mutation, the game shows exactly what will be sent (issue, change, text). Nothing is written without the player's click. Each write goes to an action log.
- **The browser never holds a token**: only the server talks to GitHub.
- **No pressure on contributors**: only the player (the lead) scores. Never assign someone who did not ask for the issue.
- Test data is invented and marked `FICTIF`. No real data from a partner organisation in the repo.
