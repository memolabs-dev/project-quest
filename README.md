# project-quest

A video game for managing a GitHub project. You walk around a 3D building site: each epic is a building, each issue is a block coloured by its board column. Every move in the game is a real GitHub change (move a card, assign, add to a sprint, comment, close), shown to you and confirmed before it is sent.

Works with any GitHub repository and its Projects (v2) board. Status: first version in progress.

## Stack

- **Game**: React 19, Three.js r187 through React Three Fiber 9, drei, Rapier physics (`@react-three/rapier`), ecctrl 2 for the third-person character, zustand for state.
- **Server**: Hono on Node, the only place that talks to GitHub (GraphQL through `@octokit/graphql`). Locally it uses your `gh` login; a GitHub App sign-in comes later for a hosted version.
- **Tooling**: Vite 8, TypeScript, Vitest, oxlint.

No database: GitHub is the source of truth.

## Run it

```bash
npm install
npm run dev
```

## Configuration

The board the game reads and writes is set in one config file (owner, repository, project number, and the names of the status and iteration fields). Develop against a test board you own, never against a board other people depend on.
