import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { tinted } from "./tint.ts";

describe("tinted", () => {
  it("makes one material per base material and colour, shared by every piece that uses them", () => {
    const wall = new THREE.MeshStandardMaterial({ name: "wall" });
    const a = tinted(wall, "#F2E3C6");
    expect(a).not.toBe(wall);
    expect(a.color.getHexString()).toBe("f2e3c6");
    expect(tinted(wall, "#F2E3C6")).toBe(a);
    expect(tinted(wall, "#E9C9B1")).not.toBe(a);
    expect(tinted(new THREE.MeshStandardMaterial({ name: "wall" }), "#F2E3C6")).not.toBe(a);
  });
});
