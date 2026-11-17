import { describe, expect, it } from "vitest";
import { APPRENTICE } from "./apprentice.ts";
import { LEVELS } from "./index.ts";
import { currentLevel, rankReached, unlocks } from "./progress.ts";

const ids = APPRENTICE.map((l) => l.id);

describe("progress", () => {
  it("starts at the first level and ends when all are stamped", () => {
    expect(currentLevel(APPRENTICE, new Set())?.id).toBe("a1-walk");
    expect(currentLevel(APPRENTICE, new Set(ids.slice(0, 3)))?.id).toBe("a4-found-site");
    expect(currentLevel(APPRENTICE, new Set(ids))).toBeNull();
  });
  it("reaches the Apprentice rank only with all seven stamps", () => {
    expect(rankReached(APPRENTICE, new Set(ids.slice(0, 6)))).toBeNull();
    expect(rankReached(APPRENTICE, new Set(ids))).toBe("apprentice");
  });
  it("unlocks the helmet and the skill book after the first level, the own site after founding", () => {
    expect(unlocks(new Set())).toMatchObject({ helmet: false, skillBook: false, ownSite: false });
    expect(unlocks(new Set(["a1-walk"]))).toMatchObject({ helmet: true, skillBook: true, ownSite: false });
    expect(unlocks(new Set(ids.slice(0, 4)))).toMatchObject({ helmet: true, skillBook: true, ownSite: true });
  });
  it("the trowel comes with the Apprentice rank, the first building with the merge", () => {
    expect(unlocks(new Set(ids.slice(0, 6)))).toMatchObject({ trowel: false, firstBuilding: false });
    expect(unlocks(new Set(ids))).toMatchObject({ trowel: true, firstBuilding: false });
    expect(unlocks(new Set([...ids, "a8-edit-file", "a9-open-pull", "a10-answer-review", "a11-merge"]))).toMatchObject({ trowel: true, firstBuilding: true });
  });
  it("the van comes with the Journeyman rank, the real projects with the clean-up", () => {
    const journeyman = [...ids, "a8-edit-file", "a9-open-pull", "a10-answer-review", "a11-merge"];
    expect(unlocks(new Set(ids))).toMatchObject({ van: false, realProjects: false });
    expect(unlocks(new Set(journeyman))).toMatchObject({ van: true, realProjects: false });
    expect(unlocks(new Set(LEVELS.map((l) => l.id)))).toMatchObject({ van: true, realProjects: true });
  });
  it("reaches the Journeyman rank after the Apprentice one", () => {
    const all = LEVELS.map((l) => l.id);
    const journeyman = LEVELS.filter((l) => l.rank !== "team-leader").map((l) => l.id);
    expect(rankReached(LEVELS, new Set(ids))).toBe("apprentice");
    expect(rankReached(LEVELS, new Set(journeyman))).toBe("journeyman");
    expect(rankReached(LEVELS, new Set(all))).toBe("team-leader");
    expect(currentLevel(LEVELS, new Set(ids))?.id).toBe("a8-edit-file");
  });
});
