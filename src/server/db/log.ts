// The action log: in Postgres for real play, in memory for the demo site and unit tests.
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { assertTestDatabase } from "./test-guard.ts";
import postgres from "postgres";
import { actionLog } from "./schema.ts";

export interface LogEntry {
  playerLogin: string;
  gesture: string;
  target: string;
  payload: unknown;
  result: "applied" | "stale" | "failed";
  githubResponse?: unknown;
}
export interface LoggedAction extends LogEntry { id: number; createdAt: string }

export interface ActionLog {
  record(e: LogEntry): Promise<void>;
  latest(limit: number): Promise<LoggedAction[]>;
}

export function memoryActionLog(): ActionLog {
  const rows: LoggedAction[] = [];
  return {
    async record(e) {
      rows.push({ ...e, id: rows.length + 1, createdAt: new Date().toISOString() });
    },
    async latest(limit) {
      return rows.slice(-limit).reverse();
    },
  };
}

export function pgActionLog(url: string): ActionLog & { clearForTests(): Promise<void> } {
  const db = drizzle(postgres(url, { max: 5 }));
  return {
    async record(e) {
      await db.insert(actionLog).values({ ...e, payload: e.payload ?? {}, githubResponse: e.githubResponse ?? null });
    },
    async latest(limit) {
      const rows = await db.select().from(actionLog).orderBy(desc(actionLog.id)).limit(limit);
      return rows.map((r) => ({ ...r, result: r.result as LogEntry["result"], createdAt: r.createdAt.toISOString() }));
    },
    async clearForTests() {
      assertTestDatabase(url);
      await db.delete(actionLog);
    },
  };
}
