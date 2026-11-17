import { describe, expect, it } from "vitest";
import { quality, stepQuality } from "./quality.ts";

describe("quality", () => {
  it("quality steps down in order and back up", () => {
    expect(quality(0, true)).toEqual({ dpr: [1, 2], aoHalf: false, tiltShift: true });
    let level = stepQuality(0, "decline");
    expect(quality(level, true)).toEqual({ dpr: [1, 1], aoHalf: false, tiltShift: true });
    level = stepQuality(level, "decline");
    expect(quality(level, true)).toEqual({ dpr: [1, 1], aoHalf: true, tiltShift: true });
    level = stepQuality(level, "decline");
    expect(quality(level, true)).toEqual({ dpr: [1, 1], aoHalf: true, tiltShift: false });
    expect(stepQuality(level, "decline")).toBe(3);
    expect(stepQuality(level, "incline")).toBe(2);
    expect(stepQuality(0, "incline")).toBe(0);
  });

  it("the miniature setting turns the effect off at every level", () => {
    for (let level = 0; level < 4; level++) expect(quality(level, false).tiltShift).toBe(false);
  });
});
