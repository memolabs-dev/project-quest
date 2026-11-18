import { describe, expect, it } from "vitest";
import { MOMENTS, type MomentKind } from "./list.ts";

const KINDS: MomentKind[] = ["pallet-moved", "floor-laid", "parcel", "cleared", "stamp", "refused", "card-open", "card-close", "loaded", "overloaded", "cheered", "thanked", "talked"];

describe("the moments", () => {
  it("every moment has its reduced version", () => {
    expect(Object.keys(MOMENTS).sort()).toEqual([...KINDS].sort());
    for (const k of KINDS) {
      const m = MOMENTS[k];
      expect(m.reduced, k).toBeDefined();
      // Reduced keeps the sound: it removes motion, never the feedback.
      expect(m.reduced.sound, k).toBe(m.sound);
    }
  });
  it("a refused write never celebrates", () => {
    const r = MOMENTS.refused;
    expect(r.react).toBeNull();
    expect(r.dust).toBeNull();
    expect(r.kick).toBe(0);
    expect(r.sound).toBe("bonk");
  });
  it("the floor laid is the one big moment with dust and a kick; talking cheers the foreman too", () => {
    const big = KINDS.filter((k) => MOMENTS[k].react === "cheer");
    expect(big).toEqual(["floor-laid", "talked"]);
    expect(MOMENTS["floor-laid"]).toMatchObject({ sound: "chime", dust: "ring" });
    expect(MOMENTS["floor-laid"].reduced.text).toBe("site.newFloor");
  });
  it("cheered and thanked have their sound and their reduced version", () => {
    for (const k of ["cheered", "thanked"] as const) {
      expect(MOMENTS[k]).toMatchObject({ sound: "cheer", dust: null, kick: 0, react: "lean" });
      expect(MOMENTS[k].reduced).toEqual({ sound: "cheer", text: null });
    }
  });
  it("talked has its sound and no reduced text", () => {
    expect(MOMENTS.talked).toMatchObject({ sound: "cheer", dust: null, kick: 0, react: "cheer" });
    expect(MOMENTS.talked.reduced).toEqual({ sound: "cheer", text: null });
  });
});
