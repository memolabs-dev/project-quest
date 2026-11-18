import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/config.ts";
import { prepareCheer, type PreparedWarm } from "../shared/gestures/warm.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { createApp } from "./app.ts";
import { memoryActionLog } from "./db/log.ts";
import { memoryProgress } from "./db/progress.ts";
import { demoDeps, type Deps } from "./deps.ts";

// The warm gestures through the API: prepared, rebuilt, sent only to the configured project, logged, stamped once.
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const config = loadConfig(read("../../quest.config.json"));
const HOME = `${config.owner}/${config.repo}`;
const fresh = () => structuredClone(read("../shared/demo/demo-board.json")) as BoardSnapshot;
const open = fresh().items.find((i) => i.state === "OPEN" && !i.isEpic)!;
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

const live = (sent: PreparedWarm[], board = fresh()): Deps => ({
  ...demoDeps(config, "asked"),
  mode: "live",
  readBoard: async () => board,
  log: memoryActionLog(),
  viewer: async () => ({ login: "fictif-lead", avatarUrl: "" }),
  progress: memoryProgress(),
  applyWarm: async (p) => {
    sent.push(p);
    const i = board.items.find((x) => x.number === p.issueNumber)!;
    i.myReactions = [...(i.myReactions ?? []), p.content];
    return { ok: true };
  },
  readThanked: async () => false,
  readRepo: async () => { throw new Error("no visit in this test"); },
});

describe("warm gestures through the API", () => {
  it("prepares a cheer exactly as the gesture builds it", async () => {
    const res = await createApp(live([])).request("/api/warm/cheer/prepare", post({ issueNumber: open.number, content: "HOORAY" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(prepareCheer(fresh(), HOME, open.number, "HOORAY"));
  });

  it("a warm gesture goes only to the configured project", async () => {
    const sent: PreparedWarm[] = [];
    const claim = { ...prepareCheer(fresh(), HOME, open.number, "HOORAY"), repo: "someone/else" };
    const res = await createApp(live(sent)).request("/api/warm/cheer/apply", post(claim));
    expect(res.status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it("a stale claim is refused and nothing is sent", async () => {
    const sent: PreparedWarm[] = [];
    const board = fresh();
    const claim = prepareCheer(board, HOME, open.number, "HOORAY");
    board.items.find((i) => i.number === open.number)!.myReactions = ["HOORAY"];
    const res = await createApp(live(sent, board)).request("/api/warm/cheer/apply", post(claim));
    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("the first cheer stamps warm-cheer, the second does not, and both are logged", async () => {
    const sent: PreparedWarm[] = [];
    const d = live(sent);
    const app = createApp(d);
    const a = await app.request("/api/warm/cheer/apply", post(prepareCheer(fresh(), HOME, open.number, "HOORAY")));
    expect(await a.json()).toMatchObject({ ok: true });
    const other = fresh().items.find((i) => i.state === "OPEN" && !i.isEpic && i.number !== open.number)!;
    await app.request("/api/warm/cheer/apply", post(prepareCheer(fresh(), HOME, other.number, "HEART")));
    const stamps = await d.progress.stamps("fictif-lead");
    expect(stamps.filter((s) => s.levelId === "warm-cheer")).toHaveLength(1);
    expect(stamps.find((s) => s.levelId === "warm-cheer")!.proof).toBe(open.url);
    const log = await d.log.latest(2);
    expect(log.map((l) => l.gesture)).toEqual(["cheer", "cheer"]);
    expect(log[1]).toMatchObject({ playerLogin: "fictif-lead", target: `${HOME}#${open.number}`, result: "applied" });
  });

  it("the demo site keeps the reaction and sends nothing", async () => {
    const demo = demoDeps(config, "asked");
    const app = createApp(demo);
    const res = await app.request("/api/warm/cheer/apply", post(prepareCheer(await demo.readBoard(), HOME, open.number, "ROCKET")));
    const body = (await res.json()) as { ok: boolean; site: { pallets: { number: number; myReactions: string[] }[] } };
    expect(body.ok).toBe(true);
    expect(body.site.pallets.find((p) => p.number === open.number)!.myReactions).toEqual(["ROCKET"]);
    expect(await demo.progress.stamps("you")).toEqual([]);
  });
});
