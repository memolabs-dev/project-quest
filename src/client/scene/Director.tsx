// The director: each frame it takes the moments the store announced and plays them: the sound, dust from one pool of
// particles, the camera kick, the foreman's reaction (living site spec, section 3). With reduced motion, only the sound;
// the words stand where the motion was (the building's board says "New floor laid").
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { cameraKick } from "../moments/camera.ts";
import type { Moment } from "../moments/diff.ts";
import { planMoment } from "../moments/play.ts";
import { useQuest } from "../store.ts";
import { useGameSound } from "./useGameSound.ts";

const POOL = 64;
const LIFE = 0.7;
// A slow frame ages dust by one tenth of a second at most: one frame of lag never hides it whole.
const STEP = 0.1;
const tmp = new THREE.Object3D();

type Particle = { age: number; x: number; z: number; vx: number; vz: number; vy: number };

export function Director({ spotOf, reduceMotion }: { spotOf(m: Moment): [number, number] | null; reduceMotion: boolean }) {
  const take = useQuest((s) => s.takeMoments);
  const react = useQuest((s) => s.react);
  const sound = useGameSound();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<Particle[]>(Array.from({ length: POOL }, () => ({ age: LIFE, x: 0, z: 0, vx: 0, vz: 0, vy: 0 })));
  const next = useRef(0);

  const spawn = (x: number, z: number, count: number, ring: boolean) => {
    for (let i = 0; i < count; i++) {
      const p = particles.current[next.current];
      next.current = (next.current + 1) % POOL;
      const a = (i / count) * Math.PI * 2 + (ring ? 0 : Math.random());
      const speed = ring ? 2.4 : 0.8 + Math.random() * 0.6;
      Object.assign(p, { age: 0, x, z, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, vy: ring ? 0.4 : 0.9 });
    }
  };

  useFrame(({ clock }, delta) => {
    for (const m of take()) {
      const plan = planMoment(m, reduceMotion);
      if (plan.sound) sound.current?.play(plan.sound);
      const spot = m.spot ?? spotOf(m);
      if (plan.dust && spot) spawn(spot[0], spot[1], plan.dust === "ring" ? 16 : 8, plan.dust === "ring");
      if (plan.kick) { cameraKick.started = clock.elapsedTime; cameraKick.strength = plan.kick; }
      if (plan.react) react(plan.react);
    }
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, STEP);
    particles.current.forEach((p, i) => {
      p.age = Math.min(LIFE, p.age + dt);
      const k = p.age / LIFE;
      p.x += p.vx * dt * (1 - k);
      p.z += p.vz * dt * (1 - k);
      tmp.position.set(p.x, 0.1 + p.vy * k * (1 - k) * 2, p.z);
      tmp.scale.setScalar(k >= 1 ? 0 : 0.08 + Math.sin(k * Math.PI) * 0.16);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false} name="moment-dust">
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#E2C9A0" roughness={1} transparent opacity={0.6} depthWrite={false} />
    </instancedMesh>
  );
}
