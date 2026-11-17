// One recoloured material per base material and colour, shared by every piece that uses them: the site redraws
// often (a pallet moves, a building grows) and a clone per piece and per change would pile up for nothing.
import * as THREE from "three";

const cache = new Map<string, THREE.MeshStandardMaterial>();

export function tinted(base: THREE.MeshStandardMaterial, color: string): THREE.MeshStandardMaterial {
  const key = `${base.uuid}:${color.toLowerCase()}`;
  let material = cache.get(key);
  if (!material) {
    material = base.clone();
    material.color = new THREE.Color(color);
    cache.set(key, material);
  }
  return material;
}
