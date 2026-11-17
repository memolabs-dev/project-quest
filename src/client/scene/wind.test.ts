import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { windUniforms, withWind } from "./wind.ts";

describe("wind", () => {
  it("the wind is added to the vertex shader", () => {
    const material = withWind(new THREE.MeshStandardMaterial());
    const shader = { vertexShader: "a\n#include <begin_vertex>\nb", uniforms: {} as Record<string, unknown> };
    material.onBeforeCompile(shader as never, undefined as never);
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.vertexShader).toContain("uWindTime");
    expect(shader.uniforms.uWindTime).toBe(windUniforms.uWindTime);
    expect(shader.uniforms.uWindStrength).toBe(windUniforms.uWindStrength);
    expect(material.customProgramCacheKey()).toBe("wind");
  });
});
