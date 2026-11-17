// The game's API: the site, the move gesture in two steps (prepare, then apply after confirmation),
// the levels, and the practice site's gestures. A prepared gesture from the client is a claim: the server
// rebuilds it from a fresh read and sends its own copy, or nothing.
import { isDeepStrictEqual } from "node:util";
import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { QuestConfig } from "../shared/config.ts";
import { GestureError, prepareMove, type PreparedMove } from "../shared/gestures/move.ts";
import {
  prepareEdit, prepareFound, prepareIssue, prepareMayor, prepareMerge, preparePull, prepareTake, type PreparedPractice,
} from "../shared/gestures/practice.ts";
import type { PracticeSnapshot } from "../shared/levels/types.ts";
import { prepareAsk, type PreparedAsk } from "../shared/gestures/real.ts";
import { rebuildTeam, type PreparedTeam, type TeamArgs, type TeamKind } from "../shared/gestures/team.ts";
import { TUTORIAL_EVENTS } from "../shared/levels/types.ts";
import { SiteError, buildSite, type BoardSnapshot } from "../shared/site.ts";
import type { Deps } from "./deps.ts";
import { GitHubAuthError } from "./github/client.ts";
import { BoardNotFoundError, GitHubScopeError } from "./github/errors.ts";
import type { ApplyResult } from "./github/move-item.ts";
import { practiceConfig } from "./github/read-practice.ts";
import { checkLevels, practiceNameOf, todayOf } from "./levels.ts";

const prepareBody = z.object({ itemId: z.string().min(1), toZone: z.string().min(1) });
const preparedBody = z.object({
  kind: z.literal("move"),
  itemId: z.string(),
  issueNumber: z.number(),
  issueTitle: z.string(),
  from: z.string().nullable(),
  to: z.string(),
  fieldId: z.string(),
  optionId: z.string(),
  expectedUpdatedAt: z.string(),
  mutation: z.object({ name: z.literal("updateProjectV2ItemFieldValue"), input: z.record(z.string(), z.unknown()) }),
});
const mutations = z.array(z.object({ name: z.string(), input: z.record(z.string(), z.unknown()) }));
/** The shape of each claim; its content is then checked against the server's own rebuild. */
const practiceClaim = z.discriminatedUnion("kind", [
  z.looseObject({ kind: z.literal("found"), owner: z.string(), name: z.string(), visibility: z.enum(["PUBLIC", "PRIVATE"]), mutations }),
  z.looseObject({ kind: z.literal("issue"), repo: z.string(), title: z.string(), body: z.string(), mutations }),
  z.looseObject({ kind: z.literal("take"), repo: z.string(), issueNumber: z.number(), comment: z.string(), mutations }),
  z.looseObject({ kind: z.literal("edit"), repo: z.string(), issueNumber: z.number().optional(), branch: z.string(), content: z.string(), message: z.string(), mutations }),
  z.looseObject({ kind: z.literal("pull"), repo: z.string(), branch: z.string(), issueNumber: z.number(), title: z.string(), body: z.string(), mutations }),
  z.looseObject({ kind: z.literal("merge"), repo: z.string(), pullNumber: z.number(), mutations }),
  z.looseObject({ kind: z.literal("mayor"), repo: z.string(), branch: z.string(), mutations }),
]);

/** The issue a practice branch works on: "practice-<n>". */
const issueOfBranch = (branch: string) => Number(/^practice-(\d+)$/.exec(branch)?.[1] ?? NaN);

/** The server's own copy of a claimed gesture, from its fresh read of the practice site. */
function rebuild(claim: PreparedPractice, viewer: { login: string; id: string }, name: string, practice: PracticeSnapshot | null): PreparedPractice {
  if (claim.kind === "found") return prepareFound(viewer, practice, name, claim.visibility);
  if (!practice) throw new GestureError("Your practice site is not founded yet");
  switch (claim.kind) {
    case "issue": return prepareIssue(practice, claim.title, claim.body);
    case "take": return prepareTake(practice, viewer, claim.issueNumber, claim.comment);
    case "edit": return prepareEdit(practice, viewer, issueOfBranch(claim.branch), claim.content, claim.message);
    case "pull": return preparePull(practice, viewer, claim.issueNumber, claim.title, claim.body.replace(/\n\nCloses #\d+$/, ""), claim.branch);
    case "merge": return prepareMerge(practice, viewer, claim.pullNumber);
    case "mayor": return prepareMayor(practice);
  }
}

const teamArgs = z.object({
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(), issueNumber: z.number().int().optional(), label: z.string().optional(),
  original: z.number().int().optional(), items: z.array(z.string()).optional(), size: z.string().optional(),
  title: z.string().optional(), dueOn: z.string().optional(), issues: z.array(z.number().int()).optional(),
  milestone: z.number().int().optional(), titles: z.array(z.string()).optional(), blocking: z.number().int().optional(),
  status: z.string().optional(), body: z.string().optional(), limit: z.number().optional(),
}) satisfies z.ZodType<TeamArgs>;

const MAYOR_NOT_NOW = "The mayor changes the plan only at level 13, once: nothing was sent";
const NOT_YOURS = "Levels write only to your own practice site: nothing was sent";

/** Rebuilds a claimed move from the board and sends it if nothing changed meanwhile. */
async function applyClaimedMove(
  c: Context, deps: Deps, claim: PreparedMove, config: QuestConfig,
  read: () => Promise<BoardSnapshot>, apply: (m: PreparedMove) => Promise<ApplyResult>,
) {
  const { login } = await deps.viewer();
  const board = await read();
  const item = board.items.find((i) => i.itemId === claim.itemId);
  if (item && (item.status !== claim.from || item.updatedAt !== claim.expectedUpdatedAt)) {
    return c.json({ ok: false as const, reason: "stale" as const, current: { status: item.status, updatedAt: item.updatedAt } });
  }
  const move = prepareMove(board, claim.itemId, claim.to, config.zones);
  if (!isDeepStrictEqual(move.mutation, claim.mutation) || move.optionId !== claim.optionId || move.fieldId !== claim.fieldId) {
    return c.json({ error: "gesture" as const, message: "This move does not match the board: nothing was sent" }, 409);
  }
  const result = await apply(move);
  await record(deps, {
    playerLogin: login, gesture: "move", target: `#${move.issueNumber}`, payload: move.mutation,
    result: result.ok ? "applied" : result.reason === "stale" ? "stale" : "failed", githubResponse: result.ok ? null : result,
  });
  if (!result.ok) return c.json(result);
  let site: ReturnType<typeof buildSite> | null = null;
  try {
    site = result.board ? buildSite(result.board, config) : null;
  } catch {
    site = null;
  }
  return c.json({ ok: true as const, site });
}

/** A failed log write never fails the gesture: it already happened on GitHub. */
async function record(deps: Deps, e: Parameters<Deps["log"]["record"]>[0]) {
  try {
    await deps.log.record(e);
  } catch (err) {
    console.error("[project-quest] the action log could not be written", err);
  }
}

/** The viewer, their practice site's name and what GitHub holds there. */
async function practiceContext(deps: Deps) {
  const { login } = await deps.viewer();
  const name = await practiceNameOf(deps, login);
  const practice = await deps.readPractice(login, name);
  return { login, name, practice };
}

/** The lead's team site: the same reading as the practice site, under its own name. */
async function teamContext(deps: Deps) {
  const { login } = await deps.viewer();
  const name = deps.teamName;
  if (name.toLowerCase() === (await practiceNameOf(deps, login)).toLowerCase()) {
    throw new GestureError("The team site cannot be your practice site: give it another name (QUEST_TEAM_REPO)");
  }
  return { login, name, practice: await deps.readPractice(login, name) };
}

/** The practice (or team) board drawn as a site, or null before it is founded. */
async function practiceBoard(deps: Deps, site: "practice" | "team" = "practice") {
  const { login, name, practice } = await (site === "team" ? teamContext(deps) : practiceContext(deps));
  if (!practice?.board) return null;
  const config = practiceConfig(login, name, practice.board.number, practice.board.columns);
  const boardId = practice.board.id;
  // The board is read by number under the viewer's account: refuse it unless it is the very board linked to the site.
  const read = async () => {
    const snapshot = await deps.readBoardFor(config);
    if (snapshot.projectId !== boardId) throw new PracticeBoardMismatch("This board is not your practice site's board: nothing was sent");
    return snapshot;
  };
  return { config, read };
}

class PracticeBoardMismatch extends Error {}

const PRACTICE_MISSING = { error: "practice-missing" as const, message: "Your practice site is not founded yet" };

/** `demo` answers requests that carry ?demo=1, so a player without GitHub access can still visit the demo site. */
/** settleMs: how long to wait between rereads while GitHub links a new pull request to its issue. */
export function createApp(live: Deps, demo?: Deps, { settleMs = 1500 }: { settleMs?: number } = {}) {
  // A page marked demo is the demo, whatever the value: "?demo=" too (the client reads it the same way).
  const pick = (c: { req: { query(name: string): string | undefined } }) => (demo && c.req.query("demo") !== undefined ? demo : live);
  // Levels always belong to the real player, even while they play the tutorial on the demo site.
  const levels = async () => checkLevels(live, (await live.viewer()).login);
  // The mayor changes main once, for level 13, while the branch has not seen main move yet.
  const mayorsTurn = async () => {
    const v = await levels();
    return v.current === "a13-bring-main" && !v.practice.mainMoved;
  };
  // After a write GitHub accepted, a failed re-read must never turn the done gesture into an error: the client reads again.
  const levelsAfterWrite = async () => {
    try {
      return await levels();
    } catch {
      return null;
    }
  };
  return new Hono()
    // Defence in depth: a write comes only from the game's own page, never from another site the player has open.
    .use("/api/*", async (c, next) => {
      const origin = c.req.header("origin");
      if (c.req.method !== "GET" && origin) {
        const host = c.req.header("host") ?? new URL(c.req.url).host;
        if (origin === "null" || new URL(origin).host !== host) return c.json({ error: "gesture" as const, message: "Writes come only from the game's own page" }, 403);
      }
      await next();
    })
    .onError((err, c) => {
      if (err instanceof GitHubAuthError) return c.json({ error: "github-auth", hint: "gh auth login" }, 503);
      if (err instanceof GitHubScopeError) return c.json({ error: "github-scope", hint: "gh auth refresh -s project" }, 503);
      if (err instanceof BoardNotFoundError || err instanceof SiteError) return c.json({ error: "board", message: err.message }, 502);
      if (err instanceof GestureError) return c.json({ error: "gesture", message: err.message }, 400);
      if (err instanceof PracticeBoardMismatch) return c.json({ error: "gesture", message: err.message }, 409);
      console.error(err);
      return c.json({ error: "server", message: "Something went wrong on the server" }, 500);
    })
    .get("/api/site", async (c) => {
      const own = c.req.query("site");
      if (own === "practice" || own === "team") {
        const board = await practiceBoard(live, own);
        if (!board) return c.json(PRACTICE_MISSING, 404);
        const viewer = await live.viewer();
        return c.json({ site: buildSite(await board.read(), board.config), viewer, mode: live.mode, demoReason: null });
      }
      const deps = pick(c);
      const [board, viewer] = await Promise.all([deps.readBoard(), deps.viewer()]);
      return c.json({ site: buildSite(board, deps.config), viewer, mode: deps.mode, demoReason: deps.demoReason ?? null });
    })
    .post("/api/moves/prepare", zValidator("json", prepareBody), async (c) => {
      const { itemId, toZone } = c.req.valid("json");
      const deps = pick(c);
      return c.json(prepareMove(await deps.readBoard(), itemId, toZone, deps.config.zones));
    })
    .post("/api/moves/apply", zValidator("json", preparedBody), async (c) => {
      const deps = pick(c);
      return applyClaimedMove(c, deps, c.req.valid("json") as PreparedMove, deps.config, () => deps.readBoard(), (m) => deps.applyMove(m));
    })
    .get("/api/log", async (c) => c.json(await pick(c).log.latest(20)))

    // ---------- Levels ----------
    .get("/api/levels", async (c) => c.json(await levels()))
    .post("/api/levels/check", async (c) => c.json(await levels()))
    .post("/api/levels/path", zValidator("json", z.object({ path: z.enum(["volunteer", "lead"]) })), async (c) => {
      await live.progress.setPath((await live.viewer()).login, c.req.valid("json").path);
      return c.json(await levels());
    })
    // The game's rule, not a GitHub write: kept with the player's progress (lead's path spec, section 5).
    .post("/api/levels/capacity", zValidator("json", z.object({ points: z.number().int().min(1).max(100) })), async (c) => {
      const { login } = await live.viewer();
      if ((await live.progress.path(login)) !== "lead") return c.json({ error: "gesture" as const, message: "The capacity belongs to the lead's path" }, 409);
      await live.progress.setCapacity(login, c.req.valid("json").points);
      return c.json(await levels());
    })
    // "Start again" exists on the demo site only: real progress is never thrown away.
    .post("/api/levels/reset", async (c) => {
      if (live.mode !== "demo") return c.json({ error: "gesture" as const, message: "Only the demo site starts again" }, 404);
      await live.progress.reset((await live.viewer()).login);
      return c.json(await levels());
    })
    .post("/api/levels/event", zValidator("json", z.object({ event: z.enum(TUTORIAL_EVENTS) })), async (c) => {
      const { login } = await live.viewer();
      await live.progress.addEvent(login, c.req.valid("json").event);
      return c.json(await levels());
    })

    // ---------- The practice site ----------
    .post("/api/practice/found/prepare", zValidator("json", z.object({ visibility: z.enum(["PUBLIC", "PRIVATE"]) })), async (c) => {
      const { login, name, practice } = await practiceContext(live);
      return c.json(prepareFound({ login, id: await live.viewerId() }, practice, name, c.req.valid("json").visibility));
    })
    .post("/api/practice/issue/prepare", zValidator("json", z.object({ title: z.string(), body: z.string() })), async (c) => {
      const { practice } = await practiceContext(live);
      if (!practice) return c.json(PRACTICE_MISSING, 404);
      const { title, body } = c.req.valid("json");
      return c.json(prepareIssue(practice, title, body));
    })
    .post("/api/practice/take/prepare", zValidator("json", z.object({ issueNumber: z.number().int(), comment: z.string() })), async (c) => {
      const { login, practice } = await practiceContext(live);
      if (!practice) return c.json(PRACTICE_MISSING, 404);
      const { issueNumber, comment } = c.req.valid("json");
      return c.json(prepareTake(practice, { login, id: await live.viewerId() }, issueNumber, comment));
    })
    // Only the gestures: "moves" has its own routes below.
    .post("/api/practice/edit/prepare", zValidator("json", z.object({ issueNumber: z.number().int(), content: z.string(), message: z.string() })), async (c) => {
      const { login, practice } = await practiceContext(live);
      if (!practice) return c.json(PRACTICE_MISSING, 404);
      const { issueNumber, content, message } = c.req.valid("json");
      return c.json(prepareEdit(practice, { login, id: "" }, issueNumber, content, message));
    })
    .post("/api/practice/pull/prepare", zValidator("json", z.object({
      issueNumber: z.number().int(), title: z.string(), why: z.string(), branch: z.string().optional(),
    })), async (c) => {
      const { login, practice } = await practiceContext(live);
      if (!practice) return c.json(PRACTICE_MISSING, 404);
      const { issueNumber, title, why, branch } = c.req.valid("json");
      return c.json(preparePull(practice, { login }, issueNumber, title, why, branch));
    })
    .post("/api/practice/mayor/prepare", async (c) => {
      const { practice } = await practiceContext(live);
      if (!practice) return c.json(PRACTICE_MISSING, 404);
      if (!(await mayorsTurn())) return c.json({ error: "gesture" as const, message: MAYOR_NOT_NOW }, 409);
      return c.json(prepareMayor(practice));
    })
    .post("/api/practice/merge/prepare", zValidator("json", z.object({ pullNumber: z.number().int() })), async (c) => {
      const { login, practice } = await practiceContext(live);
      if (!practice) return c.json(PRACTICE_MISSING, 404);
      return c.json(prepareMerge(practice, { login }, c.req.valid("json").pullNumber));
    })
    .post("/api/practice/:kind{found|issue|take|edit|pull|merge|mayor}/apply", zValidator("json", practiceClaim), async (c) => {
      const claim = c.req.valid("json") as unknown as PreparedPractice;
      // A page marked demo never sends, even on a server that could.
      if (c.req.query("demo") !== undefined) return c.json({ error: "gesture" as const, message: "The demo site sends nothing" }, 409);
      if (claim.kind !== c.req.param("kind")) return c.json({ error: "gesture" as const, message: NOT_YOURS }, 409);
      const { login, name, practice } = await practiceContext(live);
      // The guard: whatever the client claims, a level writes only to the viewer's own practice repository.
      const target = claim.kind === "found" ? `${claim.owner}/${claim.name}` : claim.repo;
      if (target.toLowerCase() !== `${login}/${name}`.toLowerCase()) return c.json({ error: "gesture" as const, message: NOT_YOURS }, 409);
      if (claim.kind !== "found" && !practice) return c.json(PRACTICE_MISSING, 404);
      if (claim.kind === "mayor" && !(await mayorsTurn())) return c.json({ error: "gesture" as const, message: MAYOR_NOT_NOW }, 409);
      const viewer = { login, id: claim.kind === "found" || claim.kind === "take" ? await live.viewerId() : "" };
      const rebuilt = rebuild(claim, viewer, name, practice);
      if (!isDeepStrictEqual(rebuilt, claim)) {
        return c.json({ error: "gesture" as const, message: "This gesture does not match your site: nothing was sent" }, 409);
      }
      const entry = { playerLogin: login, gesture: rebuilt.kind, target, payload: rebuilt.mutations };
      let result: Awaited<ReturnType<Deps["applyPractice"]>>;
      try {
        result = await live.applyPractice(rebuilt);
      } catch (e) {
        await record(live, { ...entry, result: "failed", githubResponse: { message: e instanceof Error ? e.message : String(e) } });
        throw e;
      }
      await record(live, { ...entry, result: result.ok ? "applied" : "failed", githubResponse: result.ok ? null : result });
      if (!result.ok) return c.json(result);
      if (rebuilt.kind === "found") await live.progress.setPracticeRepo(login, name);
      let view = await levelsAfterWrite();
      // GitHub links a new pull request to the issue it closes a moment after creating it: read again, a few times.
      for (let i = 0; i < 3 && rebuilt.kind === "pull" && view?.current === "a9-open-pull"; i++) {
        await new Promise((r) => setTimeout(r, settleMs));
        view = await levelsAfterWrite();
      }
      return c.json({ ok: true as const, levels: view });
    })
    // ---------- The real project: ask for a good first issue (one comment, nothing else) ----------
    .post("/api/real/ask/prepare", zValidator("json", z.object({ issueNumber: z.number().int(), comment: z.string() })), async (c) => {
      const { login } = await live.viewer();
      const { issueNumber, comment } = c.req.valid("json");
      return c.json(prepareAsk(await live.readGoodFirst(issueNumber), login, issueNumber, comment));
    })
    .post("/api/real/ask/apply", zValidator("json", z.looseObject({
      // GitHub takes a comment of 65536 characters at most.
      kind: z.literal("ask"), repo: z.string(), issueNumber: z.number(), comment: z.string().max(65_536), mutations,
    })), async (c) => {
      const claim = c.req.valid("json") as unknown as PreparedAsk;
      if (c.req.query("demo") !== undefined) return c.json({ error: "gesture" as const, message: "The demo site sends nothing" }, 409);
      const home = `${live.config.owner}/${live.config.repo}`;
      // The guard: an ask goes only to the project the game is configured on.
      if (claim.repo.toLowerCase() !== home.toLowerCase()) {
        return c.json({ error: "gesture" as const, message: "An ask goes only to the project the game is set up for: nothing was sent" }, 409);
      }
      const { login } = await live.viewer();
      const rebuilt = prepareAsk(await live.readGoodFirst(claim.issueNumber), login, claim.issueNumber, claim.comment);
      if (!isDeepStrictEqual(rebuilt, claim)) {
        return c.json({ error: "gesture" as const, message: "This ask does not match the project: nothing was sent" }, 409);
      }
      const entry = { playerLogin: login, gesture: "ask", target: `${home}#${rebuilt.issueNumber}`, payload: rebuilt.mutations };
      let result: Awaited<ReturnType<Deps["applyAsk"]>>;
      try {
        result = await live.applyAsk(rebuilt);
      } catch (e) {
        await record(live, { ...entry, result: "failed", githubResponse: { message: e instanceof Error ? e.message : String(e) } });
        throw e;
      }
      await record(live, { ...entry, result: result.ok ? "applied" : "failed", githubResponse: result.ok ? null : result });
      if (!result.ok) return c.json(result);
      return c.json({ ok: true as const, levels: await levelsAfterWrite() });
    })
    // ---------- The lead's team site (its own guard: only <viewer>/<teamName>) ----------
    .post("/api/team/:kind{team-found|parcels|label|duplicate|checklist|size|sprint-field|load|unload|milestone|attach|split|rope|bulletin|wip-limit|team-day|finish|close-visit|move-visit}/prepare", zValidator("json", teamArgs), async (c) => {
      const { login, name, practice } = await teamContext(live);
      const viewer = { login, id: c.req.param("kind") === "team-found" ? await live.viewerId() : "" };
      return c.json(rebuildTeam(c.req.param("kind") as TeamKind, c.req.valid("json"), viewer, name, practice, todayOf(live)));
    })
    .post("/api/team/:kind{team-found|parcels|label|duplicate|checklist|size|sprint-field|load|unload|milestone|attach|split|rope|bulletin|wip-limit|team-day|finish|close-visit|move-visit}/apply", zValidator("json", z.looseObject({
      kind: z.string(), repo: z.string(), args: teamArgs, mutations,
    })), async (c) => {
      const claim = c.req.valid("json") as unknown as PreparedTeam;
      if (c.req.query("demo") !== undefined) return c.json({ error: "gesture" as const, message: "The demo site sends nothing" }, 409);
      const { login, name, practice } = await teamContext(live);
      const home = `${login}/${name}`;
      if (claim.kind !== c.req.param("kind") || claim.repo.toLowerCase() !== home.toLowerCase()) {
        return c.json({ error: "gesture" as const, message: "The lead's gestures write only to your own team site: nothing was sent" }, 409);
      }
      const viewer = { login, id: claim.kind === "team-found" ? await live.viewerId() : "" };
      const rebuilt = rebuildTeam(claim.kind, claim.args, viewer, name, practice, todayOf(live));
      if (!isDeepStrictEqual(rebuilt, claim)) {
        return c.json({ error: "gesture" as const, message: "This gesture does not match your team site: nothing was sent" }, 409);
      }
      const entry = { playerLogin: login, gesture: rebuilt.kind, target: home, payload: rebuilt.mutations };
      let result: Awaited<ReturnType<Deps["applyTeam"]>>;
      try {
        result = await live.applyTeam(rebuilt);
      } catch (e) {
        await record(live, { ...entry, result: "failed", githubResponse: { message: e instanceof Error ? e.message : String(e) } });
        throw e;
      }
      await record(live, { ...entry, result: result.ok ? "applied" : "failed", githubResponse: result.ok ? null : result });
      if (!result.ok) return c.json(result);
      // What GitHub cannot show afterwards is kept as a game event, only once GitHub accepted the gesture.
      if (rebuilt.kind === "team-day") await live.progress.addEvent(login, "team-day");
      if (rebuilt.kind === "move-visit") await live.progress.addEvent(login, "visit-moved");
      return c.json({ ok: true as const, levels: await levelsAfterWrite() });
    })
    .post("/api/team/moves/prepare", zValidator("json", prepareBody), async (c) => {
      const board = await practiceBoard(live, "team");
      if (!board) return c.json(PRACTICE_MISSING, 404);
      const { itemId, toZone } = c.req.valid("json");
      return c.json(prepareMove(await board.read(), itemId, toZone, board.config.zones));
    })
    .post("/api/team/moves/apply", zValidator("json", preparedBody), async (c) => {
      const board = await practiceBoard(live, "team");
      if (!board) return c.json(PRACTICE_MISSING, 404);
      const config = board.config;
      return applyClaimedMove(c, live, c.req.valid("json") as PreparedMove, config, board.read, (m) => live.applyMoveFor(config, m));
    })
    .post("/api/practice/moves/prepare", zValidator("json", prepareBody), async (c) => {
      const board = await practiceBoard(live);
      if (!board) return c.json(PRACTICE_MISSING, 404);
      const { itemId, toZone } = c.req.valid("json");
      return c.json(prepareMove(await board.read(), itemId, toZone, board.config.zones));
    })
    .post("/api/practice/moves/apply", zValidator("json", preparedBody), async (c) => {
      const board = await practiceBoard(live);
      if (!board) return c.json(PRACTICE_MISSING, 404);
      const config = board.config;
      return applyClaimedMove(c, live, c.req.valid("json") as PreparedMove, config, board.read, (m) => live.applyMoveFor(config, m));
    });
}

export type AppType = ReturnType<typeof createApp>;
