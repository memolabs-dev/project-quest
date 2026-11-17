import { describe, expect, it } from "vitest";
import { DAY_SECONDS, daylight, shadowBox } from "./daylight.ts";

describe("daylight", () => {
  it("the light goes from morning to evening and back, never night", () => {
    for (let s = 0; s < 3 * 2 * DAY_SECONDS; s += 10) {
      const d = daylight(s);
      expect(d.sun[1]).toBeGreaterThanOrEqual(6);
      expect(d.intensity).toBeGreaterThanOrEqual(2.0);
      expect(d.intensity).toBeLessThanOrEqual(2.8);
      expect(Math.abs(daylight(s + 1).sky - d.sky)).toBeLessThan(0.01);
    }
    expect(daylight(0).sky).toBeCloseTo(0);
    expect(daylight(DAY_SECONDS).sky).toBeCloseTo(1);
    expect(daylight(2 * DAY_SECONDS).sky).toBeCloseTo(0);
  });

  it("the sun rises east and sets west", () => {
    expect(daylight(0).sun[0]).toBeLessThan(0);
    expect(daylight(DAY_SECONDS).sun[0]).toBeGreaterThan(0);
    expect(daylight(DAY_SECONDS / 2).sun[1]).toBeGreaterThan(daylight(0).sun[1]);
  });

  it("the shadow box follows the player in whole texels", () => {
    const texel = 60 / 2048;
    const box = shadowBox({ x: 10.37, z: -3.21 }, 30, 2048);
    expect(Math.abs(box.x / texel - Math.round(box.x / texel))).toBeLessThan(1e-9);
    expect(Math.abs(box.z / texel - Math.round(box.z / texel))).toBeLessThan(1e-9);
    expect(Math.abs(box.x - 10.37)).toBeLessThanOrEqual(texel);
  });
});
