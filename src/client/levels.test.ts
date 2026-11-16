import { describe, expect, it } from "vitest";
import type { LevelsView } from "../shared/api.ts";
import { APPRENTICE } from "../shared/levels/apprentice.ts";
import { mentorAction, newStamps, siteKindFromUrl } from "./levels.ts";

const ids = APPRENTICE.map((l) => l.id);
const view = (stamped: number, exists = false): LevelsView => ({
  login: "fictif-volunteer", canWrite: true,
  stamps: ids.slice(0, stamped).map((levelId) => ({ levelId, proof: "tutorial", stampedAt: "2026-11-17T00:00:00Z" })),
  current: ids[stamped] ?? null,
  rank: stamped === ids.length ? "apprentice" : null,
  unlocks: { helmet: stamped > 0, skillBook: stamped > 0, ownSite: stamped > 3 },
  practice: { name: "my-first-site", exists },
});

describe("mentorAction", () => {
  it("sends a new player to the tutorial", () => {
    expect(mentorAction(view(0), "main")).toBe("to-tutorial");
    expect(mentorAction(view(0), "demo")).toBeNull();
  });
  it("sends a tutorial graduate to their site", () => {
    expect(mentorAction(view(3), "demo")).toBe("to-practice");
    expect(mentorAction(view(3), "main")).toBe("to-practice");
  });
  it("asks to found when the site is missing", () => {
    expect(mentorAction(view(3, false), "practice")).toBe("found");
  });
  it("asks for the level's gesture", () => {
    expect(mentorAction(view(4, true), "practice")).toBe("write");
    expect(mentorAction(view(5, true), "practice")).toBe("take");
    expect(mentorAction(view(6, true), "practice")).toBe("move");
  });
  it("has nothing to ask once the rank is done", () => {
    expect(mentorAction(view(7, true), "practice")).toBeNull();
  });
});

describe("siteKindFromUrl", () => {
  it("reads the site kind from the address", () => {
    expect(siteKindFromUrl("")).toBe("main");
    expect(siteKindFromUrl("?demo=1")).toBe("demo");
    expect(siteKindFromUrl("?site=practice")).toBe("practice");
  });
});

describe("newStamps", () => {
  it("names the levels stamped since the previous view, for the mentor's cheer", () => {
    expect(newStamps(view(1), view(3))).toEqual(["a2-read-issue", "a3-read-board"]);
    expect(newStamps(null, view(3))).toEqual([]);
  });
});
