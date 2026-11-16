// The Blender-made site kit, and a component that draws one piece of it with the comic-strip outline.
// Pieces sit at the origin of the file; each mesh keeps its world matrix, which carries the meshopt dequantization.
import { Outlines, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

const KIT_URL = "/models/site-kit.glb";
export type KitPiece = "pallet" | "floor_module" | "zone_sign" | "crane" | "fence" | "site_office" | "worker";


export function Piece({ name, crateColor, outline = 0.045, ...props }: { name: KitPiece; crateColor?: string; outline?: number } & ThreeElements["group"]) {
  const { scene } = useGLTF(KIT_URL);
  const meshes = useMemo(() => {
    const root = scene.getObjectByName(name);
    if (!root) return [];
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        let material = m.material as THREE.MeshStandardMaterial;
        if (crateColor && material.name === "crate") {
          material = material.clone();
          material.color = new THREE.Color(crateColor);
        }
        list.push({ geometry: m.geometry, material, matrix: m.matrixWorld.clone() });
      }
    });
    return list;
  }, [scene, name, crateColor]);
  return (
    <group {...props}>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} material={m.material} matrix={m.matrix} matrixAutoUpdate={false} castShadow receiveShadow>
          {outline > 0 && <Outlines thickness={outline} color="#1c1c1c" />}
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload(KIT_URL);
