import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LevelsView } from "../shared/api.ts";
import { loadConfig } from "../shared/config.ts";
import { prepareIssue, type PreparedPractice } from "../shared/gestures/practice.ts";
import type { PracticeIssue, PracticeSnapshot } from "../shared/levels/types.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { createApp } from "./app.ts";
import { memoryActionLog } from "./db/log.ts";
import { memoryProgress, type ProgressStore } from "./db/progress.ts";
import type { Deps } from "./deps.ts";
import { GitHubScopeError } from "./github/errors.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const config = loadConfig(read("../../quest.config.json"));
const demo = read("../shared/demo/demo-board.json") as BoardSnapshot;
const VIEWER = "fictif-volunteer";

const issue = (o: Partial<PracticeIssue> = {}): PracticeIssue => ({
  id: "I_fictif_1", number: 1, url: "https://github.com/fictif-volunteer/my-first-site/issues/1", author: VIEWER,
  assignees: [], comments: [], status: "Todo", closed: false, ...o,
});
const site = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "https://github.com/fictif-volunteer/my-first-site" },
  board: { id: "PVT_fictif", number: 1, url: "https://github.com/users/fictif-volunteer/projects/1", columns: ["Todo", "In Progress", "Done"] },
  issues: [], ...o,
});

const make = (practice: PracticeSnapshot | null, extra: Partial<Deps> & { progress?: ProgressStore } = {}) => {
  const sent: PreparedPractice[] = [];
  const deps: Deps = {
    mode: "live", config,
    readBoard: async () => demo, applyMove: async () => ({ ok: true, board: demo }),
    readBoardFor: async () => demo, applyMoveFor: async () => ({ ok: true, board: demo }),
    log: memoryActionLog(),
    viewer: async () => ({ login: VIEWER, avatarUrl: "" }),
    viewerId: async () => "U_fictif",
    progress: memoryProgress(),
    practiceName: "my-first-site",
    readPractice: async () => practice,
    applyPractice: async (p) => { sent.push(p); return { ok: true }; },
    ...extra,
  };
  return { app: createApp(deps), deps, sent };
};
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const view = async (res: Response) => (await res.json()) as LevelsView;

describe("levels", () => {
  it("a tutorial event stamps its level on check", async () => {
    const { app } = make(null);
    await app.request("/api/levels/event", post({ event: "walked" }));
    await app.request("/api/levels/event", post({ event: "card-opened" }));
    const v = await view(await app.request("/api/levels/check", post({})));
    expect(v.stamps.map((s) => s.levelId)).toEqual(["a1-walk"]);
    expect(v.current).toBe("a2-read-issue");
    expect(v.unlocks).toEqual({ helmet: true, skillBook: true, ownSite: false });
    expect(v.practice).toEqual({ name: "my-first-site", exists: false });
  });

  it("refuses an unknown tutorial event", async () => {
    const { app } = make(null);
    expect((await app.request("/api/levels/event", post({ event: "teleported" }))).status).toBe(400);
  });

  it("stamps stop at the first level not passed", async () => {
    const progress = memoryProgress();
    for (const e of ["walked", "card-opened", "card-read", "pallet-moved"] as const) await progress.addEvent(VIEWER, e);
    const { app } = make(site({ board: null, issues: [issue()] }), { progress });
    const v = await view(await app.request("/api/levels/check", post({})));
    expect(v.stamps.map((s) => s.levelId)).toEqual(["a1-walk", "a2-read-issue", "a3-read-board"]);
    expect(v.current).toBe("a4-found-site");
  });

  it("a lost stamp comes back from GitHub", async () => {
    const progress = memoryProgress();
    for (const e of ["walked", "card-opened", "card-read", "pallet-moved"] as const) await progress.addEvent(VIEWER, e);
    const taken = issue({ assignees: [VIEWER], status: "In Progress", comments: [{ author: VIEWER, url: "c1" }] });
    const { app } = make(site({ issues: [taken] }), { progress });
    const v = await view(await app.request("/api/levels", {}));
    expect(v.stamps.map((s) => s.levelId)).toEqual(["a1-walk", "a2-read-issue", "a3-read-board", "a4-found-site", "a5-write-issue", "a6-take-issue", "a7-move-issue"]);
    expect(v.rank).toBe("apprentice");
    expect(v.stamps.find((s) => s.levelId === "a6-take-issue")?.proof).toBe("c1");
  });

  it("GET /api/levels never shows another player's stamps", async () => {
    const progress = memoryProgress();
    await progress.stamp("fictif-someone-else", "a1-walk", "tutorial");
    const { app } = make(null, { progress });
    expect((await view(await app.request("/api/levels", {}))).stamps).toEqual([]);
  });
});

describe("starting again", () => {
  it("resets the player's levels on the demo site only", async () => {
    const progress = memoryProgress();
    await progress.stamp(VIEWER, "a1-walk", "tutorial");
    expect((await make(null, { progress }).app.request("/api/levels/reset", post({}))).status).toBe(404);
    const v = await view(await make(null, { progress, mode: "demo" }).app.request("/api/levels/reset", post({})));
    expect(v.stamps).toEqual([]);
    expect(v.canWrite).toBe(false);
  });
});

describe("practice gestures", () => {
  it("refuses a target outside the practice repository", async () => {
    const { app, sent } = make(site());
    const good = prepareIssue(site(), "FICTIF Paint the gate", "");
    for (const repo of ["fictif-volunteer/other-repo", "FICTIF-OTHER/my-first-site"]) {
      const res = await app.request("/api/practice/issue/apply", post({ ...good, repo }));
      expect(res.status).toBe(409);
    }
    expect(sent).toEqual([]);
  });

  it("refuses a prepared gesture that does not match a fresh read", async () => {
    const { app, sent } = make(site());
    const good = prepareIssue(site(), "FICTIF Paint the gate", "");
    const tampered = { ...good, mutations: [{ ...good.mutations[0], input: { ...good.mutations[0].input, repositoryId: "R_someone_else" } }, good.mutations[1]] };
    expect((await app.request("/api/practice/issue/apply", post(tampered))).status).toBe(409);
    expect(sent).toEqual([]);
  });

  it("sends a matching gesture, logs it and answers with the levels", async () => {
    const { app, sent, deps } = make(site());
    const prepared = await (await app.request("/api/practice/issue/prepare", post({ title: "FICTIF Paint the gate", body: "" }))).json();
    const res = await app.request("/api/practice/issue/apply", post(prepared));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect((await deps.log.latest(1))[0]).toMatchObject({ gesture: "issue", playerLogin: VIEWER, result: "applied" });
    expect(((await res.json()) as { levels: LevelsView }).levels.practice.exists).toBe(true);
  });

  it("founding without project scope answers github-scope", async () => {
    const { app } = make(null, { applyPractice: async () => { throw new GitHubScopeError("no project scope"); } });
    const prepared = await (await app.request("/api/practice/found/prepare", post({ visibility: "PUBLIC" }))).json();
    const res = await app.request("/api/practice/found/apply", post(prepared));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "github-scope", hint: "gh auth refresh -s project" });
  });

  it("remembers the founded site's name", async () => {
    const { app, deps } = make(null);
    const prepared = await (await app.request("/api/practice/found/prepare", post({ visibility: "PRIVATE" }))).json();
    expect(prepared).toMatchObject({ kind: "found", name: "my-first-site", visibility: "PRIVATE" });
    await app.request("/api/practice/found/apply", post(prepared));
    expect(await deps.progress.practiceRepo(VIEWER)).toBe("my-first-site");
  });

  it("serves the practice site, and says when it is not founded yet", async () => {
    expect((await make(null).app.request("/api/site?site=practice")).status).toBe(404);
    const board: BoardSnapshot = { ...demo, items: [] };
    const res = await make(site(), { readBoardFor: async () => board }).app.request("/api/site?site=practice");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { site: { zones: { name: string }[] } }).site.zones.map((z) => z.name)).toEqual(["Todo", "In Progress", "Done"]);
  });
});
