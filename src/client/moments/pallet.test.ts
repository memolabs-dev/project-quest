import { describe, expect, it } from "vitest";
import { palletAnim } from "./pallet.ts";

describe("which animation a pallet plays", () => {
  it("a new parcel falls only when it arrives after the scene opened, never on a first view", () => {
    expect(palletAnim({ moved: false, motion: { kind: "parcel", at: 5 }, seen: 4, reduced: false })).toBe("fall");
    expect(palletAnim({ moved: false, motion: { kind: "parcel", at: 5 }, seen: 5, reduced: false })).toBeNull();
  });
  it("only the pallet that moved hops; the others that shifted a slot slide", () => {
    expect(palletAnim({ moved: true, motion: { kind: "pallet-moved", at: 9 }, seen: 8, reduced: false })).toBe("arc");
    expect(palletAnim({ moved: true, motion: undefined, seen: 8, reduced: false })).toBe("slide");
    expect(palletAnim({ moved: true, motion: { kind: "pallet-moved", at: 3 }, seen: 8, reduced: false })).toBe("slide");
  });
  it("a refusal shakes, a clearing folds", () => {
    expect(palletAnim({ moved: false, motion: { kind: "refused", at: 2 }, seen: 1, reduced: false })).toBe("shake");
    expect(palletAnim({ moved: false, motion: { kind: "cleared", at: 2 }, seen: 1, reduced: false })).toBe("fold");
  });
  it("with reduced motion, a moved crate slides and a cleared one fades; nothing hops, falls or shakes", () => {
    expect(palletAnim({ moved: true, motion: { kind: "pallet-moved", at: 9 }, seen: 8, reduced: true })).toBe("slide");
    expect(palletAnim({ moved: false, motion: { kind: "cleared", at: 9 }, seen: 8, reduced: true })).toBe("fade");
    expect(palletAnim({ moved: false, motion: { kind: "cleared", at: 9 }, seen: 9, reduced: true })).toBeNull();
    expect(palletAnim({ moved: false, motion: { kind: "parcel", at: 9 }, seen: 8, reduced: true })).toBeNull();
    expect(palletAnim({ moved: false, motion: { kind: "refused", at: 9 }, seen: 8, reduced: true })).toBeNull();
  });
});
