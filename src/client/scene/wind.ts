// The wind on the yard tapes (living site spec, section 5): a sway added to the vertex shader, no new dependency.
// One shared clock for every material that sways; the site ticks it once per frame, and sets the strength to 0
// with reduced motion.
import type * as THREE from "three";

export const windUniforms = { uWindTime: { value: 0 }, uWindStrength: { value: 1 } };

/** Makes the material sway in the wind, along its local z, more where it is far along x. Returns the same material. */
export function withWind<M extends THREE.Material>(material: M): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.vertexShader = `uniform float uWindTime;\nuniform float uWindStrength;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed.z += sin(uWindTime * 2.0 + position.x * 1.7) * 0.05 * uWindStrength;",
    );
  };
  material.customProgramCacheKey = () => "wind";
  return material;
}
