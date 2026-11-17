import { describe, expect, it } from "vitest";
import type { LevelsView } from "../shared/api.ts";
import { LEVELS } from "../shared/levels/index.ts";
import {
  boardCatchingUp, canFollow, cardGestures, laterView, mentorAction, needsPath, newStamps, noGoodFirst, siteKindFromUrl, speakerOf, teamRewards,
} from "./levels.ts";

const ids = LEVELS.map((l) => l.id);
const NO_TEAM: LevelsView["team"] = {
  exists: false, parcels: false, labels: [], milestones: [], sprint: { field: false, current: null, points: 0, capacity: null, loaded: [], unsized: [] },
};
const view = (stamped: number, exists = false): LevelsView => ({
  login: "fictif-volunteer", canWrite: true, path: null, ranks: { volunteer: null, lead: null },
  stamps: ids.slice(0, stamped).map((levelId) => ({ levelId, proof: "tutorial", stampedAt: "2026-11-17T00:00:00Z" })),
  current: ids[stamped] ?? null,
  rank: stamped === ids.length ? "apprentice" : null,
  unlocks: { helmet: stamped > 0, skillBook: stamped > 0, ownSite: stamped > 3, trowel: stamped > 6, firstBuilding: stamped > 10, van: stamped > 10, realProjects: stamped > 14 },
  practice: { name: "my-first-site", exists, readme: null, issue: 1, pull: null, unassigned: null, defaultBranch: "main", workBranch: null, mainMoved: false },
  real: null,
  team: NO_TEAM,
});
const lead = (current: string, team: Partial<LevelsView["team"]> = {}): LevelsView => ({
  ...view(0), path: "lead", current, rank: null, team: { ...NO_TEAM, ...team },
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

describe("the lead's path", () => {
  it("lets a player follow the other path from the skill book", () => {
    expect(canFollow({ ...view(3), path: null }, "lead")).toBe(true);
    expect(canFollow({ ...view(3), path: "lead" }, "lead")).toBe(false);
    expect(canFollow({ ...view(3), path: "lead" }, "volunteer")).toBe(true);
  });
  it("asks the path first", () => {
    expect(needsPath({ ...view(0), path: null })).toBe(true);
    expect(needsPath({ ...view(0), path: "volunteer" })).toBe(false);
    expect(needsPath({ ...view(3), path: null })).toBe(false);
  });
  it("sends a lead to their team site", () => {
    expect(mentorAction(lead("l1-found-team"), "main")).toBe("to-team");
    expect(mentorAction(lead("l1-found-team"), "practice")).toBe("to-team");
  });
  it("founds, then the parcels, then the card gestures", () => {
    expect(mentorAction(lead("l1-found-team"), "team")).toBe("found-team");
    expect(mentorAction(lead("l2-sort-parcels", { exists: true, parcels: false, labels: [] }), "team")).toBe("parcels");
    expect(mentorAction(lead("l2-sort-parcels", { exists: true, parcels: true, labels: ["bug"] }), "team")).toBeNull();
    expect(mentorAction(lead("l3-ready", { exists: true, parcels: true, labels: [] }), "team")).toBeNull();
  });
  it("says when GitHub is still putting the parcels on the board", () => {
    const arrived = lead("l2-sort-parcels", { exists: true, parcels: true, labels: [] });
    expect(boardCatchingUp(arrived, "team", 0)).toBe(true);
    expect(boardCatchingUp(arrived, "team", 6)).toBe(false);
    expect(boardCatchingUp(lead("l2-sort-parcels"), "team", 0)).toBe(false);
    expect(boardCatchingUp(arrived, "main", 0)).toBe(false);
  });
  it("the sprint first, then the capacity, then the loading", () => {
    const sprint = (o: Partial<LevelsView["team"]["sprint"]>) => ({ ...NO_TEAM.sprint, field: true, ...o });
    expect(mentorAction(lead("l5-sprint", { exists: true }), "team")).toBe("sprint-field");
    expect(mentorAction(lead("l5-sprint", { exists: true, sprint: sprint({ current: null }) }), "team")).toBe("sprint-field");
    expect(mentorAction(lead("l5-sprint", { exists: true, sprint: sprint({ current: "Sprint 1" }) }), "team")).toBe("capacity");
    expect(mentorAction(lead("l5-sprint", { exists: true, sprint: sprint({ current: "Sprint 1", capacity: 8 }) }), "team")).toBeNull();
    const loading = lead("l5-sprint", { exists: true, sprint: sprint({ current: "Sprint 1", capacity: 8, loaded: [2] }) });
    expect(cardGestures(loading, 2)).toEqual(["unload"]);
    expect(cardGestures(loading, 3)).toEqual(["load"]);
  });
  it("the mayor sets the visit", () => {
    expect(mentorAction(lead("l6-milestone", { exists: true }), "team")).toBe("milestone");
    expect(speakerOf("l6-milestone")).toBe("mayor");
    const set = lead("l6-milestone", { exists: true, milestones: [{ number: 1, title: "FICTIF Visit", dueOn: "2026-11-29T12:00:00Z" }] });
    expect(cardGestures(set, 2)).toEqual(["attach"]);
    expect(cardGestures(lead("l6-milestone", { exists: true }), 2)).toEqual([]);
  });
  it("Gérard teaches the split and the rope", () => {
    expect(speakerOf("l7-split")).toBe("crane");
    expect(speakerOf("l8-rope")).toBe("crane");
    expect(cardGestures(lead("l7-split", { exists: true }), 3)).toEqual(["split"]);
    expect(cardGestures(lead("l8-rope", { exists: true }), 3)).toEqual(["rope"]);
    expect(cardGestures(lead("l4-size", { exists: true }), 3)).toEqual(["size"]);
  });
  it("puts the sprint truck and the mayor's ribbon on the team site", () => {
    const v = lead("l7-split", {
      exists: true, sprint: { ...NO_TEAM.sprint, field: true, current: "Sprint 1", points: 5, capacity: 8 },
      milestones: [{ number: 2, title: "FICTIF Later", dueOn: "2026-12-20T12:00:00Z" }, { number: 1, title: "FICTIF Visit", dueOn: "2026-11-29T12:00:00Z" }, { number: 3, title: "FICTIF No date", dueOn: null }],
    });
    expect(teamRewards(v, "team")).toEqual({ truck: { title: "Sprint 1", points: 5, capacity: 8 }, ribbon: { title: "FICTIF Visit", dueOn: "2026-11-29" } });
    expect(teamRewards(v, "main")).toEqual({ truck: null, ribbon: null });
    expect(teamRewards(lead("l5-sprint"), "team")).toEqual({ truck: null, ribbon: null });
  });
  it("gives each lead level its speaker", () => {
    expect(speakerOf("l1-found-team")).toBe("meme");
    expect(speakerOf("l2-sort-parcels")).toBe("mayor");
    expect(speakerOf("l4-size")).toBe("inspector");
    expect(speakerOf("a5-write-issue")).toBe("meme");
  });
});

describe("siteKindFromUrl", () => {
  it("reads the site kind from the address", () => {
    expect(siteKindFromUrl("")).toBe("main");
    expect(siteKindFromUrl("?demo=1")).toBe("demo");
    expect(siteKindFromUrl("?site=practice")).toBe("practice");
    expect(siteKindFromUrl("?demo=1&site=practice")).toBe("demo");
    expect(siteKindFromUrl("?site=team")).toBe("team");
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
