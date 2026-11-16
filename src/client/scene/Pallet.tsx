// A pallet: crate in its zone's colour, sized by the task, with the issue number painted on two sides.
import { Html } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import type { Pallet as PalletModel } from "../../shared/site.ts";
import { useQuest } from "../store.ts";
import { Piece } from "./kit.tsx";
import { crateScale } from "./show.ts";
import { paintedNumber } from "./textures.ts";

export function Pallet({ pallet, x, z, color, near }: { pallet: PalletModel; x: number; z: number; color: string; near: boolean }) {
  const open = useQuest((s) => s.open);
  const s = crateScale(pallet.size);
  const number = useMemo(() => paintedNumber(`#${pallet.number}`), [pallet.number]);
  return (
    <RigidBody type="fixed" colliders="cuboid" position={[x, 0, z]}>
      <group scale={s} onClick={(e) => { e.stopPropagation(); open(pallet.number); }}>
        <Piece name="pallet" crateColor={color} outline={near ? 0.09 : 0.045} />
        {[0.435, -0.435].map((zf) => (
          <mesh key={zf} position={[0, 0.58, zf]} rotation-y={zf < 0 ? Math.PI : 0}>
            <planeGeometry args={[0.66, 0.33]} />
            <meshBasicMaterial map={number} transparent toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        ))}
      </group>
      {near && (
        <Html position={[0, 1.3 * s, 0]} center zIndexRange={[6, 0]}>
          <div className="near-tag">#{pallet.number}</div>
        </Html>
      )}
    </RigidBody>
  );
}
