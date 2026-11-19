import { describe, expect, it } from "vitest";
import { MOMENTS, type MomentKind } from "./list.ts";

const KINDS: MomentKind[] = ["pallet-moved", "floor-laid", "parcel", "cleared", "stamp", "refused", "card-open", "card-close", "loaded", "overloaded", "cheered", "thanked", "talked"];

describe("the moments", () => {
  it("every moment is listed", () => {
    expect(Object.keys(MOMENTS).sort()).toEqual([...KINDS].sort());
  });
  it("a refused write never celebrates", () => {
    const r = MOMENTS.refused;
    expect(r.react).toBeNull();
    expect(r.dust).toBeNull();
    expect(r.kick).toBe(0);
    expect(r.sound).toBe("bonk");
  });
  it("the floor laid is the one big moment", () => {
    const big = KINDS.filter((k) => MOMENTS[k].react === "cheer");
    expect(big).toEqual(["floor-laid"]);
    expect(MOMENTS["floor-laid"]).toMatchObject({ sound: "chime", dust: "ring" });
  });
  it("cheered, thanked and talked have their sound and a lean", () => {
    for (const k of ["cheered", "thanked", "talked"] as const) {
      expect(MOMENTS[k]).toMatchObject({ sound: "cheer", dust: null, kick: 0, react: "lean" });
    }
  });
});
