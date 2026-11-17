import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "./test-guard.ts";
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
      await p.setPath("fictif-a", "lead");
      await p.reset("FICTIF-A");
      expect(await p.path("fictif-a")).toBeNull();
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

    it("remembers the declared capacity", async () => {
      const p = make();
      expect(await p.capacity("fictif-a")).toBeNull();
      await p.setCapacity("Fictif-A", 8);
      expect(await p.capacity("fictif-a")).toBe(8);
      await p.setCapacity("fictif-a", 13);
      expect(await p.capacity("FICTIF-A")).toBe(13);
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

  // Only the test database, never DATABASE_URL: the game's own data must stay out of reach of these tests.
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    assertTestDatabase(url);
    const p = pgProgress(url);
    behaves("postgres", () => p, () => p.clearForTests());
  } else {
    it.skip("postgres: set DATABASE_URL (npm run test:db) to run against Docker Postgres", () => {});
  }
});
