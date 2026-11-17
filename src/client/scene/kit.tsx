// The Blender-made site kit, and a component that draws one piece of it with the comic-strip outline.
// Pieces sit at the origin of the file; each mesh keeps its world matrix, which carries the meshopt dequantization.
import { Outlines, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { tinted } from "./tint.ts";

const KIT_URL = "/models/site-kit.glb";
export type KitPiece =
  | "pallet" | "floor_module" | "scaffold_module" | "roof" | "zone_sign" | "crane" | "fence" | "site_office" | "worker";

type Props = {
  name: KitPiece;
  /** Material name -> colour, e.g. { crate: "#3E9B5F" } or { wall: "#F2E3C6", roof: "#B5523B" }. */
  recolor?: Record<string, string>;
  crateColor?: string;
  outline?: number;
} & ThreeElements["group"];

export function Piece({ name, recolor, crateColor, outline = 0.045, ...props }: Props) {
  const { scene } = useGLTF(KIT_URL);
  const key = JSON.stringify({ ...recolor, ...(crateColor ? { crate: crateColor } : {}) });
  const meshes = useMemo(() => {
    const colors = JSON.parse(key) as Record<string, string>;
    const root = scene.getObjectByName(name);
    if (!root) return [];
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        let material = m.material as THREE.MeshStandardMaterial;
        const color = colors[material.name];
        if (color) material = tinted(material, color);
        list.push({ geometry: m.geometry, material, matrix: m.matrixWorld.clone() });
      }
    });
    return list;
  }, [scene, name, key]);
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
