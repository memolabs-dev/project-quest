import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/config.ts";
import { prepareMove, type PreparedMove } from "../shared/gestures/move.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { createApp } from "./app.ts";
import { createVisitApp, readBudget, visitCache } from "./visit-app.ts";
import { RepoNotPublicError, repoToVisit } from "./github/read-repo.ts";
import { memoryActionLog } from "./db/log.ts";
import { memoryProgress } from "./db/progress.ts";
import type { Deps } from "./deps.ts";
import { GitHubAuthError } from "./github/client.ts";
import type { ApplyResult } from "./github/move-item.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const config = loadConfig(read("../../quest.config.json"));
const demo = read("../shared/demo/demo-board.json") as BoardSnapshot;
const item = demo.items.find((i) => i.status === "Backlog" && !i.isEpic && i.state === "OPEN")!;

const deps = (apply: (p: PreparedMove) => Promise<ApplyResult>, extra: Partial<Deps> = {}): Deps => ({
  mode: "live",
  config,
  readBoard: async () => demo,
  applyMove: apply,
  readBoardFor: async () => demo,
  applyMoveFor: (_config, p) => apply(p),
  log: memoryActionLog(),
  viewer: async () => ({ login: "fictif-lead", avatarUrl: "https://example.org/a.png" }),
  viewerId: async () => "U_fictif_lead",
  progress: memoryProgress(),
  practiceName: "my-first-site",
  readPractice: async () => null,
  applyPractice: async () => ({ ok: true }),
  readGoodFirst: async () => ({ repo: "fictif-org/fictif-site", issues: [] }),
  applyAsk: async () => ({ ok: true }),
  teamName: "my-first-team",
  applyTeam: async () => ({ ok: true }),
  applyWarm: async () => ({ ok: true }),
  readThanked: async () => false,
  readRepo: async () => visitOf(false),
  ...extra,
});
const visitOf = (isPrivate: boolean) => repoToVisit({
  repository: {
    isPrivate, nameWithOwner: "fictif-org/fictif-site", url: "https://github.com/fictif-org/fictif-site", stargazerCount: 7,
    issues: { nodes: [{
      id: "I_1", number: 1, title: "FICTIF issue", url: "https://github.com/fictif-org/fictif-site/issues/1", state: "OPEN", stateReason: null,
      updatedAt: "2026-11-18T10:00:00Z", issueType: null, parent: null, subIssuesSummary: { total: 0 }, labels: { nodes: [] },
      assignees: { nodes: [] }, closedByPullRequestsReferences: { totalCount: 0 },
    }] },
  },
}, "2026-11-18T10:00:00Z");
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("a visit (#16)", () => {
  it("serves a public repository's site, with no viewer and nothing to write", async () => {
    const res = await createApp(deps(async () => ({ ok: true, board: demo }))).request("/api/visit?repo=fictif-org/fictif-site");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { site: { pallets: { zone: string }[] }; repo: { stars: number } };
    expect(body.repo.stars).toBe(7);
    expect(body.site.pallets.map((p) => p.zone)).toEqual(["Backlog"]);
    expect(body).not.toHaveProperty("viewer");
  });

  it("refuses a malformed name without asking GitHub, and a private repository with the same answer as a missing one", async () => {
    let asked = 0;
    const malformed = await createApp(deps(async () => ({ ok: true, board: demo }), { readRepo: async () => { asked++; return visitOf(false); } }))
      .request("/api/visit?repo=not-a-repo");
    expect(malformed.status).toBe(400);
    expect(asked).toBe(0);
    const hidden = await createApp(deps(async () => ({ ok: true, board: demo }), { readRepo: async () => visitOf(true) }))
      .request("/api/visit?repo=fictif-org/secret");
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({ error: "not-public" });
  });

  it("asks GitHub once per repository within ten minutes, whatever the case, and again after", async () => {
    let t = 0;
    const asked: string[] = [];
    const cache = visitCache(async (r) => { asked.push(r); return visitOf(false); }, { now: () => t });
    await cache.read("Fictif-Org/Fictif-Site");
    await cache.read("fictif-org/fictif-site");
    t = 10 * 60_000;
    await cache.read("fictif-org/fictif-site");
    expect(asked).toEqual(["Fictif-Org/Fictif-Site", "fictif-org/fictif-site"]);
  });

  it("forgets a failed read, and keeps at most `max` repositories", async () => {
    let fail = true;
    const asked: string[] = [];
    const cache = visitCache(async (r) => { asked.push(r); if (fail) throw new Error("GitHub down"); return visitOf(false); }, { max: 2 });
    await expect(cache.read("a/one")).rejects.toThrow("GitHub down");
    fail = false;
    await cache.read("a/one");
    await cache.read("a/two");
    await cache.read("a/three");
    await cache.read("a/one");
    expect(asked).toEqual(["a/one", "a/one", "a/two", "a/three", "a/one"]);
  });

  it("asks GitHub at most `perHour` times in the last hour, then again as the hour slides", () => {
    let t = 0;
    const budget = readBudget(2, () => t);
    expect([budget.take(), budget.take(), budget.take()]).toEqual([true, true, false]);
    t = 60 * 60_000;
    expect(budget.take()).toBe(true);
  });

  it("answers 429 once the hour's reads are spent, while cached visits still answer", async () => {
    const app = createVisitApp(async () => visitOf(false), { readsPerHour: 1 });
    expect((await app.request("/api/visit?repo=fictif-org/one")).status).toBe(200);
    expect((await app.request("/api/visit?repo=fictif-org/one")).status).toBe(200);
    const busy = await app.request("/api/visit?repo=fictif-org/two");
    expect(busy.status).toBe(429);
    expect(await busy.json()).toMatchObject({ error: "busy" });
  });

  it("keeps a 'not public' answer, so asking for missing repositories again spends no read", async () => {
    let asked = 0;
    const app = createVisitApp(async () => { asked++; throw new RepoNotPublicError("no"); }, { readsPerHour: 1 });
    for (let i = 0; i < 3; i++) expect((await app.request("/api/visit?repo=fictif-org/missing")).status).toBe(404);
    expect(asked).toBe(1);
  });

  it("answers 'later' when GitHub refuses or does not answer, never a login hint", async () => {
    for (const err of [new GitHubAuthError("403"), Object.assign(new Error("slow"), { name: "TimeoutError" })]) {
      const res = await createVisitApp(async () => { throw err; }).request("/api/visit?repo=fictif-org/one");
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "busy", message: expect.any(String) });
    }
  });

  it("has no route but the visit: the public server can write nothing", async () => {
    const app = createVisitApp(async () => visitOf(false));
    for (const [method, path] of [["GET", "/api/site"], ["POST", "/api/moves/apply"], ["POST", "/api/warm/cheer/apply"], ["GET", "/api/levels"], ["GET", "/api/log"]]) {
      expect((await app.request(path, { method })).status).toBe(404);
    }
  });
});

describe("API", () => {
  it("serves the site with its zones in order", async () => {
    const res = await createApp(deps(async () => ({ ok: true, board: demo }))).request("/api/site");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { site: { zones: { name: string }[] }; mode: string; viewer: { login: string } };
    expect(body.site.zones.map((z) => z.name)).toEqual(config.zones);
    expect(body).toMatchObject({ mode: "live", viewer: { login: "fictif-lead" } });
  });

  it("prepares a move, and rejects a request without a target zone", async () => {
    const app = createApp(deps(async () => ({ ok: true, board: demo })));
    const ok = await app.request("/api/moves/prepare", post({ itemId: item.itemId, toZone: "Ready" }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(prepareMove(demo, item.itemId, "Ready"));
    const bad = await app.request("/api/moves/prepare", post({ itemId: item.itemId }));
    expect(bad.status).toBe(400);
  });

  it("refuses a tampered move without sending anything (target, field or value changed)", async () => {
    const sent: PreparedMove[] = [];
    const app = createApp(deps(async (p) => { sent.push(p); return { ok: true, board: demo }; }));
    const prepared = prepareMove(demo, item.itemId, "Ready");
    for (const input of [
      { ...prepared.mutation.input, projectId: "PVT_someone_else" },
      { ...prepared.mutation.input, itemId: "PVTI_other" },
      { ...prepared.mutation.input, fieldId: "PVTF_title" },
      { ...prepared.mutation.input, value: { text: "pwned" } },
    ]) {
      const res = await app.request("/api/moves/apply", post({ ...prepared, mutation: { ...prepared.mutation, input } }));
      expect(res.status).toBe(409);
    }
    expect(sent).toEqual([]);
  });

  it("sends the server's own rebuilt move and logs the server's target", async () => {
    const sent: PreparedMove[] = [];
    const d = deps(async (p) => { sent.push(p); return { ok: true, board: demo }; });
    const prepared = prepareMove(demo, item.itemId, "Ready");
    await createApp(d).request("/api/moves/apply", post({ ...prepared, issueNumber: 999999, issueTitle: "lie" }));
    expect(sent[0]).toEqual(prepared);
    expect((await d.log.latest(1))[0].target).toBe(`#${item.number}`);
  });

  it("still answers ok and logs when the site cannot be rebuilt after a successful write", async () => {
    const d = deps(async () => ({ ok: true, board: null }));
    const res = await createApp(d).request("/api/moves/apply", post(prepareMove(demo, item.itemId, "Ready")));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, site: null });
    expect((await d.log.latest(1))[0].result).toBe("applied");
  });

  it("does not fail the move when the log cannot be written", async () => {
    const d = deps(async () => ({ ok: true, board: demo }));
    d.log = { record: async () => { throw new Error("postgres down"); }, latest: async () => [] };
    const res = await createApp(d).request("/api/moves/apply", post(prepareMove(demo, item.itemId, "Ready")));
    expect(res.status).toBe(200);
  });

  it("logs every outcome of an applied move", async () => {
    const outcomes: ApplyResult[] = [
      { ok: true, board: demo },
      { ok: false, reason: "stale", current: { status: "Done", updatedAt: "x", change: "moved" } },
      { ok: false, reason: "github", message: "nope" },
    ];
    const d = deps(async () => outcomes.shift()!);
    const app = createApp(d);
    const prepared = prepareMove(demo, item.itemId, "Ready");
    for (let i = 0; i < 3; i++) await app.request("/api/moves/apply", post(prepared));
    const log = await d.log.latest(3);
    expect(log.map((l) => l.result)).toEqual(["failed", "stale", "applied"]);
    expect(log[2]).toMatchObject({ playerLogin: "fictif-lead", gesture: "move", target: `#${item.number}`, payload: prepared.mutation });
  });

  it("explains missing GitHub access instead of failing blankly", async () => {
    const app = createApp(deps(async () => ({ ok: true, board: demo }), {
      readBoard: async () => { throw new GitHubAuthError("No GitHub access"); },
    }));
    const res = await app.request("/api/site");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "github-auth", hint: "gh auth login" });
  });

  it("serves the demo site on ?demo=1, even when the live board is unreachable", async () => {
    const live = deps(async () => ({ ok: true, board: demo }), { readBoard: async () => { throw new GitHubAuthError("No GitHub access"); } });
    const app = createApp(live, deps(async () => ({ ok: true, board: demo }), { mode: "demo", demoReason: "asked" }));
    const res = await app.request("/api/site?demo=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "demo" });
  });

  it("returns the action log", async () => {
    const d = deps(async () => ({ ok: true, board: demo }));
    await d.log.record({ playerLogin: "fictif-lead", gesture: "move", target: "#1", payload: {}, result: "applied" });
    const res = await createApp(d).request("/api/log");
    expect(((await res.json()) as unknown[]).length).toBe(1);
  });
});
