// A pallet: crate in its zone's colour, sized by the task, with the issue number painted on two sides. Its body sits
// where the board says; its visible crate travels there: an arc and a landing when it moves, a fall when it arrives,
// a fold when it is cleared, a shake when GitHub refused (living site spec, 3.2). With reduced motion it is placed.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import type { Pallet as PalletModel } from "../../shared/site.ts";
import { arc, shake, squash } from "../moments/curves.ts";
import { useQuest } from "../store.ts";
import { Piece } from "./kit.tsx";
import { crateScale } from "./show.ts";
import { paintedNumber } from "./textures.ts";

const SECONDS = { move: 0.42, fall: 0.55, fold: 0.25, shake: 0.3 } as const;
type Anim = { kind: keyof typeof SECONDS; t: number; dx: number; dz: number };

export function Pallet({ pallet, x, z, color, near, reduceMotion }: {
  pallet: PalletModel; x: number; z: number; color: string; near: boolean; reduceMotion: boolean;
}) {
  const open = useQuest((s) => s.open);
  const motion = useQuest((s) => s.motions[pallet.number]);
  const s = crateScale(pallet.size);
  const number = useMemo(() => paintedNumber(`#${pallet.number}`), [pallet.number]);
  const crate = useRef<THREE.Group>(null);
  const anim = useRef<Anim | null>(null);
  const was = useRef({ x, z });
  const seen = useRef(motion?.at ?? 0);

  // Moved on the board: the crate starts from where it stood and travels to its new place.
  useEffect(() => {
    const dx = was.current.x - x;
    const dz = was.current.z - z;
    was.current = { x, z };
    if ((dx || dz) && !reduceMotion) anim.current = { kind: "move", t: 0, dx, dz };
  }, [x, z, reduceMotion]);

  // Its own moments: arrived (falls), cleared (folds), refused (shakes).
  useEffect(() => {
    if (!motion || motion.at === seen.current) return;
    seen.current = motion.at;
    if (reduceMotion) return;
    if (motion.kind === "parcel") anim.current = { kind: "fall", t: 0, dx: 0, dz: 0 };
    if (motion.kind === "cleared") anim.current = { kind: "fold", t: 0, dx: 0, dz: 0 };
    if (motion.kind === "refused") anim.current = { kind: "shake", t: 0, dx: 0, dz: 0 };
  }, [motion, reduceMotion]);

  useFrame((_, delta) => {
    const g = crate.current;
    if (!g) return;
    const a = anim.current;
    // A cleared duplicate stays folded away.
    const gone = pallet.discarded;
    if (!a) {
      g.position.set(0, 0, 0);
      g.scale.set(1, gone ? 0 : 1, 1);
      return;
    }
    a.t = Math.min(1, a.t + delta / SECONDS[a.kind]);
    g.position.set(0, 0, 0);
    g.scale.set(1, 1, 1);
    if (a.kind === "move") {
      const p = arc(a.t, 0.9);
      g.position.set(a.dx * (1 - p.along), p.up, a.dz * (1 - p.along));
      if (a.t > 0.85) g.scale.y = squash((a.t - 0.85) / 0.15);
    }
    if (a.kind === "fall") {
      const k = a.t < 0.7 ? a.t / 0.7 : 1;
      g.position.y = 6 * (1 - k * k);
      if (a.t >= 0.7) g.scale.y = squash((a.t - 0.7) / 0.3);
    }
    if (a.kind === "fold") g.scale.set(1 - a.t, 1 - a.t, 1 - a.t);
    if (a.kind === "shake") g.position.x = shake(a.t) * 0.12;
    if (a.t >= 1) anim.current = null;
  });

  return (
    <RigidBody type="fixed" colliders="cuboid" position={[x, 0, z]}>
      <group ref={crate}>
        <group scale={s} onClick={(e) => { e.stopPropagation(); open(pallet.number); }}>
          <Piece name="pallet" crateColor={color} outline={near ? 0.09 : 0.045} />
          {[0.435, -0.435].map((zf) => (
            <mesh key={zf} position={[0, 0.58, zf]} rotation-y={zf < 0 ? Math.PI : 0}>
              <planeGeometry args={[0.66, 0.33]} />
              <meshBasicMaterial map={number} transparent toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
            </mesh>
          ))}
        </group>
      </group>
      {near && (
        <Html position={[0, 1.3 * s, 0]} center zIndexRange={[6, 0]}>
          <div className="near-tag">#{pallet.number}</div>
        </Html>
      )}
    </RigidBody>
  );
}
