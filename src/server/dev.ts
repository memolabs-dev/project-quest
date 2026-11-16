// Entry used by Vite in development: the API runs inside the Vite server, on the same origin as the game.
import { createApp } from "./app.ts";
import { resolveDeps } from "./deps.ts";

const deps = await resolveDeps();
console.log(`[project-quest] ${deps.mode} mode${deps.demoReason ? ` (${deps.demoReason})` : ""}`);
export default createApp(deps);
