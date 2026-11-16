// The site manager: an ecctrl character, a follow camera behind and above, and the "what am I near" check.
import { Html, useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { useQuest } from "../store.ts";
import { Foreman } from "./Foreman.tsx";
import { badgeInitial } from "./show.ts";
import { CAMERA_OFFSET as CAMERA_OFFSET_XYZ, LOOK_AHEAD as LOOK_AHEAD_XYZ, SPAWN } from "./layout.ts";

const NEAR_DISTANCE = 2.5;
const CAMERA_OFFSET = new THREE.Vector3(...CAMERA_OFFSET_XYZ);
/** The camera looks a little ahead of the player, so the yards and buildings stay in view. */
const LOOK_AHEAD = new THREE.Vector3(...LOOK_AHEAD_XYZ);

export function Player({ pallets, reduceMotion, body, arrival, look }: {
  pallets: { number: number; x: number; z: number }[];
  reduceMotion: boolean;
  body: RefObject<EcctrlHandle | null>;
  /** Seconds left of the arrival fly-over; the camera is the drone's until it reaches zero. */
  arrival: RefObject<number>;
  look: RefObject<THREE.Vector3>;
}) {
  const ref = body;
  const target = useRef(new THREE.Vector3());
  const setNear = useQuest((s) => s.setNear);
  const cardOpen = useQuest((s) => s.openCard !== null);
  const sendEvent = useQuest((s) => s.sendEvent);
  // The Apprentice's first reward: their initial on the helmet.
  const helmet = useQuest((s) => (s.levels?.unlocks.helmet ? badgeInitial(s.levels.login) : null));
  // ecctrl 2 does not read the keyboard itself: the keys are handed to it every frame.
  const [, getKeys] = useKeyboardControls();

  useFrame(({ camera }, delta) => {
    const h = ref.current;
    if (!h) return;
    h.setMovement(cardOpen ? {} : getKeys());
    if (h.isMoving && h.moveSpeed > 0.4) sendEvent("walked"); // the store sends it once
    const pos = h.currPos;
    if (arrival.current <= 0) {
      const k = reduceMotion ? 1 : 1 - Math.exp(-4 * delta);
      camera.position.lerp(target.current.copy(pos).add(CAMERA_OFFSET), k);
      look.current.lerp(target.current.copy(pos).add(LOOK_AHEAD), k);
      camera.lookAt(look.current);
    }

    let best: number | null = null;
    let bestD = NEAR_DISTANCE;
    for (const p of pallets) {
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < bestD) { bestD = d; best = p.number; }
    }
    setNear(best);
  });

  return (
    <Ecctrl ref={ref} position={SPAWN} capsuleHalfHeight={0.55} capsuleRadius={0.32} floatHeight={0.25} enable={!cardOpen} maxWalkVel={4} maxRunVel={7}>
      <Foreman body={ref} feetY={-1.12} />
      {helmet && (
        <Html position={[0, 1.05, 0]} center distanceFactor={10} zIndexRange={[5, 0]}>
          <div className="helmet-badge">{helmet}</div>
        </Html>
      )}
    </Ecctrl>
  );
}
