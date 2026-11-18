import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/config.ts";
import { levelsOf } from "../shared/levels/index.ts";
import type { Newcomer } from "../shared/people.ts";
import { prepareAnswer, prepareWelcome, type PreparedTalk } from "../shared/gestures/talk.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { createApp } from "./app.ts";
import { memoryActionLog } from "./db/log.ts";
import { memoryProgress } from "./db/progress.ts";
import { demoDeps, type Deps } from "./deps.ts";

// Answer and welcome through the API: lead only, prepared, rebuilt, sent only to the configured project, logged, stamped once.
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const config = loadConfig(read("../../quest.config.json"));
const HOME = `${config.owner}/${config.repo}`;
const NOW = Date.parse("2026-11-18T12:00:00Z");
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const lucas = (): Newcomer => ({
  login: "fictif-lucas", avatarUrl: "", pallet: null, closes: [13], contributingUrl: null,
  pr: { id: "PR_1", number: 31, title: "FICTIF Light the reading room", url: "https://example.org/pull/31" },
});
const waitingBoard = () => {
  const b = structuredClone(read("../shared/demo/demo-board.json")) as BoardSnapshot;
  b.items.find((i) => i.number === 12)!.lastComment = { author: "fictif-maria", association: "NONE", createdAt: "2026-11-16T09:30:00Z", excerpt: "FICTIF can I take this one" };
  return b;
};

function setup(o: { lead?: boolean; board?: BoardSnapshot; newcomers?: Newcomer[] } = {}) {
  const sent: PreparedTalk[] = [];
  const board = o.board ?? waitingBoard();
  const newcomers = o.newcomers ?? [lucas()];
  const d: Deps = {
    ...demoDeps(config, "asked"),
    mode: "live",
    readBoard: async () => board,
    now: () => NOW,
    log: memoryActionLog(),
    viewer: async () => ({ login: "fictif-lead", avatarUrl: "" }),
    progress: memoryProgress(),
    readRepo: async () => { throw new Error("no visit in this test"); },
    readNewcomers: async () => newcomers,
    applyTalk: async (p) => { sent.push(p); return { ok: true, url: `https://example.org/comment/${sent.length}` }; },
  };
  const ready = async () => {
    await d.progress.setPath("fictif-lead", "lead");
    for (const l of levelsOf("lead").filter((x) => x.rank === levelsOf("lead")[0].rank)) await d.progress.stamp("fictif-lead", l.id, "FICTIF proof");
  };
  return { d, sent, board, newcomers, ready, app: createApp(d) };
}
const answer = (b: BoardSnapshot, words = "Yes, it is yours.") => prepareAnswer(b, HOME, 12, words, "fictif-lead", NOW);

describe("answer and welcome through the API", () => {
  it("prepares exactly as the gesture builds it", async () => {
    const t = setup();
    await t.ready();
    const res = await t.app.request("/api/talk/answer/prepare", post({ number: 12, words: " Yes " }));
    expect(await res.json()).toEqual(prepareAnswer(t.board, HOME, 12, "Yes", "fictif-lead", NOW));
    const w = await t.app.request("/api/talk/welcome/prepare", post({ number: 31, words: "Welcome" }));
    expect(await w.json()).toEqual(prepareWelcome([lucas()], HOME, 31, "Welcome"));
  });

  it("an answer is refused when the team spoke meanwhile", async () => {
    const t = setup();
    await t.ready();
    const claim = answer(t.board);
    t.board.items.find((i) => i.number === 12)!.lastComment = { author: "fictif-tom", association: "MEMBER", createdAt: "2026-11-18T11:00:00Z", excerpt: "x" };
    const res = await t.app.request("/api/talk/answer/apply", post(claim));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain("Nobody waits");
    expect(t.sent).toHaveLength(0);
  });

  it("a welcome is refused once the newcomer was welcomed", async () => {
    const t = setup();
    await t.ready();
    const claim = prepareWelcome(t.newcomers, HOME, 31, "Welcome");
    t.newcomers.length = 0;
    const res = await t.app.request("/api/talk/welcome/apply", post(claim));
    expect(res.status).toBe(400);
    expect(t.sent).toHaveLength(0);
  });

  it("a volunteer cannot answer or welcome, even through the API", async () => {
    const t = setup();
    await t.d.progress.setPath("fictif-lead", "volunteer");
    const a = await t.app.request("/api/talk/answer/apply", post(answer(t.board)));
    const w = await t.app.request("/api/talk/welcome/apply", post(prepareWelcome(t.newcomers, HOME, 31, "Hi")));
    const p = await t.app.request("/api/talk/answer/prepare", post({ number: 12, words: "Hi" }));
    expect([a.status, w.status, p.status]).toEqual([403, 403, 403]);
    // a lead path without the lead rank is refused too
    await t.d.progress.setPath("fictif-lead", "lead");
    expect((await t.app.request("/api/talk/answer/apply", post(answer(t.board)))).status).toBe(403);
    expect(t.sent).toHaveLength(0);
  });

  it("a tampered claim is refused and nothing is sent", async () => {
    const t = setup();
    await t.ready();
    const claim = answer(t.board);
    const forged = { ...claim, mutations: [{ name: "addComment", input: { subjectId: "I_other", body: "Buy now" } }] };
    expect((await t.app.request("/api/talk/answer/apply", post(forged))).status).toBe(409);
    const elsewhere = { ...claim, repo: "someone/else" };
    expect((await t.app.request("/api/talk/answer/apply", post(elsewhere))).status).toBe(409);
    expect(t.sent).toHaveLength(0);
  });

  it("the first answer stamps talk-answer, the second does not, and both are logged", async () => {
    const t = setup();
    await t.ready();
    const a = await t.app.request("/api/talk/answer/apply", post(answer(t.board)));
    expect(await a.json()).toMatchObject({ ok: true, url: "https://example.org/comment/1" });
    // a second waiting issue
    const other = t.board.items.find((i) => i.number === 13)!;
    other.lastComment = { author: "fictif-sana", association: "NONE", createdAt: "2026-11-15T09:30:00Z", excerpt: "x" };
    await t.app.request("/api/talk/answer/apply", post(prepareAnswer(t.board, HOME, 13, "Soon.", "fictif-lead", NOW)));
    const stamps = (await t.d.progress.stamps("fictif-lead")).filter((s) => s.levelId === "talk-answer");
    expect(stamps).toHaveLength(1);
    expect(stamps[0].proof).toBe("https://example.org/comment/1");
    const log = await t.d.log.latest(2);
    expect(log.map((l) => l.gesture)).toEqual(["answer", "answer"]);
    expect(log[1]).toMatchObject({ playerLogin: "fictif-lead", target: `${HOME}#12`, result: "applied" });
    expect(t.sent).toHaveLength(2);
  });

  it("the first welcome stamps talk-welcome", async () => {
    const t = setup();
    await t.ready();
    await t.app.request("/api/talk/welcome/apply", post(prepareWelcome(t.newcomers, HOME, 31, "Welcome")));
    expect((await t.d.progress.stamps("fictif-lead")).find((s) => s.levelId === "talk-welcome")?.proof).toBe("https://example.org/comment/1");
  });

  it("the demo answers and sends nothing", async () => {
    const real = setup();
    const demo = demoDeps(config, "asked");
    const app = createApp(real.d, demo);
    const prep = await app.request("/api/talk/answer/prepare?demo=1", post({ number: 12, words: "Yes" }));
    expect(prep.status).toBe(200);
    const res = await app.request("/api/talk/answer/apply?demo=1", post(await prep.json()));
    const body = (await res.json()) as { ok: boolean; url: string };
    expect(body.ok).toBe(true);
    expect(body.url).toContain("FICTIF");
    expect(real.sent).toHaveLength(0);
    expect((await demo.readBoard()).items.find((i) => i.number === 12)!.lastComment).toBeNull();
    const w = await app.request("/api/talk/welcome/apply?demo=1", post(prepareWelcome(await demo.readNewcomers(), HOME, 31, "Welcome")));
    expect(((await w.json()) as { url: string }).url).toContain("FICTIF");
    expect((await demo.readNewcomers()).map((n) => n.pr.number)).toEqual([32]);
    expect(await real.d.progress.stamps("fictif-lead")).toHaveLength(0);
  });
});
