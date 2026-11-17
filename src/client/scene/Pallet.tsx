// A pallet: crate in its zone's colour, sized by the task, with the issue number painted on two sides. Its body sits
// where the board says; its visible crate travels there (living site spec, 3.2): the pallet that moved hops on an arc
// and lands, a neighbour that only shifted a slot slides, a new parcel falls, a cleared duplicate folds away for good,
// a refusal shakes. The thud and the dust come when the crate touches the ground. With reduced motion it is placed.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import type { Pallet as PalletModel } from "../../shared/site.ts";
import { arc, shake, squash } from "../moments/curves.ts";
import { palletAnim, type PalletAnim } from "../moments/pallet.ts";
import { useQuest } from "../store.ts";
import { Piece } from "./kit.tsx";
import { crateScale } from "./show.ts";
import { paintedNumber } from "./textures.ts";

const SECONDS: Record<PalletAnim, number> = { arc: 0.42, slide: 0.22, fall: 0.55, fold: 0.25, shake: 0.3 };
type Anim = { kind: PalletAnim; t: number; dx: number; dz: number; landing: "pallet-moved" | "parcel" | null };

export function Pallet({ pallet, x, z, color, near, reduceMotion, openedAt }: {
  pallet: PalletModel; x: number; z: number; color: string; near: boolean; reduceMotion: boolean;
  /** The moments' count when the scene opened: what was already there never replays. */
  openedAt: number;
}) {
  const open = useQuest((s) => s.open);
  const announce = useQuest((s) => s.announce);
  const motion = useQuest((s) => s.motions[pallet.number]);
  const s = crateScale(pallet.size);
  const number = useMemo(() => paintedNumber(`#${pallet.number}`), [pallet.number]);
  const crate = useRef<THREE.Group>(null);
  const anim = useRef<Anim | null>(null);
  const was = useRef({ x, z });
  const seen = useRef(openedAt);
  // A cleared duplicate is gone once folded: no crate, no collider, nothing to bump into.
  const [folded, setFolded] = useState(pallet.discarded);

  // Before the frame is drawn: the place or the moment changed, so the crate starts its animation from where it stood.
  useLayoutEffect(() => {
    const dx = was.current.x - x;
    const dz = was.current.z - z;
    const moved = dx !== 0 || dz !== 0;
    was.current = { x, z };
    const kind = palletAnim({ moved, motion, seen: seen.current, reduced: reduceMotion });
    const fresh = motion && motion.at > seen.current ? motion.kind : null;
    if (motion) seen.current = Math.max(seen.current, motion.at);
    if (kind) {
      const landing = kind === "arc" ? "pallet-moved" : kind === "fall" ? "parcel" : null;
      anim.current = { kind, t: 0, dx: kind === "arc" || kind === "slide" ? dx : 0, dz: kind === "arc" || kind === "slide" ? dz : 0, landing };
    } else if (fresh === "pallet-moved" || fresh === "parcel") {
      // Placed at once (reduced motion): it lands at once, with its sound.
      announce({ kind: fresh, pallet: pallet.number, spot: [x, z], landed: true });
    }
    if (fresh === "cleared" && !kind) setFolded(true);
  }, [x, z, motion, reduceMotion, announce, pallet.number]);

  useFrame((_, delta) => {
    const g = crate.current;
    const a = anim.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.scale.set(1, 1, 1);
    if (!a) return;
    a.t = Math.min(1, a.t + delta / SECONDS[a.kind]);
    if (a.kind === "arc") {
      const p = arc(a.t, 0.9);
      g.position.set(a.dx * (1 - p.along), p.up, a.dz * (1 - p.along));
      if (a.t > 0.85) g.scale.y = squash((a.t - 0.85) / 0.15);
    }
    if (a.kind === "slide") g.position.set(a.dx * (1 - a.t) * (1 - a.t), 0, a.dz * (1 - a.t) * (1 - a.t));
    if (a.kind === "fall") {
      const k = a.t < 0.7 ? a.t / 0.7 : 1;
      g.position.y = 6 * (1 - k * k);
      if (a.t >= 0.7) g.scale.y = squash((a.t - 0.7) / 0.3);
    }
    if (a.kind === "fold") g.scale.setScalar(1 - a.t);
    if (a.kind === "shake") g.position.x = shake(a.t) * 0.12;
    // Touching the ground: now the thud and the dust, where it landed.
    const touched = (a.kind === "arc" && a.t > 0.85) || (a.kind === "fall" && a.t >= 0.7);
    if (touched && a.landing) {
      announce({ kind: a.landing, pallet: pallet.number, spot: [x, z], landed: true });
      a.landing = null;
    }
    if (a.t >= 1) {
      anim.current = null;
      if (a.kind === "fold") setFolded(true);
    }
  });

  if (folded && pallet.discarded) return null;
  return (
    // A fixed body does not follow a new position prop: a new place makes a new body (the crate's animation lives in
    // this component, so it carries on across the change).
    <RigidBody key={`${x}:${z}`} type="fixed" colliders="cuboid" position={[x, 0, z]}>
      <group ref={crate} name={`crate-${pallet.number}`}>
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
