import { describe, expect, it } from "vitest";
import { memoryProgress, pgProgress, type ProgressStore } from "./progress.ts";

const behaves = (name: string, make: () => ProgressStore, cleanup?: () => Promise<void>) => {
  describe(name, () => {
    it("stamping twice keeps the first date", async () => {
      const p = make();
      await p.stamp("fictif-a", "a1-walk", "tutorial");
      const [first] = await p.stamps("fictif-a");
      await new Promise((r) => setTimeout(r, 5));
      await p.stamp("fictif-a", "a1-walk", "tutorial");
      const again = await p.stamps("fictif-a");
      expect(again).toHaveLength(1);
      expect(again[0].stampedAt).toBe(first.stampedAt);
      await cleanup?.();
    });

    it("one player's stamps are not another's", async () => {
      const p = make();
      await p.stamp("fictif-a", "a1-walk", "tutorial");
      expect(await p.stamps("fictif-b")).toEqual([]);
      await cleanup?.();
    });

    it("logins are case-insensitive", async () => {
      const p = make();
      await p.stamp("Fictif-A", "a5-write-issue", "https://github.com/fictif-a/my-first-site/issues/1");
      expect((await p.stamps("fictif-a")).map((s) => s.levelId)).toEqual(["a5-write-issue"]);
      await cleanup?.();
    });

    it("events are kept once each", async () => {
      const p = make();
      await p.addEvent("fictif-a", "walked");
      await p.addEvent("FICTIF-A", "walked");
      await p.addEvent("fictif-a", "card-opened");
      expect((await p.events("fictif-a")).sort()).toEqual(["card-opened", "walked"]);
      await cleanup?.();
    });

    it("starts a player again from nothing on reset, and only that player", async () => {
      const p = make();
      await p.stamp("fictif-a", "a1-walk", "tutorial");
      await p.addEvent("fictif-a", "walked");
      await p.stamp("fictif-b", "a1-walk", "tutorial");
      await p.reset("FICTIF-A");
      expect(await p.stamps("fictif-a")).toEqual([]);
      expect(await p.events("fictif-a")).toEqual([]);
      expect(await p.stamps("fictif-b")).toHaveLength(1);
      await cleanup?.();
    });

    it("remembers the chosen path", async () => {
      const p = make();
      expect(await p.path("fictif-a")).toBeNull();
      await p.setPath("Fictif-A", "lead");
      expect(await p.path("fictif-a")).toBe("lead");
      await cleanup?.();
    });

    it("remembers the practice repository's name", async () => {
      const p = make();
      expect(await p.practiceRepo("fictif-a")).toBeNull();
      await p.setPracticeRepo("Fictif-A", "my-first-site");
      expect(await p.practiceRepo("fictif-a")).toBe("my-first-site");
      await cleanup?.();
    });
  });
};

describe("progress store", () => {
  behaves("memory", memoryProgress);

  const url = process.env.DATABASE_URL;
  if (url) {
    const p = pgProgress(url);
    behaves("postgres", () => p, () => p.clearForTests());
  } else {
    it.skip("postgres: set DATABASE_URL (npm run test:db) to run against Docker Postgres", () => {});
  }
});
