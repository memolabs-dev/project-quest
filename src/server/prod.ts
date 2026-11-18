// The public server (#16): the built game and the read-only visit, nothing else.
// No write route exists here; the GitHub token (GITHUB_TOKEN) only needs to read public repositories.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { githubGql, githubToken } from "./github/client.ts";
import { readRepo } from "./github/read-repo.ts";
import { createVisitApp } from "./visit-app.ts";

if (!process.env.GITHUB_TOKEN) {
  console.error("[project-quest] GITHUB_TOKEN is not set: the public server reads GitHub with its own read-only token");
  process.exit(1);
}
await githubToken();

const port = Number(process.env.PORT ?? 3000);
const readsPerHour = Number(process.env.QUEST_VISIT_READS_PER_HOUR ?? 600);
let gql: ReturnType<typeof githubGql> | null = null;
const client = () => (gql ??= githubGql().catch((e) => { gql = null; throw e; }));

const app = new Hono()
  .get("/healthz", (c) => c.text("ok"))
  // The public page is the visit: any other address of the game leads to its question.
  .get("/", async (c, next) => (c.req.query("visit") === undefined ? c.redirect("/?visit", 302) : next()))
  .route("/", createVisitApp(async (repo) => readRepo(await client(), repo), { readsPerHour }))
  .all("/api/*", (c) => c.json({ error: "server" as const, message: "Not on the public server" }, 404))
  .use("/*", serveStatic({ root: "./dist" }))
  .get("*", serveStatic({ path: "./dist/index.html" }));

serve({ fetch: app.fetch, port }, () => console.log(`[project-quest] public visit on port ${port}, ${readsPerHour} GitHub reads per hour at most`));
