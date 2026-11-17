import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LevelsView } from "../shared/api.ts";
import { loadConfig } from "../shared/config.ts";
import { prepareIssue, type PreparedPractice } from "../shared/gestures/practice.ts";
import type { PracticeIssue, PracticeSnapshot } from "../shared/levels/types.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { createApp } from "./app.ts";
import { observe } from "./levels.ts";
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
  issues: [], defaultBranch: null, readme: null, branches: [], pulls: [], plan: null, mainHistory: [], ...o,
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
    readGoodFirst: async () => ({ repo: "fictif-org/fictif-site", issues: [] }),
    applyAsk: async (p) => { sent.push(p as never); return { ok: true }; },
    teamName: "my-first-team",
    applyTeam: async (p) => { sent.push(p as never); return { ok: true }; },
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
    expect(v.unlocks).toEqual({ helmet: true, skillBook: true, ownSite: false, trowel: false, firstBuilding: false, van: false, realProjects: false });
    expect(v.practice).toEqual({
      name: "my-first-site", exists: false, readme: null, issue: null, pull: null,
      unassigned: null, defaultBranch: null, workBranch: null, mainMoved: false,
    });
    expect(v.team).toEqual({ exists: false, parcels: false, labels: [] });
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

describe("asking for a good first issue", () => {
  const good = { repo: "memolabs-dev/project-quest-sandbox", issues: [{ id: "I_21", number: 21, title: "FICTIF fountain", url: "u21", assignees: [], comments: [] }] };

  it("sends an ask the server rebuilt and logs it", async () => {
    const { app, sent, deps } = make(null, { readGoodFirst: async () => good });
    const ask = await (await app.request("/api/real/ask/prepare", post({ issueNumber: 21, comment: "I'd like this one." }))).json();
    expect((await app.request("/api/real/ask/apply", post(ask))).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect((await deps.log.latest(1))[0]).toMatchObject({ gesture: "ask", target: "memolabs-dev/project-quest-sandbox#21", result: "applied" });
  });

  it("refuses an ask outside the configured project, or from a page marked demo", async () => {
    const { app, sent } = make(null, { readGoodFirst: async () => good });
    const ask = (await (await app.request("/api/real/ask/prepare", post({ issueNumber: 21, comment: "mine?" }))).json()) as Record<string, unknown>;
    expect((await app.request("/api/real/ask/apply", post({ ...ask, repo: "dataforgoodfr/real-repo" }))).status).toBe(409);
    expect((await app.request("/api/real/ask/apply?demo=1", post(ask))).status).toBe(409);
    expect(sent).toEqual([]);
  });

  it("refuses a crafted ask: another node, an extra mutation, an edited comment", async () => {
    const { app, sent } = make(null, { readGoodFirst: async () => good });
    const ask = (await (await app.request("/api/real/ask/prepare", post({ issueNumber: 21, comment: "mine?" }))).json()) as {
      mutations: { name: string; input: Record<string, unknown> }[]; comment: string;
    };
    const m = ask.mutations[0];
    for (const claim of [
      { ...ask, mutations: [{ ...m, input: { ...m.input, subjectId: "I_someone_else" } }] },
      { ...ask, mutations: [m, { name: "addAssigneesToAssignable", input: { assignableId: "I_21", assigneeIds: ["U"] } }] },
      { ...ask, comment: "something else" },
    ]) {
      expect((await app.request("/api/real/ask/apply", post(claim))).status).toBe(409);
    }
    expect(sent).toEqual([]);
  });

  it("refuses an ask on an issue closed or unlabelled between prepare and apply", async () => {
    let reads = 0;
    const { app, sent } = make(null, { readGoodFirst: async () => (++reads === 1 ? good : { ...good, issues: [] }) });
    const ask = await (await app.request("/api/real/ask/prepare", post({ issueNumber: 21, comment: "mine?" }))).json();
    expect((await app.request("/api/real/ask/apply", post(ask))).status).toBe(400);
    expect(sent).toEqual([]);
  });

  it("asks the project for the one issue, so its age never hides it", async () => {
    const asked: (number | undefined)[] = [];
    const { app } = make(null, { readGoodFirst: async (n?: number) => { asked.push(n); return good; } });
    await app.request("/api/real/ask/prepare", post({ issueNumber: 21, comment: "mine?" }));
    expect(asked).toContain(21);
  });

  it("never assigns: the only thing an ask sends is a comment", async () => {
    const { app } = make(null, { readGoodFirst: async () => good });
    const ask = (await (await app.request("/api/real/ask/prepare", post({ issueNumber: 21, comment: "mine?" }))).json()) as { mutations: { name: string }[] };
    expect(ask.mutations.map((m) => m.name)).toEqual(["addComment"]);
  });
});

describe("the team site", () => {
  const team = site({ repo: { id: "R_team", nameWithOwner: "fictif-volunteer/my-first-team", url: "r" } });
  const reading = (snapshot: PracticeSnapshot | null) => async (_owner: string, name: string) => (name === "my-first-team" ? snapshot : null);

  it("sends a lead gesture the server rebuilt and logs it", async () => {
    const { app, sent, deps } = make(null, { readPractice: reading(null) });
    const found = await (await app.request("/api/team/team-found/prepare", post({ visibility: "PRIVATE" }))).json();
    expect((await app.request("/api/team/team-found/apply", post(found))).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect((await deps.log.latest(1))[0]).toMatchObject({ gesture: "team-found", target: "fictif-volunteer/my-first-team", result: "applied" });
  });

  it("refuses a team site that is the volunteer's practice site", async () => {
    const { app, sent } = make(null, { readPractice: reading(null), teamName: "my-first-site" });
    expect((await app.request("/api/team/team-found/prepare", post({ visibility: "PRIVATE" }))).status).toBe(400);
    expect(sent).toEqual([]);
  });

  it("refuses a lead gesture outside the team site", async () => {
    const { app, sent } = make(null, { readPractice: reading(team) });
    const parcels = (await (await app.request("/api/team/parcels/prepare", post({}))).json()) as Record<string, unknown>;
    for (const repo of ["fictif-volunteer/my-first-site", "FICTIF-OTHER/my-first-team"]) {
      expect((await app.request("/api/team/parcels/apply", post({ ...parcels, repo }))).status).toBe(409);
    }
    expect(sent).toEqual([]);
  });

  it("refuses a lead gesture that does not match a fresh read, or from a page marked demo", async () => {
    const { app, sent } = make(null, { readPractice: reading(team) });
    const parcels = (await (await app.request("/api/team/parcels/prepare", post({}))).json()) as { mutations: unknown[] };
    expect((await app.request("/api/team/parcels/apply", post({ ...parcels, mutations: parcels.mutations.slice(0, 2) }))).status).toBe(409);
    expect((await app.request("/api/team/parcels/apply?demo=1", post(parcels))).status).toBe(409);
    expect(sent).toEqual([]);
  });
});

describe("paths", () => {
  it("choosing a path is remembered, and the volunteer's stamps stay", async () => {
    const progress = memoryProgress();
    for (const e of ["walked", "card-opened"] as const) await progress.addEvent(VIEWER, e);
    const { app } = make(null, { progress });
    expect((await view(await app.request("/api/levels", {}))).path).toBeNull();
    const v = await view(await app.request("/api/levels/path", post({ path: "lead" })));
    expect(v.path).toBe("lead");
    expect(v.stamps.map((s) => s.levelId)).toContain("a1-walk");
    expect(v.ranks.volunteer).toBeNull();
    expect(await progress.path(VIEWER)).toBe("lead");
  });
  it("refuses an unknown path", async () => {
    expect((await make(null).app.request("/api/levels/path", post({ path: "pirate" }))).status).toBe(400);
  });
});

describe("the sprint's capacity", () => {
  it("the capacity is refused outside 1 to 100", async () => {
    const { app, deps } = make(null);
    for (const points of [0, 101, 2.5, "8"]) {
      expect((await app.request("/api/levels/capacity", post({ points }))).status, String(points)).toBe(400);
    }
    expect((await app.request("/api/levels/capacity", post({ points: 8 }))).status).toBe(200);
    expect(await deps.progress.capacity(VIEWER)).toBe(8);
  });
  it("is observed with the server's date for a lead", async () => {
    const progress = memoryProgress();
    await progress.setPath(VIEWER, "lead");
    await progress.setCapacity(VIEWER, 5);
    const { deps } = make(null, { progress, today: () => "2026-11-17" });
    const o = await observe(deps, VIEWER);
    expect(o).toMatchObject({ capacity: 5, today: "2026-11-17" });
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

  it("logs a gesture that failed half-way, with what was already done", async () => {
    const { app, deps } = make(null, { applyPractice: async () => ({ ok: false, reason: "github", message: "no project scope", applied: ["createRepository"] }) });
    const prepared = await (await app.request("/api/practice/found/prepare", post({ visibility: "PUBLIC" }))).json();
    const r = await (await app.request("/api/practice/found/apply", post(prepared))).json();
    expect(r).toMatchObject({ ok: false, applied: ["createRepository"] });
    expect((await deps.log.latest(1))[0]).toMatchObject({ gesture: "found", result: "failed" });
  });

  it("logs a gesture GitHub refused before anything was done", async () => {
    const { app, deps } = make(null, { applyPractice: async () => { throw new GitHubScopeError("no project scope"); } });
    const prepared = await (await app.request("/api/practice/found/prepare", post({ visibility: "PUBLIC" }))).json();
    expect((await app.request("/api/practice/found/apply", post(prepared))).status).toBe(503);
    expect((await deps.log.latest(1))[0]).toMatchObject({ gesture: "found", result: "failed" });
  });

  it("never sends from a page marked demo", async () => {
    const { app, sent } = make(site());
    const prepared = prepareIssue(site(), "FICTIF Paint the gate", "");
    expect((await app.request("/api/practice/issue/apply?demo=1", post(prepared))).status).toBe(409);
    expect(sent).toEqual([]);
  });

  it("answers a claim without its target with a refusal, not a crash", async () => {
    const { app } = make(site());
    const { repo: _, ...claim } = prepareIssue(site(), "FICTIF Paint the gate", "");
    expect((await app.request("/api/practice/issue/apply", post(claim))).status).toBe(400);
  });

  it("moves only on the practice board it read, never another project with the same number", async () => {
    const other: BoardSnapshot = { ...demo, projectId: "PVT_someone_else", items: [] };
    const { app } = make(site(), { readBoardFor: async () => other });
    const res = await app.request("/api/practice/moves/prepare", post({ itemId: "x", toZone: "Done" }));
    expect(res.status).toBe(409);
  });

  it("moves an issue on the practice board, through its own route", async () => {
    const item = { ...demo.items[0], itemId: "PVTI_fictif_1", number: 1, status: "Todo", state: "OPEN" as const, isEpic: false, parent: null };
    const board: BoardSnapshot = {
      ...demo, projectId: "PVT_fictif", items: [item],
      statusOptions: [{ id: "o1", name: "Todo" }, { id: "o2", name: "In Progress" }, { id: "o3", name: "Done" }],
    };
    const moved: unknown[] = [];
    const { app } = make(site(), { readBoardFor: async () => board, applyMoveFor: async (_c, m) => { moved.push(m); return { ok: true, board }; } });
    const prepared = await (await app.request("/api/practice/moves/prepare", post({ itemId: "PVTI_fictif_1", toZone: "In Progress" }))).json();
    const res = await app.request("/api/practice/moves/apply", post(prepared));
    expect(res.status).toBe(200);
    expect(moved).toHaveLength(1);
  });

  it("refuses an edit, a pull request or a merge outside the practice repository", async () => {
    const mine = issue({ assignees: [VIEWER] });
    const ready = site({
      issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" },
      branches: [{ name: "practice-1", oid: "b1", author: VIEWER, url: "c", readme: null, viaWeb: true, history: [] }],
    });
    const { app, sent } = make(ready);
    const edit = (await (await app.request("/api/practice/edit/prepare", post({ issueNumber: 1, content: "x", message: "m" }))).json()) as Record<string, unknown>;
    const pull = (await (await app.request("/api/practice/pull/prepare", post({ issueNumber: 1, title: "t", why: "w" }))).json()) as Record<string, unknown>;
    for (const claim of [edit, pull]) {
      expect((await app.request(`/api/practice/${String(claim.kind)}/apply`, post({ ...claim, repo: "fictif-volunteer/other-repo" }))).status).toBe(409);
    }
    const merge = { kind: "merge", repo: "FICTIF-OTHER/my-first-site", pullNumber: 2, mutations: [] };
    expect((await app.request("/api/practice/merge/apply", post(merge))).status).toBe(409);
    expect(sent).toEqual([]);
  });

  it("sends an edit the server rebuilt", async () => {
    const mine = issue({ assignees: [VIEWER] });
    const { app, sent } = make(site({ issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" } }));
    const edit = await (await app.request("/api/practice/edit/prepare", post({ issueNumber: 1, content: "# my-first-site\n", message: "Paint" }))).json();
    expect((await app.request("/api/practice/edit/apply", post(edit))).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("waits for GitHub to link a new pull request to its issue before answering", async () => {
    const progress = memoryProgress();
    for (const e of ["walked", "card-opened", "card-read", "pallet-moved"] as const) await progress.addEvent(VIEWER, e);
    const mine = issue({ assignees: [VIEWER], status: "In Progress", comments: [{ author: VIEWER, url: "c1" }] });
    const branched = site({ issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" }, branches: [{ name: "practice-1", oid: "b1", author: VIEWER, url: "cb1", readme: null, viaWeb: true, history: [] }] });
    const pull = { id: "PR_2", number: 2, url: "p2", author: VIEWER, state: "OPEN" as const, createdAt: "2026-11-17T10:00:00Z", headRefName: "practice-1", headRefOid: "b1", commits: [], closesElsewhere: [] };
    let reads = 0;
    // GitHub computes "Closes #1" a moment after the pull request exists.
    const readPractice = async () => {
      reads += 1;
      if (reads <= 2) return branched;
      return { ...branched, pulls: [{ ...pull, closes: reads >= 4 ? [1] : [] }] };
    };
    const app = createApp({ ...make(branched, { progress }).deps, readPractice }, undefined, { settleMs: 1 });
    const prepared = await (await app.request("/api/practice/pull/prepare", post({ issueNumber: 1, title: "t", why: "w" }))).json();
    const r = (await (await app.request("/api/practice/pull/apply", post(prepared))).json()) as { levels: LevelsView };
    expect(r.levels.stamps.map((s) => s.levelId)).toContain("a9-open-pull");
  });

  it("prefills the inspector's fix from the branch's README, not main's", async () => {
    const mine = issue({ assignees: [VIEWER] });
    const branched = site({
      issues: [mine], defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" }, readme: "# main\n",
      branches: [{ name: "practice-1", oid: "b1", author: VIEWER, url: "c", readme: "# my first edit\n", viaWeb: true, history: [] }],
    });
    const v = await view(await make(branched).app.request("/api/levels", {}));
    expect(v.practice.readme).toBe("# my first edit\n");
  });

  it("sends the mayor's change the server rebuilt", async () => {
    const { app, sent } = make(site({ defaultBranch: { name: "main", oid: "a1", committedDate: "2026-11-17T08:00:00Z" } }));
    const mayor = (await (await app.request("/api/practice/mayor/prepare", post({}))).json()) as Record<string, unknown>;
    expect((await app.request("/api/practice/mayor/apply", post(mayor))).status).toBe(200);
    expect((await app.request("/api/practice/mayor/apply", post({ ...mayor, repo: "fictif-org/real-repo" }))).status).toBe(409);
    expect(sent).toHaveLength(1);
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
    const board: BoardSnapshot = { ...demo, projectId: "PVT_fictif", items: [] };
    const res = await make(site(), { readBoardFor: async () => board }).app.request("/api/site?site=practice");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { site: { zones: { name: string }[] } }).site.zones.map((z) => z.name)).toEqual(["Todo", "In Progress", "Done"]);
  });
});
