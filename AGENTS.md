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

- `npm run dev`: game and server
- `npm test`: Vitest
- `npm run build`: type check and build
- `npx oxlint`: lint

## Rules

- **Test board only**: develop against `memolabs-dev` project 6 ("Rescue Atlas, le lab", private) and its repository `memolabs-dev/rescue-atlas-lab`. Never point the game at `dataforgoodfr` (project 44, the public SOS MEDITERRANEE repo) until the owner validates version 1.
- **Every write is confirmed**: before a GitHub mutation, the game shows exactly what will be sent (issue, change, text). Nothing is written without the player's click. Each write goes to an action log.
- **The browser never holds a token**: only the server talks to GitHub.
- **No pressure on contributors**: only the player (the lead) scores. Never assign someone who did not ask for the issue.
- Test data is invented and marked `FICTIF`. No real data from a partner organisation in the repo.
