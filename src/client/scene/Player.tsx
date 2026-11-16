// The site manager: an ecctrl character, a follow camera behind and above, and the "what am I near" check.
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { useRef } from "react";
import * as THREE from "three";
import { useQuest } from "../store.ts";
import { Piece } from "./kit.tsx";

const NEAR_DISTANCE = 2.5;
const CAMERA_OFFSET = new THREE.Vector3(0, 11, 12);
/** The camera looks a little ahead of the player, so the yards and buildings stay in view. */
const LOOK_AHEAD = new THREE.Vector3(0, 0, -6);

export function Player({ pallets, reduceMotion }: { pallets: { number: number; x: number; z: number }[]; reduceMotion: boolean }) {
  const ref = useRef<EcctrlHandle>(null);
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const setNear = useQuest((s) => s.setNear);
  const cardOpen = useQuest((s) => s.openCard !== null);

  useFrame(({ camera }, delta) => {
    const h = ref.current;
    if (!h) return;
    const pos = h.currPos;
    const k = reduceMotion ? 1 : 1 - Math.exp(-4 * delta);
    camera.position.lerp(target.current.copy(pos).add(CAMERA_OFFSET), k);
    look.current.lerp(target.current.copy(pos).add(LOOK_AHEAD), k);
    camera.lookAt(look.current);

    let best: number | null = null;
    let bestD = NEAR_DISTANCE;
    for (const p of pallets) {
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < bestD) { bestD = d; best = p.number; }
    }
    setNear(best);
  });

  return (
    <Ecctrl ref={ref} position={[0, 2, 2]} capsuleHalfHeight={0.55} capsuleRadius={0.32} floatHeight={0.25} enable={!cardOpen} maxWalkVel={4} maxRunVel={7}>
      <Piece name="worker" position={[0, -1.12, 0]} outline={0.025} />
    </Ecctrl>
  );
}
