import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { windUniforms, withWind } from "./wind.ts";

describe("wind", () => {
  it("the wind is added to the vertex shader", () => {
    const material = withWind(new THREE.MeshStandardMaterial(), 2);
    const shader = { vertexShader: "a\n#include <begin_vertex>\nb", uniforms: {} as Record<string, unknown> };
    material.onBeforeCompile(shader as never, undefined as never);
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.vertexShader).toContain("uWindTime");
    expect(shader.uniforms.uWindTime).toBe(windUniforms.uWindTime);
    expect(shader.uniforms.uWindStrength).toBe(windUniforms.uWindStrength);
    expect(material.customProgramCacheKey()).toBe("wind");
    // The sway fades to nothing at the tape's ends, tied to their posts.
    expect(shader.uniforms.uWindHalf).toEqual({ value: 2 });
    expect(shader.vertexShader).toContain("windEnds");
  });
});
