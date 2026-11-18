// The site manager: an ecctrl character, a follow camera behind and above, and the "what am I near" check.
import { Html, useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { useJoystickStore } from "ecctrl/input";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { holdsKeys, useQuest } from "../store.ts";
import { Foreman } from "./Foreman.tsx";
import { badgeInitial } from "./show.ts";
import { CAMERA_OFFSET as CAMERA_OFFSET_XYZ, LOOK_AHEAD as LOOK_AHEAD_XYZ, SPAWN } from "./layout.ts";
import { cameraKick } from "../moments/camera.ts";
import { lastInput, playerPosition } from "../moments/player.ts";
import { nearestWorker } from "./people.ts";
import { talkAt, type TalkTarget } from "../talk.ts";
import type { Visitor } from "./show.ts";
import { kickAt } from "../moments/play.ts";
import { useGameSound } from "./useGameSound.ts";

/** A footstep every stride (metres): about two to three a second walking. */
const STEP_EVERY = 1.4;

const NEAR_DISTANCE = 2.5;
const CAMERA_OFFSET = new THREE.Vector3(...CAMERA_OFFSET_XYZ);
/** The camera looks a little ahead of the player, so the yards and buildings stay in view. */
const LOOK_AHEAD = new THREE.Vector3(...LOOK_AHEAD_XYZ);

export function Player({ pallets, workers, visitors, radioAt, reduceMotion, body, arrival, look }: {
  pallets: { number: number; x: number; z: number }[];
  /** The workers' spots: the nearest within reach can be cheered. */
  workers: { login: string; x: number; z: number; pallet: number }[];
  /** Newcomers waiting at the office: one within reach can be welcomed. */
  visitors: Visitor[];
  /** The radio set's spot on the ground (x, z). */
  radioAt: [number, number];
  reduceMotion: boolean;
  body: RefObject<EcctrlHandle | null>;
  /** Seconds left of the arrival fly-over; the camera is the drone's until it reaches zero. */
  arrival: RefObject<number>;
  look: RefObject<THREE.Vector3>;
}) {
  const ref = body;
  const target = useRef(new THREE.Vector3());
  // The smoothed follow position, kept apart so a moment's kick never builds into it.
  const follow = useRef<THREE.Vector3 | null>(null);
  const sound = useGameSound();
  const walked = useRef({ x: NaN, z: NaN, since: 0 });
  const setNear = useQuest((s) => s.setNear);
  const setNearWorker = useQuest((s) => s.setNearWorker);
  const setNearTalk = useQuest((s) => s.setNearTalk);
  // A card or a dialog over the site holds the keys: the foreman stands still (typed words never walk him).
  const cardOpen = useQuest(holdsKeys);
  const setNearRadio = useQuest((s) => s.setNearRadio);
  const setArrived = useQuest((s) => s.setArrived);
  const sendEvent = useQuest((s) => s.sendEvent);
  // The Apprentice's first reward: their initial on the helmet.
  const helmet = useQuest((s) => (s.levels?.unlocks.helmet ? badgeInitial(s.levels.login) : null));
  // ecctrl 2 does not read the keyboard itself: the keys are handed to it every frame.
  const [, getKeys] = useKeyboardControls();

  useFrame(({ camera, clock }, delta) => {
    const h = ref.current;
    if (!h) return;
    // Footsteps every 0.45 m walked on the ground, quicker when running.
    const w = walked.current;
    if (h.isOnGround && h.isMoving && Number.isFinite(w.x)) {
      w.since += Math.hypot(h.currPos.x - w.x, h.currPos.z - w.z);
      if (w.since >= (h.runActive ? STEP_EVERY * 1.3 : STEP_EVERY)) { w.since = 0; sound.current?.play("step", { rate: h.runActive ? 1.15 : 0.95 }); }
    }
    w.x = h.currPos.x;
    w.z = h.currPos.z;
    playerPosition.x = h.currPos.x;
    playerPosition.z = h.currPos.z;
    if (h.isMoving) lastInput.at = performance.now();
    // Words typed in any field (a visit's repository name, for one) never walk him either.
    const typing = document.activeElement instanceof HTMLElement && document.activeElement.closest("input, textarea, select") !== null;
    // On a phone, the on-screen joystick walks him too (ecctrl reads it as an analog stick).
    const stick = useJoystickStore.getState().joysticks.default;
    h.setMovement(cardOpen || typing ? {} : stick?.active ? { ...getKeys(), joystick: { x: stick.x, y: stick.y } } : getKeys());
    if (h.isMoving && h.moveSpeed > 0.4) sendEvent("walked"); // the store sends it once
    const pos = h.currPos;
    if (arrival.current <= 0) {
      setArrived(); // the store keeps it once
      const k = reduceMotion ? 1 : 1 - Math.exp(-4 * delta);
      follow.current ??= camera.position.clone();
      follow.current.lerp(target.current.copy(pos).add(CAMERA_OFFSET), k);
      // A moment's kick: a short dip on top of the follow position, fading by itself (never with reduced motion).
      camera.position.copy(follow.current);
      camera.position.y -= kickAt(clock.elapsedTime - cameraKick.started, cameraKick.strength);
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
    setNearWorker(nearestWorker(workers, pos));
    // Someone to talk to: a visitor within reach (the lead's signs only).
    let talk: TalkTarget | null = null;
    let talkD = NEAR_DISTANCE;
    for (const v of visitors) {
      const d = Math.hypot(v.spot.x - pos.x, v.spot.z - pos.z);
      if (d < talkD) { talkD = d; talk = { kind: "welcome", number: v.number, login: v.spot.login, pallet: null }; }
    }
    // Else the nearest pallet within reach that shows a sign (a neighbour without one never hides it).
    if (!talk) {
      const people = useQuest.getState().site?.people;
      let bestSign = NEAR_DISTANCE;
      for (const p of pallets) {
        const d = Math.hypot(p.x - pos.x, p.z - pos.z);
        const here = d < bestSign ? talkAt(people, p.number)[0] : undefined;
        if (here) { bestSign = d; talk = here; }
      }
    }
    setNearTalk(talk);
    // The radio set: it takes the E key only when it is nearer than any pallet or visitor.
    const radioD = Math.hypot(radioAt[0] - pos.x, radioAt[1] - pos.z);
    setNearRadio(radioD < NEAR_DISTANCE && radioD < Math.min(bestD, talkD));
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
