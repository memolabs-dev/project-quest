import { describe, expect, it } from "vitest";
import { memoryActionLog, pgActionLog, type ActionLog } from "./log.ts";

const entry = (n: number) => ({
  playerLogin: "fictif-lead", gesture: "move", target: `#${n}`,
  payload: { itemId: `PVTI_${n}` }, result: "applied" as const,
});

const behaves = (name: string, make: () => ActionLog, cleanup?: () => Promise<void>) => {
  it(`${name}: returns the latest actions first`, async () => {
    const log = make();
    await log.record(entry(1));
    await log.record({ ...entry(2), result: "stale" });
    const latest = await log.latest(2);
    expect(latest.map((a) => a.target)).toEqual(["#2", "#1"]);
    expect(latest[0]).toMatchObject({ gesture: "move", result: "stale", payload: { itemId: "PVTI_2" } });
    await cleanup?.();
  });
};

describe("action log", () => {
  behaves("memory", memoryActionLog);

  const url = process.env.DATABASE_URL;
  if (url) {
    const log = pgActionLog(url);
    behaves("postgres", () => log, async () => {
      await log.clearForTests();
    });
  } else {
    it.skip("postgres: set DATABASE_URL (npm run test:db) to run against Docker Postgres", () => {});
  }
});
