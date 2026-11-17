import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/config.ts";
import { prepareMove, type PreparedMove } from "../shared/gestures/move.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { createApp } from "./app.ts";
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
  ...extra,
});
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

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
      { ok: false, reason: "stale", current: { status: "Done", updatedAt: "x" } },
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
