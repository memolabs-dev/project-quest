// What the API needs from the outside world, live (GitHub + Postgres) or demo (an invented site, in memory).
import { readFileSync } from "node:fs";
import { loadConfig, type QuestConfig } from "../shared/config.ts";
import type { PreparedMove } from "../shared/gestures/move.ts";
import type { PreparedPractice } from "../shared/gestures/practice.ts";
import type { PreparedAsk } from "../shared/gestures/real.ts";
import type { PreparedTeam } from "../shared/gestures/team.ts";
import type { PreparedTalk } from "../shared/gestures/talk.ts";
import type { PreparedWarm } from "../shared/gestures/warm.ts";
import type { Newcomer } from "../shared/people.ts";
import type { PracticeSnapshot, RealSnapshot } from "../shared/levels/types.ts";
import type { BoardItem, BoardSnapshot } from "../shared/site.ts";
import { memoryActionLog, pgActionLog, type ActionLog } from "./db/log.ts";
import { memoryProgress, pgProgress, type ProgressStore } from "./db/progress.ts";
import { GitHubAuthError, githubGql, githubRest, githubToken, type Gql, type Rest } from "./github/client.ts";
import { applyMove, type ApplyResult } from "./github/move-item.ts";
import { applyPractice, type PracticeResult } from "./github/practice-apply.ts";
import { readBoard } from "./github/read-board.ts";
import { readPractice } from "./github/read-practice.ts";
import { readGoodFirst } from "./github/read-real.ts";
import { readNewcomers } from "./github/read-newcomers.ts";
import { readRepo, type Visit } from "./github/read-repo.ts";
import { readThanked } from "./github/read-thanked.ts";

export interface Deps {
  mode: "live" | "demo";
  /** Why the demo runs instead of the real board, when it does. */
  demoReason?: "asked" | "no-github-access";
  config: QuestConfig;
  /** `people`: also read each issue's last comment, only for the lead who answers (and the demo, which has it anyway). */
  readBoard(o?: { people?: boolean }): Promise<BoardSnapshot>;
  applyMove(p: PreparedMove): Promise<ApplyResult>;
  /** The same, for another board (the player's practice site). */
  readBoardFor(config: QuestConfig): Promise<BoardSnapshot>;
  applyMoveFor(config: QuestConfig, p: PreparedMove): Promise<ApplyResult>;
  log: ActionLog;
  viewer(): Promise<{ login: string; avatarUrl: string }>;
  viewerId(): Promise<string>;
  progress: ProgressStore;
  /** The practice repository's default name (QUEST_PRACTICE_REPO, else my-first-site). */
  practiceName: string;
  readPractice(owner: string, name: string): Promise<PracticeSnapshot | null>;
  applyPractice(p: PreparedPractice): Promise<PracticeResult>;
  /** The configured (real) project's open good first issues. */
  readGoodFirst(number?: number): Promise<RealSnapshot>;
  /** The lead's team site's name (QUEST_TEAM_REPO, else my-first-team). */
  teamName: string;
  /** Today's date on the server, YYYY-MM-DD in UTC: sprints and due dates are judged by it. Tests set it. */
  today?: () => string;
  /** The server's clock in milliseconds: who waits is judged by it. Tests set it. */
  now?: () => number;
  applyTeam(p: PreparedTeam): Promise<PracticeResult>;
  /** Sends a prepared ask (one comment) on the real project. */
  applyAsk(p: PreparedAsk): Promise<PracticeResult>;
  /** Sends a warm gesture (a reaction, its removal, or a thank-you) on the configured project. */
  applyWarm(p: PreparedWarm): Promise<PracticeResult>;
  /** Sends an answer or a welcome (one comment) on the configured project; the result carries the comment's URL. */
  applyTalk(p: PreparedTalk): Promise<PracticeResult>;
  /** Whether the player already left words on this laid pallet (a comment of theirs since it was closed). */
  readThanked(issueNumber: number): Promise<boolean>;
  /** A public repository's recent issues, for a read-only visit (#16). */
  readRepo(nameWithOwner: string): Promise<Visit>;
  /** The open pull requests of first-time authors the player has not written to. */
  readNewcomers(): Promise<Newcomer[]>;
}

const PRACTICE_NAME = process.env.QUEST_PRACTICE_REPO || "my-first-site";
const TEAM_NAME = process.env.QUEST_TEAM_REPO || "my-first-team";

const root = new URL("../../", import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8")) as unknown;

export function liveDeps(config: QuestConfig): Deps {
  let gql: Promise<Gql> | null = null;
  const client = () => (gql ??= githubGql().catch((e) => { gql = null; throw e; }));
  let rest: Promise<Rest> | null = null;
  const restClient = () => (rest ??= githubRest().catch((e) => { rest = null; throw e; }));
  const url = process.env.DATABASE_URL;
  if (!url) console.warn("[project-quest] DATABASE_URL is not set: the action log is kept in memory only");
  return {
    mode: "live",
    config,
    readBoard: async (o) => readBoard(await client(), config, o),
    applyMove: async (p) => applyMove(await client(), config, p),
    readBoardFor: async (c) => readBoard(await client(), c),
    applyMoveFor: async (c, p) => applyMove(await client(), c, p),
    log: url ? pgActionLog(url) : memoryActionLog(),
    viewer: async () =>
      (await (await client())<{ viewer: { login: string; avatarUrl: string } }>("query { viewer { login avatarUrl } }", {})).viewer,
    viewerId: async () => (await (await client())<{ viewer: { id: string } }>("query { viewer { id } }", {})).viewer.id,
    progress: url ? pgProgress(url) : memoryProgress(),
    practiceName: PRACTICE_NAME,
    readPractice: async (owner, name) => readPractice(await client(), owner, name),
    applyPractice: async (p) => applyPractice(await client(), await restClient(), p),
    readGoodFirst: async (n) => readGoodFirst(await client(), config, n),
    applyAsk: async (p) => applyPractice(await client(), await restClient(), p),
    teamName: TEAM_NAME,
    applyTeam: async (p) => applyPractice(await client(), await restClient(), p),
    applyWarm: async (p) => applyPractice(await client(), await restClient(), p),
    applyTalk: async (p) => applyPractice(await client(), await restClient(), p),
    readThanked: async (n) => readThanked(await client(), config, n),
    readRepo: async (n) => readRepo(await client(), n),
    readNewcomers: async () => readNewcomers(await client(), config),
  };
}

/** How long an answered or welcomed demo person stays away: a shared demo, or a video, always finds someone. */
const DEMO_BACK_MS = 120_000;

/** `clock`: the demo's time, for its people coming back (tests set it). */
export function demoDeps(config: QuestConfig, reason: Deps["demoReason"], clock: () => number = Date.now): Deps {
  const board = structuredClone(json("src/shared/demo/demo-board.json")) as BoardSnapshot;
  const noGitHub = async (): Promise<never> => { throw new GitHubAuthError("The demo site has no GitHub access: run `gh auth login`"); };
  // The warm gestures play in memory: the player's reactions on the board, the pallets they thanked with words.
  const thanked = new Set<number>();
  // Two invented newcomers: one whose first pull request closes an open pallet, one linked to no issue. A welcome drops one.
  const allNewcomers: Newcomer[] = [
    {
      login: "fictif-lucas", avatarUrl: "", pallet: null, closes: [13], contributingUrl: null,
      pr: { id: "PR_demo_1", number: 31, title: "FICTIF Light the reading room", url: "https://github.com/fictif-org/demo-site/pull/31" },
    },
    {
      login: "fictif-sana", avatarUrl: "", pallet: null, closes: [], contributingUrl: null,
      pr: { id: "PR_demo_2", number: 32, title: "FICTIF Fix a typo in the readme", url: "https://github.com/fictif-org/demo-site/pull/32" },
    },
  ];
  // Who was answered or welcomed, and when: the waiting comment kept aside, the pull request's number.
  const answered = new Map<number, { at: number; comment: BoardItem["lastComment"] }>();
  const welcomed = new Map<number, number>();
  const comeBack = () => {
    for (const [n, a] of answered) {
      if (clock() - a.at < DEMO_BACK_MS) continue;
      const item = board.items.find((i) => i.number === n);
      if (item) item.lastComment = a.comment;
      answered.delete(n);
    }
    for (const [n, at] of welcomed) if (clock() - at >= DEMO_BACK_MS) welcomed.delete(n);
  };
  return {
    mode: "demo",
    demoReason: reason,
    config,
    readBoard: async () => { comeBack(); return board; },
    applyMove: async (p) => {
      const item = board.items.find((i) => i.itemId === p.itemId);
      if (!item || item.status !== p.from || item.updatedAt !== p.expectedUpdatedAt) {
        const change = !item ? "gone" as const : item.status !== p.from ? "moved" as const : "changed" as const;
        return { ok: false, reason: "stale", current: { status: item?.status ?? null, updatedAt: item?.updatedAt ?? "", change } };
      }
      item.status = p.to;
      item.updatedAt = new Date().toISOString();
      return { ok: true as const, board };
    },
    readBoardFor: noGitHub,
    applyMoveFor: noGitHub,
    log: memoryActionLog(),
    viewer: async () => ({ login: "you", avatarUrl: "" }),
    // A pretend id, so the demo shows exactly what a real gesture would send; nothing is ever sent.
    viewerId: async () => "U_demo",
    progress: memoryProgress(),
    practiceName: PRACTICE_NAME,
    // Without GitHub there is no practice site to read: the tutorial still plays.
    readPractice: async () => null,
    applyPractice: noGitHub,
    applyAsk: noGitHub,
    teamName: TEAM_NAME,
    applyTeam: noGitHub,
    // The demo site's own good first issues, from its invented board.
    readGoodFirst: async (n) => ({
      repo: `${config.owner}/${config.repo}`,
      issues: board.items
        .filter((i) => i.state === "OPEN" && i.labels.some((l) => config.labels.goodFirst.includes(l)) && (n === undefined || i.number === n))
        .map((i) => ({ id: i.issueId, number: i.number, title: i.title, url: i.url, assignees: i.assignees.map((a) => a.login), comments: [] })),
    }),
    applyWarm: async (p) => {
      const item = board.items.find((i) => i.number === p.issueNumber);
      if (!item) return { ok: false, reason: "github", message: `Issue #${p.issueNumber} is not on the demo site`, applied: [] };
      const given = new Set(item.myReactions ?? []);
      for (const m of p.mutations) {
        if (m.name === "addReaction") given.add(String(m.input.content));
        if (m.name === "removeReaction") given.delete(String(m.input.content));
        if (m.name === "addComment") thanked.add(p.issueNumber);
      }
      item.myReactions = [...given];
      return { ok: true };
    },
    readThanked: async (n) => thanked.has(n),
    readRepo: noGitHub,
    readNewcomers: async () => { comeBack(); return allNewcomers.filter((n) => !welcomed.has(n.pr.number)); },
    // An answer clears the pallet's waiting comment, a welcome drops the newcomer, for two minutes: in memory, never a real comment.
    applyTalk: async (p) => {
      if (p.kind === "answer") {
        const item = board.items.find((i) => i.number === p.target.number);
        if (item) {
          answered.set(item.number, { at: clock(), comment: item.lastComment });
          item.lastComment = null;
        }
      } else {
        welcomed.set(p.target.number, clock());
      }
      return { ok: true, url: `https://example.org/FICTIF/comment/${p.target.number}` };
    },
  };
}

/** QUEST_MODE=demo forces the demo; QUEST_MODE=live forces GitHub; unset tries GitHub, then falls back to the demo. */
export async function resolveDeps(): Promise<Deps> {
  const config = loadConfig(json("quest.config.json"));
  const mode = process.env.QUEST_MODE;
  if (mode === "demo") return demoDeps(config, "asked");
  if (mode === "live") return liveDeps(config);
  try {
    await githubToken();
    return liveDeps(config);
  } catch {
    return demoDeps(config, "no-github-access");
  }
}
