// What keeps the site alive without hiding anything: the crane turning, dust under the foreman's boots,
// termites on open bugs, the wind and the birds, and the drone's fly-over when the site opens. Reduced motion keeps
// none of the motion.
import { useFrame, useThree } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Piece } from "./kit.tsx";
import { FLOCK, flockAt } from "./birds.ts";
import { dronePose, type CameraPose, type TermiteSpot } from "./show.ts";
import { windUniforms } from "./wind.ts";

export function TurningCrane({ position, reduceMotion }: { position: [number, number, number]; reduceMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && !reduceMotion) ref.current.rotation.y += delta * 0.12;
  });
  return (
    <group ref={ref} position={position} rotation-y={-0.6}>
      <Piece name="crane" />
    </group>
  );
}

const PER_PALLET = 7;
const tmp = new THREE.Object3D();

/** The crate's lid, in the pallet's own units (scripts/blender/site_kit.py: crate top at 0.86, strap 0.88). */
const LID_Y = 0.9;

/** Termites walking in two rings on the lid of each open bug's crate. */
export function Termites({ spots, reduceMotion }: { spots: TermiteSpot[]; reduceMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = spots.length * PER_PALLET;
  const place = (t: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, p) => {
      for (let i = 0; i < PER_PALLET; i++) {
        const outer = i % 2 === 0;
        const r = (outer ? 0.3 : 0.14) * s.scale;
        const a = (i / PER_PALLET) * Math.PI * 2 + t * (outer ? 0.7 : -1.1) + p;
        tmp.position.set(s.x + Math.cos(a) * r, LID_Y * s.scale, s.z + Math.sin(a) * r);
        tmp.rotation.set(Math.PI / 2, 0, -a + (outer ? 0 : Math.PI));
        tmp.scale.setScalar(1); // tmp is shared with the dust, which shrinks it
        tmp.updateMatrix();
        mesh.setMatrixAt(p * PER_PALLET + i, tmp.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => place(0));
  useFrame(({ clock }) => {
    if (!reduceMotion) place(clock.elapsedTime);
  });
  if (count === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
      <capsuleGeometry args={[0.04, 0.11, 2, 6]} />
      <meshStandardMaterial color="#24140A" roughness={0.5} />
    </instancedMesh>
  );
}

const PUFFS = 14;
const PUFF_LIFE = 0.6;

/** Dust puffs left behind the foreman's feet while he walks, more when he runs. */
export function Dust({ body, reduceMotion }: { body: RefObject<EcctrlHandle | null>; reduceMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffsRef = useRef(Array.from({ length: PUFFS }, () => ({ age: PUFF_LIFE, x: 0, z: 0 })));
  const state = useRef({ next: 0, since: 0 });
  useFrame((_, delta) => {
    const mesh = ref.current;
    const h = body.current;
    if (!mesh || !h || reduceMotion) return;
    const s = state.current;
    s.since += delta;
    const every = h.runActive ? 0.06 : 0.12;
    if (h.isOnGround && h.isMoving && h.moveSpeed > 0.4 && s.since > every) {
      s.since = 0;
      const p = puffsRef.current[s.next];
      s.next = (s.next + 1) % PUFFS;
      p.age = 0;
      p.x = h.currPos.x + (Math.random() - 0.5) * 0.3;
      p.z = h.currPos.z + (Math.random() - 0.5) * 0.3;
    }
    puffsRef.current.forEach((p, i) => {
      p.age = Math.min(PUFF_LIFE, p.age + delta);
      const k = p.age / PUFF_LIFE;
      const size = k >= 1 ? 0 : 0.05 + Math.sin(k * Math.PI) * 0.11;
      tmp.position.set(p.x, 0.06 + k * 0.2, p.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(size);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (reduceMotion) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#E2C9A0" roughness={1} transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  );
}

export const ARRIVAL_SECONDS = 3;

/**
 * The drone's fly-over when the site opens. `left` is shared with the Player, which leaves the camera alone
 * while it is above zero. Any key, click or touch ends it at once.
 */
export function Arrival({ leftRef, lookRef, siteWidth, end }: {
  leftRef: RefObject<number>; lookRef: RefObject<THREE.Vector3>; siteWidth: number; end: CameraPose;
}) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const skip = () => { leftRef.current = 0; };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [leftRef]);
  useFrame((_, delta) => {
    if (leftRef.current <= 0) return;
    // The first frames after loading can last seconds (shader compilation): never skip the flight in one step.
    leftRef.current = Math.max(0, leftRef.current - Math.min(delta, 1 / 20));
    const pose = dronePose(1 - leftRef.current / ARRIVAL_SECONDS, siteWidth, end);
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    // The Player's follow camera starts from this look point, so ending early does not jerk the view.
    camera.lookAt(lookRef.current.set(pose.target[0], pose.target[1], pose.target[2]));
  });
  return null;
}

const BIRD_SEED = 3;

/** The weather: the wind's clock for the swaying tapes, and a flock crossing now and then. Neither with reduced motion. */
export function Weather({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    windUniforms.uWindTime.value = clock.elapsedTime;
    windUniforms.uWindStrength.value = reduceMotion ? 0 : 1;
    const m = ref.current;
    if (!m) return;
    const birds = reduceMotion ? null : flockAt(clock.elapsedTime, BIRD_SEED);
    m.count = birds ? birds.length : 0;
    // No bird in the sky: nothing to send to the GPU.
    if (!birds?.length) return;
    birds.forEach((b, i) => {
      tmp.position.set(b.x, b.y, b.z);
      // Wings across the flight (along z), flapping about the flight axis (x).
      tmp.rotation.set(b.flap * 0.5, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, FLOCK]} frustumCulled={false} name="birds">
      <boxGeometry args={[0.16, 0.04, 0.6]} />
      <meshBasicMaterial color="#3A2A1F" />
    </instancedMesh>
  );
}
