import { describe, expect, it } from "vitest";
import type { Pallet, Site } from "../../shared/site.ts";
import { type ClipPlan, GESTURES, gestureAt, greeting, headYaw, livelyWorkers, nearestWorker, nextClip, restAfter, restState, sameMembers, workerBusy } from "./people.ts";

const pallet = (number: number, zone: string, closed = false): Pallet => ({
  number, itemId: `I${number}`, title: "FICTIF", url: "", zone, closed, discarded: false,
  building: null, isBug: false, goodFirst: false, trade: null, size: null, myReactions: [],
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

describe("nextClip", () => {
  const plan = (o: Partial<ClipPlan> = {}): ClipPlan => ({ step: 0, left: 5, gesture: "PickUp", wave: 0, ...o });
  const at = { busy: false, lively: true, login: "a" };

  it("goes back to the gesture once the wave is over", () => {
    const p = plan({ wave: 1 });
    expect(nextClip(p, { ...at, delta: 0.5 })).toBe("Interact");
    expect(nextClip(p, { ...at, delta: 0.5 })).toBe("Interact");
    expect(nextClip(p, { ...at, delta: 0.5 })).toBe("PickUp");
  });

  it("goes back to the gesture when work ends or the worker is one of the twelve again", () => {
    const p = plan();
    expect(nextClip(p, { ...at, busy: true, delta: 0.1 })).toBe("Use_Item");
    expect(nextClip(p, { ...at, delta: 0.1 })).toBe("PickUp");
    expect(nextClip(p, { ...at, lively: false, delta: 0.1 })).toBe("Unarmed_Idle");
    expect(nextClip(p, { ...at, delta: 0.1 })).toBe("PickUp");
  });

  it("changes gesture when its time is up", () => {
    const p = plan({ gesture: null, left: 0 });
    const first = nextClip(p, { ...at, delta: 0.1 });
    expect(first).toBe(gestureAt("a", 0).clip);
    p.left = 0;
    expect(nextClip(p, { ...at, delta: 0.1 })).toBe(gestureAt("a", 1).clip);
  });
});

describe("sameMembers", () => {
  it("tells when the twelve have not changed", () => {
    expect(sameMembers(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(sameMembers(new Set(["a", "b"]), new Set(["a", "c"]))).toBe(false);
    expect(sameMembers(new Set(["a"]), new Set(["a", "b"]))).toBe(false);
  });
});

describe("nearestWorker", () => {
  const spots = [{ login: "a", x: 0, z: 0, pallet: 1 }, { login: "b", x: 3, z: 0, pallet: 2 }];
  it("the nearest worker within 4 m, with the pallet they stand by", () => {
    expect(nearestWorker(spots, { x: 2.2, z: 0 })).toEqual({ login: "b", pallet: 2 });
    expect(nearestWorker(spots, { x: 0.5, z: 1 })).toEqual({ login: "a", pallet: 1 });
    expect(nearestWorker(spots, { x: 20, z: 0 })).toBeNull();
  });
});

describe("nextClip answers a warm gesture", () => {
  it("plays the answer once, then goes back to what the worker was doing", () => {
    const p: ClipPlan = { step: 0, left: 5, gesture: "PickUp", wave: 0, answer: { clip: "Cheer", left: 1 } };
    const at = { busy: true, lively: true, login: "a", delta: 0.6 };
    expect(nextClip(p, at)).toBe("Cheer");
    expect(nextClip(p, at)).toBe("Cheer");
    expect(nextClip(p, at)).toBe("Use_Item");
  });
});
