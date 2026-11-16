// What the API needs from the outside world, live (GitHub + Postgres) or demo (an invented site, in memory).
import { readFileSync } from "node:fs";
import { loadConfig, type QuestConfig } from "../shared/config.ts";
import type { PreparedMove } from "../shared/gestures/move.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { memoryActionLog, pgActionLog, type ActionLog } from "./db/log.ts";
import { githubGql, githubToken, type Gql } from "./github/client.ts";
import { applyMove, type ApplyResult } from "./github/move-item.ts";
import { readBoard } from "./github/read-board.ts";

export interface Deps {
  mode: "live" | "demo";
  /** Why the demo runs instead of the real board, when it does. */
  demoReason?: "asked" | "no-github-access";
  config: QuestConfig;
  readBoard(): Promise<BoardSnapshot>;
  applyMove(p: PreparedMove): Promise<ApplyResult>;
  log: ActionLog;
  viewer(): Promise<{ login: string; avatarUrl: string }>;
}

const root = new URL("../../", import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8")) as unknown;

export function liveDeps(config: QuestConfig): Deps {
  let gql: Promise<Gql> | null = null;
  const client = () => (gql ??= githubGql().catch((e) => { gql = null; throw e; }));
  const url = process.env.DATABASE_URL;
  if (!url) console.warn("[project-quest] DATABASE_URL is not set: the action log is kept in memory only");
  return {
    mode: "live",
    config,
    readBoard: async () => readBoard(await client(), config),
    applyMove: async (p) => applyMove(await client(), config, p),
    log: url ? pgActionLog(url) : memoryActionLog(),
    viewer: async () =>
      (await (await client())<{ viewer: { login: string; avatarUrl: string } }>("query { viewer { login avatarUrl } }", {})).viewer,
  };
}

export function demoDeps(config: QuestConfig, reason: Deps["demoReason"]): Deps {
  const board = structuredClone(json("src/shared/demo/demo-board.json")) as BoardSnapshot;
  return {
    mode: "demo",
    demoReason: reason,
    config,
    readBoard: async () => board,
    applyMove: async (p) => {
      const item = board.items.find((i) => i.itemId === p.itemId);
      if (!item || item.status !== p.from || item.updatedAt !== p.expectedUpdatedAt) {
        return { ok: false, reason: "stale", current: { status: item?.status ?? null, updatedAt: item?.updatedAt ?? "" } };
      }
      item.status = p.to;
      item.updatedAt = new Date().toISOString();
      return { ok: true as const, board };
    },
    log: memoryActionLog(),
    viewer: async () => ({ login: "you", avatarUrl: "" }),
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
