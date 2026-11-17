import { describe, expect, it } from "vitest";
import { FLOCK, flockAt } from "./birds.ts";

describe("birds", () => {
  it("a flock crosses now and then", () => {
    let flying = 0;
    let samples = 0;
    for (let s = 0; s < 600; s += 0.5, samples++) {
      const f = flockAt(s, 3);
      if (f) {
        flying++;
        expect(f).toHaveLength(FLOCK);
      }
    }
    expect(flying / samples).toBeGreaterThan(0.15);
    expect(flying / samples).toBeLessThan(0.35);
  });

  it("birds fly above the scaffolds, in the camera's view, and cross the site", () => {
    let first: number | null = null;
    let last: number | null = null;
    for (let s = 0; s < 120; s += 0.1) {
      const f = flockAt(s, 3);
      if (!f) { if (first !== null) break; continue; }
      for (const b of f) {
        expect(b.y).toBeGreaterThanOrEqual(4.5);
        expect(b.y).toBeLessThanOrEqual(7);
        expect(b.z).toBeGreaterThanOrEqual(-17); // the buildings start at z -18
        expect(b.z).toBeLessThanOrEqual(-10);
      }
      if (first === null) first = f[0].x;
      last = f[0].x;
    }
    expect(Math.min(first!, last!)).toBeLessThan(-20);
    expect(Math.max(first!, last!)).toBeGreaterThan(20);
  });
});
