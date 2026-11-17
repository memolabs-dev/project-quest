// The drawn look (living site spec, section 5): flat comic shading with three tones (light, shadow, deep shadow)
// on the kit, the foreman and the workers. One toon material per source material, shared like the tinted ones.
import * as THREE from "three";

let ramp: THREE.DataTexture | null = null;

/** The three tones, without smoothing between them: that is what makes the shading flat. */
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const tones = [115, 191, 255];
  const data = new Uint8Array(tones.flatMap((v) => [v, v, v, 255]));
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

/** The toon version of a standard material, with its colour and texture; any other material is left alone. */
export function toonOf(base: THREE.Material): THREE.Material {
  if (!(base as THREE.MeshStandardMaterial).isMeshStandardMaterial) return base;
  const hit = cache.get(base.uuid);
  if (hit) return hit;
  const b = base as THREE.MeshStandardMaterial;
  const toon = new THREE.MeshToonMaterial({
    name: b.name, color: b.color.clone(), map: b.map, transparent: b.transparent, opacity: b.opacity, side: b.side,
    gradientMap: toonRamp(),
  });
  cache.set(base.uuid, toon);
  return toon;
}
