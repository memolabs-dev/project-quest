// The wind on the yard tapes (living site spec, section 5): a sway added to the vertex shader, no new dependency.
// One shared clock for every material that sways; the site ticks it once per frame, and sets the strength to 0
// with reduced motion.
import type * as THREE from "three";

export const windUniforms = { uWindTime: { value: 0 }, uWindStrength: { value: 1 } };

/**
 * Makes a tape sway in the wind, along its local z. `half` is half its length along x: the sway fades to nothing at
 * both ends, so the tape stays tied to its posts. Returns the same material.
 */
export function withWind<M extends THREE.Material>(material: M, half: number): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uWindHalf = { value: half };
    shader.vertexShader = `uniform float uWindTime;\nuniform float uWindStrength;\nuniform float uWindHalf;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      [
        "#include <begin_vertex>",
        "float windEnds = clamp(1.0 - (position.x * position.x) / (uWindHalf * uWindHalf), 0.0, 1.0);",
        "transformed.z += sin(uWindTime * 2.0 + position.x * 1.7) * 0.05 * uWindStrength * windEnds;",
      ].join("\n"),
    );
  };
  material.customProgramCacheKey = () => "wind";
  return material;
}
