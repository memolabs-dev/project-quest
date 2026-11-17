import { describe, expect, it } from "vitest";
import type { LevelsView } from "../shared/api.ts";
import { LEVELS } from "../shared/levels/index.ts";
import { laterView, mentorAction, newStamps, noGoodFirst, siteKindFromUrl } from "./levels.ts";

const ids = LEVELS.map((l) => l.id);
const view = (stamped: number, exists = false): LevelsView => ({
  login: "fictif-volunteer", canWrite: true, path: null, ranks: { volunteer: null, lead: null },
  stamps: ids.slice(0, stamped).map((levelId) => ({ levelId, proof: "tutorial", stampedAt: "2026-11-17T00:00:00Z" })),
  current: ids[stamped] ?? null,
  rank: stamped === ids.length ? "apprentice" : null,
  unlocks: { helmet: stamped > 0, skillBook: stamped > 0, ownSite: stamped > 3, trowel: stamped > 6, firstBuilding: stamped > 10, van: stamped > 10, realProjects: stamped > 14 },
  practice: { name: "my-first-site", exists, readme: null, issue: 1, pull: null, unassigned: null, defaultBranch: "main", workBranch: null, mainMoved: false },
  real: null,
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
  it("asks to edit, then to open a pull request, then to answer, then to merge", () => {
    expect(mentorAction(view(7, true), "practice")).toBe("edit");
    expect(mentorAction(view(8, true), "practice")).toBe("pull");
    expect(mentorAction(view(9, true), "practice")).toBe("edit");
    expect(mentorAction(view(10, true), "practice")).toBe("merge");
  });
  it("asks for an issue, then the commands", () => {
    const at12 = view(11, true);
    expect(mentorAction({ ...at12, practice: { ...at12.practice, issue: null } }, "practice")).toBe("write");
    expect(mentorAction({ ...at12, practice: { ...at12.practice, issue: null, unassigned: 3 } }, "practice")).toBe("take");
    expect(mentorAction(at12, "practice")).toBe("commands");
  });
  it("asks the mayor first, then the commands", () => {
    const at13 = view(12, true);
    expect(mentorAction(at13, "practice")).toBe("mayor");
    expect(mentorAction({ ...at13, practice: { ...at13.practice, mainMoved: true } }, "practice")).toBe("commands");
  });
  it("at a14 with no open issue left, asks for one first instead of a dead pull request", () => {
    const at14 = view(13, true);
    expect(mentorAction({ ...at14, practice: { ...at14.practice, issue: null } }, "practice")).toBe("write");
    expect(mentorAction({ ...at14, practice: { ...at14.practice, issue: null, unassigned: 5 } }, "practice")).toBe("take");
  });
  it("opens the pull request, then the commands; merges, then the commands", () => {
    const at14 = view(13, true);
    expect(mentorAction(at14, "practice")).toBe("pull");
    expect(mentorAction({ ...at14, practice: { ...at14.practice, pull: 4 } }, "practice")).toBe("commands");
    const at15 = view(14, true);
    expect(mentorAction({ ...at15, practice: { ...at15.practice, pull: 4 } }, "practice")).toBe("merge");
    expect(mentorAction(at15, "practice")).toBe("commands");
  });
  it("sends the player to the real site, then asks them to pick a good first issue", () => {
    const at16 = view(15, true);
    expect(mentorAction(at16, "practice")).toBe("to-main");
    expect(mentorAction(at16, "main")).toBeNull();
  });
  it("says when the real site shows no good first issue to ask for", () => {
    const pallet = (o: { goodFirst: boolean; closed?: boolean }) => ({ goodFirst: o.goodFirst, closed: o.closed ?? false });
    expect(noGoodFirst(view(15, true), [pallet({ goodFirst: false })])).toBe(true);
    expect(noGoodFirst(view(15, true), [pallet({ goodFirst: true, closed: true })])).toBe(true);
    expect(noGoodFirst(view(15, true), [pallet({ goodFirst: true })])).toBe(false);
    expect(noGoodFirst(view(14, true), [])).toBe(false);
  });
  it("has nothing to ask once every level is done", () => {
    expect(mentorAction(view(ids.length, true), "practice")).toBeNull();
  });
});

describe("siteKindFromUrl", () => {
  it("reads the site kind from the address", () => {
    expect(siteKindFromUrl("")).toBe("main");
    expect(siteKindFromUrl("?demo=1")).toBe("demo");
    expect(siteKindFromUrl("?site=practice")).toBe("practice");
    expect(siteKindFromUrl("?demo=1&site=practice")).toBe("demo");
  });
});

describe("laterView", () => {
  it("keeps the view with more stamps, so a late answer never takes a level back", () => {
    expect(laterView(view(2), view(1))).toEqual(view(2));
    expect(laterView(view(1), view(2))).toEqual(view(2));
    expect(laterView(null, view(1))).toEqual(view(1));
  });
});

describe("newStamps", () => {
  it("names the levels stamped since the previous view, for the mentor's cheer", () => {
    expect(newStamps(view(1), view(3))).toEqual(["a2-read-issue", "a3-read-board"]);
    expect(newStamps(null, view(3))).toEqual([]);
  });
});
