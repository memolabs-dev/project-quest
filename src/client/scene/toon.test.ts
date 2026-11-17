import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { tinted } from "./tint.ts";
import { toonOf, toonRamp } from "./toon.ts";

describe("toon", () => {
  it("the ramp has three tones and no smoothing", () => {
    const ramp = toonRamp();
    expect(ramp.image.width).toBe(3);
    expect(ramp.minFilter).toBe(THREE.NearestFilter);
    expect(ramp.magFilter).toBe(THREE.NearestFilter);
    expect(toonRamp()).toBe(ramp);
  });

  it("a toon material keeps the colour and is shared", () => {
    const base = new THREE.MeshStandardMaterial({ name: "crate" });
    const crate = tinted(base, "#3E9B5F");
    const toon = toonOf(crate) as THREE.MeshToonMaterial;
    expect(toon).toBeInstanceOf(THREE.MeshToonMaterial);
    expect(toon.color.getHexString()).toBe(crate.color.getHexString());
    expect(toon.name).toBe("crate");
    expect(toon.gradientMap).toBe(toonRamp());
    expect(toonOf(crate)).toBe(toon);
    expect(toonOf(tinted(base, "#E8483B"))).not.toBe(toon);
  });

  it("a material that is not standard is left alone", () => {
    const basic = new THREE.MeshBasicMaterial();
    expect(toonOf(basic)).toBe(basic);
  });
});
