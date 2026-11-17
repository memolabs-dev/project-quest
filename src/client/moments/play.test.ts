import { describe, expect, it } from "vitest";
import { kickAt, planMoment } from "./play.ts";

describe("planMoment", () => {
  it("a full moment carries its dust and kick", () => {
    expect(planMoment({ kind: "floor-laid", building: 1 }, false)).toEqual({ sound: "chime", dust: "ring", kick: 0.12, react: "cheer", text: null });
    expect(planMoment({ kind: "pallet-moved", pallet: 2 }, false)).toMatchObject({ sound: "land", dust: "puff", kick: 0 });
  });
  it("reduced moments keep sound and words", () => {
    expect(planMoment({ kind: "floor-laid", building: 1 }, true)).toEqual({ sound: "chime", dust: null, kick: 0, react: null, text: "site.newFloor" });
    expect(planMoment({ kind: "pallet-moved", pallet: 2 }, true)).toEqual({ sound: "land", dust: null, kick: 0, react: null, text: null });
  });
});

describe("kickAt", () => {
  it("the kick fades to nothing in 300 ms", () => {
    expect(kickAt(0, 0.12)).toBeCloseTo(0.12);
    expect(Math.abs(kickAt(0.15, 0.12))).toBeLessThan(0.12);
    expect(kickAt(0.3, 0.12)).toBe(0);
    expect(kickAt(1, 0.12)).toBe(0);
  });
});
