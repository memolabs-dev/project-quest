import { describe, expect, it } from "vitest";
import { kickAt, planMoment } from "./play.ts";

describe("planMoment", () => {
  it("a full moment carries its dust and kick", () => {
    expect(planMoment({ kind: "floor-laid", building: 1 }, false)).toEqual({ sound: "chime", dust: "ring", kick: 0.12, react: "cheer" });
    expect(planMoment({ kind: "pallet-moved", pallet: 2, landed: true }, false)).toMatchObject({ sound: "land", dust: "puff", kick: 0 });
  });
  it("reduced moments keep their sound and lose their motion", () => {
    expect(planMoment({ kind: "floor-laid", building: 1 }, true)).toEqual({ sound: "chime", dust: null, kick: 0, react: null });
    expect(planMoment({ kind: "pallet-moved", pallet: 2, landed: true }, true)).toEqual({ sound: "land", dust: null, kick: 0, react: null });
  });
});

describe("moments that land", () => {
  it("a pallet's thud and dust wait for the crate to touch the ground", () => {
    expect(planMoment({ kind: "pallet-moved", pallet: 2 }, false)).toMatchObject({ sound: null, dust: null });
    expect(planMoment({ kind: "pallet-moved", pallet: 2, landed: true, spot: [1, 2] }, false)).toMatchObject({ sound: "land", dust: "puff" });
    expect(planMoment({ kind: "parcel", pallet: 3 }, false)).toMatchObject({ sound: null, dust: null });
    // With reduced motion the crate is placed at once: it lands at once, with its sound and no dust.
    expect(planMoment({ kind: "parcel", pallet: 3, landed: true }, true)).toMatchObject({ sound: "thud", dust: null });
  });
});

describe("kickAt", () => {
  it("is nothing before it starts", () => {
    expect(kickAt(-1, 0.12)).toBe(0);
  });
  it("the kick fades to nothing in 300 ms", () => {
    expect(kickAt(0, 0.12)).toBeCloseTo(0.12);
    expect(Math.abs(kickAt(0.15, 0.12))).toBeLessThan(0.12);
    expect(kickAt(0.3, 0.12)).toBe(0);
    expect(kickAt(1, 0.12)).toBe(0);
  });
});
