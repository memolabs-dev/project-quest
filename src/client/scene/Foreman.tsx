// The site manager's body: KayKit's Knight turned foreman (scripts/blender/foreman.py), animated from the
// character controller's state: idle, walking, running, jumping.
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

const URL = "/models/foreman.glb";
const HEIGHT = 1.85;
const FADE = 0.2;

type Clip = "Unarmed_Idle" | "Walking_A" | "Running_A" | "Jump_Full_Short";

export function Foreman({ body, feetY }: { body: RefObject<EcctrlHandle | null>; feetY: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions } = useAnimations(animations, group);
  const current = useRef<Clip | null>(null);

  // Scale the model to a human height and stand it on the capsule's feet.
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y;
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return h > 0 ? HEIGHT / h : 1;
  }, [scene]);

  const play = (clip: Clip) => {
    if (current.current === clip) return;
    const next = actions[clip];
    if (!next) return;
    next.reset().fadeIn(FADE).play();
    if (current.current) actions[current.current]?.fadeOut(FADE);
    current.current = clip;
  };

  useFrame(() => {
    const h = body.current;
    // Actions are bound to the group: wait until it is mounted, or the first clip binds to nothing.
    if (!h || !group.current) return;
    if (!h.isOnGround && h.verticalSpeed > 0.5) play("Jump_Full_Short");
    else if (h.isMoving && h.runActive) play("Running_A");
    else if (h.isMoving && h.moveSpeed > 0.4) play("Walking_A");
    else play("Unarmed_Idle");
  });

  return (
    <group ref={group} position={[0, feetY, 0]} scale={scale} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
