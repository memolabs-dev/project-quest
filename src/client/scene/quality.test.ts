import { describe, expect, it } from "vitest";
import { QUALITY_START, nextQuality, quality, stepQuality } from "./quality.ts";

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

describe("nextQuality", () => {
  it("a healthy machine keeps full quality: inclines at the top change nothing", () => {
    let s = QUALITY_START;
    for (let i = 0; i < 100; i++) s = nextQuality(s, "incline");
    expect(s).toBe(QUALITY_START);
  });

  it("steps down and back up, then stays where it is after three reversals", () => {
    let s = QUALITY_START;
    s = nextQuality(s, "decline");
    s = nextQuality(s, "decline");
    expect(s.level).toBe(2);
    s = nextQuality(s, "incline"); // reversal 1
    s = nextQuality(s, "decline"); // reversal 2
    expect(s.frozen).toBe(false);
    s = nextQuality(s, "incline"); // reversal 3: stays at 1
    expect(s).toMatchObject({ level: 1, frozen: true });
    expect(nextQuality(s, "decline")).toBe(s);
  });

  it("declines at the bottom change nothing", () => {
    let s = QUALITY_START;
    for (let i = 0; i < 10; i++) s = nextQuality(s, "decline");
    expect(s).toMatchObject({ level: 3, reversals: 0, frozen: false });
  });
});
