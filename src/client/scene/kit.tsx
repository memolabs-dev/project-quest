// The Blender-made site kit, and components that draw one piece of it, or a row of it, with the comic-strip outline.
// Pieces sit at the origin of the file; each mesh keeps its world matrix, which carries the meshopt dequantization.
import { Outlines, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { tinted } from "./tint.ts";
import { toonOf } from "./toon.ts";

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

type KitMesh = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 };

/** A kit piece's meshes, in toon materials recoloured by material name; each keeps its matrix in the file. */
function usePieceMeshes(name: KitPiece, recolor?: Record<string, string>, crateColor?: string): KitMesh[] {
  const { scene } = useGLTF(KIT_URL);
  const key = JSON.stringify({ ...recolor, ...(crateColor ? { crate: crateColor } : {}) });
  return useMemo(() => {
    const colors = JSON.parse(key) as Record<string, string>;
    const root = scene.getObjectByName(name);
    if (!root) return [];
    const list: KitMesh[] = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        const base = m.material as THREE.MeshStandardMaterial;
        const color = colors[base.name];
        const material = toonOf(color ? tinted(base, color) : base);
        list.push({ geometry: m.geometry, material, matrix: m.matrixWorld.clone() });
      }
    });
    return list;
  }, [scene, name, key]);
}

export function Piece({ name, recolor, crateColor, outline = 0.045, ...props }: Props) {
  const meshes = usePieceMeshes(name, recolor, crateColor);
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

const placed = new THREE.Matrix4();

/** One instanced mesh per mesh of the piece: the same piece repeated along x costs as many draws as one piece. */
function RowMesh({ mesh, xs, z, outline }: { mesh: KitMesh; xs: number[]; z: number; outline: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    xs.forEach((x, i) => row.setMatrixAt(i, placed.makeTranslation(x, 0, z).multiply(mesh.matrix)));
    row.instanceMatrix.needsUpdate = true;
  }, [xs, z, mesh]);
  return (
    <instancedMesh ref={ref} args={[mesh.geometry, mesh.material, xs.length]} castShadow receiveShadow frustumCulled={false}>
      {outline > 0 && <Outlines thickness={outline} color="#1c1c1c" />}
    </instancedMesh>
  );
}

/** A kit piece repeated at each x of `xs`, on the line `z`: the fence along the road. */
export function PieceRow({ name, xs, z, outline = 0.045 }: { name: KitPiece; xs: number[]; z: number; outline?: number }) {
  const meshes = usePieceMeshes(name);
  // Keyed by the count: an instanced mesh's capacity is fixed when it is made.
  return <>{meshes.map((m, i) => <RowMesh key={`${i}:${xs.length}`} mesh={m} xs={xs} z={z} outline={outline} />)}</>;
}

useGLTF.preload(KIT_URL);
