// The game's API: the site, and the move gesture in two steps (prepare, then apply after confirmation).
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { GestureError, prepareMove, type PreparedMove } from "../shared/gestures/move.ts";
import { SiteError, buildSite } from "../shared/site.ts";
import type { Deps } from "./deps.ts";
import { GitHubAuthError } from "./github/client.ts";
import { BoardNotFoundError } from "./github/read-board.ts";

const prepareBody = z.object({ itemId: z.string().min(1), toZone: z.string().min(1) });
const preparedBody = z.object({
  kind: z.literal("move"),
  itemId: z.string(),
  issueNumber: z.number(),
  issueTitle: z.string(),
  from: z.string(),
  to: z.string(),
  fieldId: z.string(),
  optionId: z.string(),
  expectedUpdatedAt: z.string(),
  mutation: z.object({ name: z.literal("updateProjectV2ItemFieldValue"), input: z.record(z.string(), z.unknown()) }),
});

/** `demo` answers requests that carry ?demo=1, so a player without GitHub access can still visit the demo site. */
export function createApp(live: Deps, demo?: Deps) {
  const pick = (c: { req: { query(name: string): string | undefined } }) => (demo && c.req.query("demo") ? demo : live);
  return new Hono()
    .onError((err, c) => {
      if (err instanceof GitHubAuthError) return c.json({ error: "github-auth", hint: "gh auth login" }, 503);
      if (err instanceof BoardNotFoundError || err instanceof SiteError) return c.json({ error: "board", message: err.message }, 502);
      if (err instanceof GestureError) return c.json({ error: "gesture", message: err.message }, 400);
      console.error(err);
      return c.json({ error: "server", message: "Something went wrong on the server" }, 500);
    })
    .get("/api/site", async (c) => {
      const deps = pick(c);
      const [board, viewer] = await Promise.all([deps.readBoard(), deps.viewer()]);
      return c.json({ site: buildSite(board, deps.config), viewer, mode: deps.mode, demoReason: deps.demoReason ?? null });
    })
    .post("/api/moves/prepare", zValidator("json", prepareBody), async (c) => {
      const { itemId, toZone } = c.req.valid("json");
      return c.json(prepareMove(await pick(c).readBoard(), itemId, toZone));
    })
    .post("/api/moves/apply", zValidator("json", preparedBody), async (c) => {
      const prepared = c.req.valid("json") as PreparedMove;
      const deps = pick(c);
      const result = await deps.applyMove(prepared);
      const { login } = await deps.viewer();
      await deps.log.record({
        playerLogin: login, gesture: "move", target: `#${prepared.issueNumber}`, payload: prepared.mutation,
        result: result.ok ? "applied" : result.reason === "stale" ? "stale" : "failed",
        githubResponse: result.ok ? null : result,
      });
      return c.json(result.ok ? { ok: true as const, site: buildSite(result.board, deps.config) } : result);
    })
    .get("/api/log", async (c) => c.json(await pick(c).log.latest(20)));
}

export type AppType = ReturnType<typeof createApp>;
