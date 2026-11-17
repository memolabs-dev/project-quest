import { describe, expect, it } from "vitest";
import { arc, overshoot, shake, squash } from "./curves.ts";

describe("the motion curves", () => {
  it("the arc starts and ends on the ground, highest midway", () => {
    expect(arc(0, 1)).toEqual({ along: 0, up: 0 });
    expect(arc(1, 1)).toEqual({ along: 1, up: 0 });
    expect(arc(0.5, 1).up).toBeCloseTo(1);
    expect(arc(0.25, 1).up).toBeLessThan(arc(0.5, 1).up);
  });
  it("the squash flattens on landing and comes back to 1", () => {
    expect(squash(0)).toBe(1);
    expect(squash(0.3)).toBeLessThan(1);
    expect(squash(1)).toBe(1);
  });
  it("the overshoot passes 1.1 and settles on 1", () => {
    expect(overshoot(0)).toBe(0);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => overshoot(i / 100)));
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan(1.15);
    expect(overshoot(1)).toBe(1);
  });
  it("the shake ends at rest", () => {
    expect(shake(0)).toBe(0);
    expect(Math.abs(shake(0.15))).toBeGreaterThan(0);
    expect(shake(1)).toBe(0);
  });
});
