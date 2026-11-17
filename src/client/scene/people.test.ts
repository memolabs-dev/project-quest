import { describe, expect, it } from "vitest";
import type { Pallet, Site } from "../../shared/site.ts";
import { GESTURES, gestureAt, greeting, headYaw, livelyWorkers, restAfter, restState, workerBusy } from "./people.ts";

const pallet = (number: number, zone: string, closed = false): Pallet => ({
  number, itemId: `I${number}`, title: "FICTIF", url: "", zone, closed, discarded: false,
  building: null, isBug: false, goodFirst: false, trade: null, size: null,
});
const site = (pallets: Pallet[]): Site => ({
  zones: ["Backlog", "Ready", "In progress", "In review", "Done"].map((name, index) => ({ name, index })),
  pallets, buildings: [], workers: [],
});

describe("the people of the site", () => {
  it("a gesture lasts 4 to 9 seconds and changes", () => {
    for (let n = 0; n < 30; n++) {
      const g = gestureAt("fictif-maria", n);
      expect(g.seconds).toBeGreaterThanOrEqual(4);
      expect(g.seconds).toBeLessThanOrEqual(9);
      expect(GESTURES).toContain(g.clip);
      if (n > 0) expect(g.clip).not.toBe(gestureAt("fictif-maria", n - 1).clip);
    }
    // Each worker at their own rhythm.
    expect([0, 1, 2, 3].map((n) => gestureAt("fictif-maria", n).seconds)).not.toEqual([0, 1, 2, 3].map((n) => gestureAt("fictif-jo", n).seconds));
  });
  it("busy workers use their tool", () => {
    expect(workerBusy(site([pallet(1, "In progress")]), [1])).toBe(true);
    expect(workerBusy(site([pallet(1, "Ready")]), [1])).toBe(true);
    expect(workerBusy(site([pallet(1, "Backlog")]), [1])).toBe(false);
    expect(workerBusy(site([pallet(1, "Done", true)]), [1])).toBe(false);
    expect(workerBusy(site([pallet(1, "In review", true)]), [1])).toBe(false);
  });
  it("the head turn is clamped and damped", () => {
    const worker = { x: 0, z: 0, facing: 0 };
    expect(headYaw(worker, { x: 0, z: 5 }, false)).toBe(0); // beyond 4 m
    expect(headYaw(worker, { x: 1, z: 1 }, false)).toBeCloseTo(Math.PI / 4);
    expect(headYaw(worker, { x: 3, z: -0.5 }, false)).toBeCloseTo(Math.PI / 3); // clamped to 60°
    expect(headYaw(worker, { x: -3, z: -0.5 }, false)).toBeCloseTo(-Math.PI / 3);
  });
  it("one wave per visit", () => {
    const state = { greeted: new Set<string>() };
    expect(greeting(state, "fictif-maria", 6, false)).toBeNull();
    expect(greeting(state, "fictif-maria", 3, false)).toBe("wave");
    expect(greeting(state, "fictif-maria", 3, false)).toBe("name");
    expect(greeting(state, "fictif-maria", 5, false)).toBeNull();
    expect(greeting(state, "fictif-maria", 2, false)).toBe("name");
  });
  it("reduced motion keeps the name only", () => {
    const state = { greeted: new Set<string>() };
    expect(greeting(state, "fictif-jo", 2, true)).toBe("name");
    expect(headYaw({ x: 0, z: 0, facing: 0 }, { x: 1, z: 1 }, true)).toBe(0);
  });
  it("only the twelve nearest live fully", () => {
    const spots = Array.from({ length: 20 }, (_, i) => ({ login: `w${i}`, x: i, z: 0 }));
    const lively = livelyWorkers(spots, { x: 0, z: 0 });
    expect(lively.size).toBe(12);
    expect(lively.has("w0")).toBe(true);
    expect(lively.has("w19")).toBe(false);
  });
  it("the foreman rests after 12 seconds", () => {
    expect(restAfter(11.9)).toBe(false);
    expect(restAfter(12)).toBe(true);
  });
  it("the first input ends the rest", () => {
    expect(restState(0, 20_000)).toBe("rest");
    expect(restState(19_000, 20_000)).toBe("awake");
  });
});
