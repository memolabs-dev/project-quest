import { describe, expect, it } from "vitest";
import type { Building, Site } from "../../shared/site.ts";
import {
  badgeInitial, buildingPlan, crateScale, dronePose, facade, idleOffset, jacketColor, newlyLaid, termiteSpots, workerSpots,
} from "./show.ts";

const b = (floorsDone: number, floorsTotal: number, epicNumber: number | null = 1): Building => ({ epicNumber, title: "FICTIF", floorsDone, floorsTotal });

describe("buildingPlan", () => {
  it("builds the done floors and scaffolds the rest", () => {
    expect(buildingPlan(b(2, 6))).toEqual({ built: 2, scaffold: 4, roof: false });
  });
  it("puts the roof on only when every floor is done", () => {
    expect(buildingPlan(b(5, 5)).roof).toBe(true);
    expect(buildingPlan(b(0, 0)).roof).toBe(false);
  });
  it("keeps a very tall building readable by capping the drawn scaffold", () => {
    const plan = buildingPlan(b(3, 40));
    expect(plan.built + plan.scaffold).toBeLessThanOrEqual(12);
    expect(plan.built).toBe(1);
  });
  it("shows a tall building's progress in proportion, never complete before it is", () => {
    expect(buildingPlan(b(12, 40))).toEqual({ built: 4, scaffold: 8, roof: false });
    expect(buildingPlan(b(39, 40))).toEqual({ built: 11, scaffold: 1, roof: false });
    expect(buildingPlan(b(40, 40))).toEqual({ built: 12, scaffold: 0, roof: true });
    expect(buildingPlan(b(1, 40)).built).toBe(1);
  });
});

describe("crateScale", () => {
  it("follows the task size, default when unset", () => {
    expect(crateScale("XS")).toBeLessThan(crateScale("S"));
    expect(crateScale("L")).toBeGreaterThan(crateScale("M"));
    expect(crateScale(null)).toBe(1);
    expect(crateScale("weird")).toBe(1);
  });
});

describe("workerSpots", () => {
  const site: Site = {
    zones: [{ name: "Backlog", index: 0 }],
    buildings: [],
    pallets: [
      { number: 7, itemId: "a", title: "FICTIF", url: "", zone: "Backlog", closed: false, discarded: false, building: null, isBug: false, goodFirst: false, trade: "painter", size: null },
      { number: 3, itemId: "b", title: "FICTIF", url: "", zone: "Backlog", closed: false, discarded: false, building: null, isBug: false, goodFirst: false, trade: "mason", size: null },
    ],
    workers: [{ login: "fictif-maria", avatarUrl: "https://example.org/a.png", carrying: [7, 3] }],
  };
  const layout = [{ number: 7, x: 10, z: 0 }, { number: 3, x: 2, z: 0 }];

  it("places each worker once, beside their lowest-numbered pallet, with that pallet's trade", () => {
    const spots = workerSpots(site, layout);
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ login: "fictif-maria", trade: "mason" });
    expect(Math.abs(spots[0].x - 2)).toBeLessThan(1.5);
  });

  const zones = [{ name: "Backlog", index: 0 }, { name: "Done", index: 1 }];
  const p = (number: number, zone: string, closed = false) =>
    ({ number, itemId: `i${number}`, title: "FICTIF", url: "", zone, closed, discarded: false, building: null, isBug: false, goodFirst: false, trade: null, size: null });

  it("stands a worker by their current work, not a finished issue", () => {
    const s: Site = { zones, buildings: [], pallets: [p(1, "Done", true), p(5, "Backlog")], workers: [{ login: "a", avatarUrl: "", carrying: [1, 5] }] };
    const spots = workerSpots(s, [{ number: 1, x: 20, z: 0 }, { number: 5, x: 0, z: 0 }]);
    expect(Math.abs(spots[0].x - 0)).toBeLessThan(1.5);
  });
  it("falls back to a finished issue when that is all a worker has", () => {
    const s: Site = { zones, buildings: [], pallets: [p(1, "Done", true)], workers: [{ login: "a", avatarUrl: "", carrying: [1] }] };
    expect(workerSpots(s, [{ number: 1, x: 20, z: 0 }])).toHaveLength(1);
  });
  it("gives co-assignees of one pallet their own spot", () => {
    const s: Site = {
      zones, buildings: [], pallets: [p(3, "Backlog")],
      workers: [{ login: "a", avatarUrl: "", carrying: [3] }, { login: "b", avatarUrl: "", carrying: [3] }],
    };
    const [a, c] = workerSpots(s, [{ number: 3, x: 0, z: 0 }]);
    expect(Math.hypot(a.x - c.x, a.z - c.z)).toBeGreaterThan(0.5);
  });
});

describe("badgeInitial", () => {
  it("is the login's first letter or digit, upper case", () => {
    expect(badgeInitial("maria-fictif")).toBe("M");
    expect(badgeInitial("-_42bot")).toBe("4");
    expect(badgeInitial("")).toBe("?");
  });
});

describe("jacketColor", () => {
  it("gives each trade its own colour, and a default one without trade", () => {
    const trades = ["mason", "painter", "surveyor", "architect"].map(jacketColor);
    expect(new Set(trades).size).toBe(4);
    expect(jacketColor(null)).toMatch(/^#/);
    expect(trades).not.toContain(jacketColor(null));
    expect(jacketColor("juggler")).toBe(jacketColor(null));
  });
});

describe("idleOffset", () => {
  it("is stable per worker and between 0 and 1", () => {
    expect(idleOffset("maria-fictif")).toBe(idleOffset("maria-fictif"));
    expect(idleOffset("maria-fictif")).not.toBe(idleOffset("jo-fictif"));
    for (const l of ["a", "jo-fictif", "sam-fictif"]) {
      expect(idleOffset(l)).toBeGreaterThanOrEqual(0);
      expect(idleOffset(l)).toBeLessThan(1);
    }
  });
});

describe("termiteSpots", () => {
  const pallet = (number: number, isBug: boolean, closed = false, size: string | null = null) => ({
    number, itemId: `i${number}`, title: "FICTIF", url: "", zone: "Backlog", closed, discarded: false, building: null, isBug, goodFirst: false, trade: null, size,
  });
  it("puts termites on open bug pallets only, sized to the crate", () => {
    const site: Site = { zones: [], buildings: [], workers: [], pallets: [pallet(1, true), pallet(2, false), pallet(3, true, true), pallet(4, true, false, "XL")] };
    const spots = termiteSpots(site, [{ number: 1, x: 1, z: 2 }, { number: 2, x: 0, z: 0 }, { number: 3, x: 5, z: 5 }, { number: 4, x: 9, z: 0 }]);
    expect(spots.map((s) => s.number)).toEqual([1, 4]);
    expect(spots[0]).toMatchObject({ x: 1, z: 2, scale: 1 });
    expect(spots[1].scale).toBe(crateScale("XL"));
  });
});

describe("dronePose", () => {
  const end = { position: [0, 13, 14], target: [0, 2, -4] };
  it("starts high over the far end of the site and lands on the follow camera", () => {
    const start = dronePose(0, 40, end);
    expect(start.position[1]).toBeGreaterThan(end.position[1]);
    expect(start.position[0]).toBeLessThan(-10);
    expect(dronePose(1, 40, end)).toEqual(end);
  });
  it("clamps time outside 0..1", () => {
    expect(dronePose(2, 40, end)).toEqual(end);
    expect(dronePose(-1, 40, end)).toEqual(dronePose(0, 40, end));
  });
});

describe("newlyLaid", () => {
  const site = (floors: [number, number][]): Site => ({
    zones: [], pallets: [], workers: [],
    buildings: floors.map(([epicNumber, floorsDone]) => ({ epicNumber, title: "", floorsDone, floorsTotal: 9 })),
  });
  it("names each building whose floors grew, once, even after several moves", () => {
    expect(newlyLaid(site([[1, 2], [2, 0]]), site([[1, 4], [2, 1]]))).toEqual([1, 2]);
  });
  it("the unassigned building grows too", () => {
    const unassigned = (floorsDone: number): Site => ({ zones: [], pallets: [], workers: [], buildings: [{ epicNumber: null, title: "", floorsDone, floorsTotal: 1 }] });
    expect(newlyLaid(unassigned(0), unassigned(1))).toEqual(["unassigned"]);
  });
  it("names nothing on the first load, or when floors went down", () => {
    expect(newlyLaid(null, site([[1, 2]]))).toEqual([]);
    expect(newlyLaid(site([[1, 2]]), site([[1, 1]]))).toEqual([]);
  });
});

describe("facade", () => {
  it("is stable for an epic and differs between neighbours", () => {
    expect(facade(1)).toEqual(facade(1));
    expect(facade(1)).not.toEqual(facade(2));
    expect(facade(null).wall).toMatch(/^#/);
  });
});
