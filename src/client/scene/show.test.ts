import { describe, expect, it } from "vitest";
import type { Building, Site } from "../../shared/site.ts";
import { buildingPlan, crateScale, facade, newlyLaid, workerSpots } from "./show.ts";

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
    expect(plan.built).toBe(3);
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
      { number: 7, itemId: "a", title: "FICTIF", url: "", zone: "Backlog", closed: false, building: null, isBug: false, trade: "painter", size: null },
      { number: 3, itemId: "b", title: "FICTIF", url: "", zone: "Backlog", closed: false, building: null, isBug: false, trade: "mason", size: null },
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
});

describe("newlyLaid", () => {
  const site = (floors: [number, number][]): Site => ({
    zones: [], pallets: [], workers: [],
    buildings: floors.map(([epicNumber, floorsDone]) => ({ epicNumber, title: "", floorsDone, floorsTotal: 9 })),
  });
  it("names each building whose floors grew, once, even after several moves", () => {
    expect(newlyLaid(site([[1, 2], [2, 0]]), site([[1, 4], [2, 1]]))).toEqual([1, 2]);
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
