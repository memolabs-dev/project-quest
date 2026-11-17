import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DAY_SECONDS, SUN_DISTANCE, daylight, lightAt, shadowBox } from "./daylight.ts";

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

  it("the shadow box moves in whole texels of the light's own grid", () => {
    const texel = 60 / 2048;
    const sun = daylight(0).sun;
    // The light's grid: its right and up axes, as the shadow camera sees them.
    const f = new THREE.Vector3(...sun).negate().normalize();
    const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const u = new THREE.Vector3().crossVectors(r, f);
    for (const p of [{ x: 10.37, z: -3.21 }, { x: 10.41, z: -3.18 }, { x: -25.9, z: 4.02 }]) {
      const box = new THREE.Vector3(...Object.values(shadowBox(p, sun, 30, 2048)) as [number, number, number]);
      for (const axis of [r, u]) {
        const t = box.dot(axis) / texel;
        expect(Math.abs(t - Math.round(t))).toBeLessThan(1e-6);
      }
      expect(box.distanceTo(new THREE.Vector3(p.x, 0, p.z))).toBeLessThan(2 * texel);
    }
  });

  it("the light stands far along the sun's direction, so no tall caster falls behind its near plane", () => {
    const sun = daylight(0).sun;
    const at = lightAt({ x: 4, y: 0, z: -2 }, sun);
    const d = new THREE.Vector3(at[0] - 4, at[1], at[2] + 2);
    expect(d.length()).toBeCloseTo(SUN_DISTANCE);
    expect(d.normalize().dot(new THREE.Vector3(...sun).normalize())).toBeCloseTo(1);
  });
});
