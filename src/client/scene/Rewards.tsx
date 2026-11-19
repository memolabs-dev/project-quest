// The lead's rewards on the team site (lead's path spec, section 8): the sprint truck by the road while a sprint runs,
// the mayor's ribbon with the date of her next visit, the radio mast broadcasting the last bulletin. Plain boxes.
// A crate loaded into the sprint hops onto the truck's bed (living site spec, 3.2).
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type * as THREE from "three";
import { teamRewards } from "../levels.ts";
import { arc, squash } from "../moments/curves.ts";
import { useQuest } from "../store.ts";
import { Piece } from "./kit.tsx";

const NONE = { truck: null, ribbon: null, mast: null };

export function Box({ size, position, color }: { size: [number, number, number]; position: [number, number, number]; color: string }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function TeamRewards({ truckAt, ribbonAt, mastAt }: {
  truckAt: [number, number, number]; ribbonAt: [number, number, number]; mastAt: [number, number, number];
}) {
  const { t } = useTranslation();
  // Select stable references, then derive: a selector that builds a new object re-renders forever.
  const levels = useQuest((s) => s.levels);
  const kind = useQuest((s) => s.siteKind);
  const rewards = levels ? teamRewards(levels, kind) : NONE;
  return (
    <>
      {rewards.truck && (
        <group position={truckAt}>
          <Box size={[2.6, 0.5, 1.3]} position={[0, 0.55, 0]} color="#3D6E9E" />
          <Box size={[0.9, 0.9, 1.3]} position={[1.3, 1.05, 0]} color="#E8483B" />
          <Box size={[1.6, 0.5, 1.1]} position={[-0.35, 1.05, 0]} color="#C8A26B" />
          {[[-0.8, 0.65], [-0.8, -0.65], [1.1, 0.65], [1.1, -0.65]].map(([x, z]) => (
            <Box key={`${x}${z}`} size={[0.5, 0.5, 0.15]} position={[x, 0.25, z]} color="#2B2B2B" />
          ))}
          <Html position={[0, 2.1, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
            <div className="sign-label reward-label">
              {t("rewards.truck", { sprint: rewards.truck.title, points: rewards.truck.points, capacity: rewards.truck.capacity ?? "?" })}
            </div>
          </Html>
        </group>
      )}
      {rewards.mast && (
        <group position={mastAt}>
          <Box size={[0.14, 4.2, 0.14]} position={[0, 2.1, 0]} color="#B9B2A6" />
          <Box size={[0.9, 0.08, 0.08]} position={[0, 3.6, 0]} color="#B9B2A6" />
          <Box size={[0.6, 0.08, 0.08]} position={[0, 3.95, 0]} color="#B9B2A6" />
          <Box size={[0.22, 0.22, 0.22]} position={[0, 4.3, 0]} color="#E8483B" />
          <Html position={[0, 4.9, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
            <div className="sign-label reward-label">
              {/* A status update posted on GitHub without a status shows its words only. */}
              {rewards.mast.status
                ? t("rewards.mast", { status: t(`team.bulletin.statuses.${rewards.mast.status}`), line: rewards.mast.line })
                : rewards.mast.line}
            </div>
          </Html>
        </group>
      )}
      {rewards.ribbon && (
        <group position={ribbonAt}>
          <Box size={[0.12, 1.6, 0.12]} position={[-1, 0.8, 0]} color="#F7F2E8" />
          <Box size={[0.12, 1.6, 0.12]} position={[1, 0.8, 0]} color="#F7F2E8" />
          <Box size={[2, 0.18, 0.04]} position={[0, 1.25, 0]} color="#E8483B" />
          <Html position={[0, 2, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
            <div className="sign-label reward-label">{t("rewards.ribbon", { title: rewards.ribbon.title, date: rewards.ribbon.dueOn })}</div>
          </Html>
        </group>
      )}
    </>
  );
}

/** Where the crate lands on the truck, from the truck's own place: the top of its load. */
const BED: [number, number, number] = [-0.35, 1.3, 0];
const HOP_SECONDS = 0.6;
/** The share of the hop spent in the air; the rest is the landing's squash. */
const AIR = 0.85;
const SIZE = 0.55;

type Flight = { kind: "loaded" | "overloaded"; pallet: number; from: [number, number]; t: number; landed: boolean };

/** Moves the flying crate along its hop; returns true the frame it lands. */
function fly(g: THREE.Group, f: Flight, bed: [number, number], delta: number): boolean {
  f.t = Math.min(1, f.t + delta / HOP_SECONDS);
  const p = arc(Math.min(1, f.t / AIR), 2.2);
  const [fx, fz] = f.from;
  g.position.set(fx + (bed[0] - fx) * p.along, BED[1] * p.along + p.up, fz + (bed[1] - fz) * p.along);
  g.scale.set(SIZE, f.t > AIR ? SIZE * squash((f.t - AIR) / (1 - AIR)) : SIZE, SIZE);
  if (f.t < AIR || f.landed) return false;
  f.landed = true;
  return true;
}

/**
 * The sprint truck's moment: a copy of the loaded crate hops from its pallet onto the bed, and the thud (or the creak
 * when the load passes the capacity) plays as it lands; the pallet stays where the board says. With reduced motion
 * nothing hops: the sound plays at once.
 */
export function TruckHop({ truckAt, fromOf, colorOf, reduceMotion }: {
  truckAt: [number, number, number];
  fromOf(pallet: number): [number, number] | null;
  colorOf(pallet: number): string;
  reduceMotion: boolean;
}) {
  const hop = useQuest((s) => s.hop);
  const announce = useQuest((s) => s.announce);
  // Only hops announced after the scene opened: an old one never replays.
  const seen = useRef(useQuest.getState().hop?.at ?? 0);
  // The crate in the air: its course lives in a ref, read each frame; the crate is hidden between hops.
  const flight = useRef<Flight | null>(null);
  const crate = useRef<THREE.Group>(null);
  const bed: [number, number] = [truckAt[0] + BED[0], truckAt[2] + BED[2]];

  // Where things stand when a hop starts: a new layout never restarts a hop already in the air.
  const now = useRef({ fromOf, bed, reduceMotion });
  useLayoutEffect(() => { now.current = { fromOf, bed, reduceMotion }; });

  useLayoutEffect(() => {
    if (!hop || hop.at <= seen.current) return;
    seen.current = hop.at;
    const w = now.current;
    const from = w.fromOf(hop.pallet);
    if (w.reduceMotion || !from) {
      announce({ kind: hop.kind, pallet: hop.pallet, spot: w.bed, landed: true });
      return;
    }
    flight.current = { kind: hop.kind, pallet: hop.pallet, from, t: 0, landed: false };
  }, [hop, announce]);

  useFrame((_, delta) => {
    const g = crate.current;
    const f = flight.current;
    if (!g) return;
    g.visible = f !== null;
    if (!f) return;
    if (fly(g, f, bed, delta)) announce({ kind: f.kind, pallet: f.pallet, spot: bed, landed: true });
    if (f.t >= 1) flight.current = null;
  });

  return (
    <group ref={crate} name="truck-hop" visible={false}>
      {hop && <Piece name="pallet" crateColor={colorOf(hop.pallet)} />}
    </group>
  );
}
