// The site manager's body: KayKit's Knight turned foreman (scripts/blender/foreman.py), animated from the
// character controller's state: idle, walking, running, jumping.
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { toonOf } from "./toon.ts";
import { useQuest } from "../store.ts";
import { lastInput } from "../moments/player.ts";
import { restState } from "./people.ts";

const URL = "/models/foreman.glb";
const HEIGHT = 1.85;
const FADE = 0.2;

type Clip = "Unarmed_Idle" | "Walking_A" | "Running_A" | "Jump_Full_Short" | "Cheer" | "Interact" | "Sit_Floor_Idle";
const REACTIONS = { cheer: "Cheer", lean: "Interact" } as const;

export function Foreman({ body, feetY }: { body: RefObject<EcctrlHandle | null>; feetY: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions } = useAnimations(animations, group);
  const current = useRef<Clip | null>(null);
  const reaction = useQuest((s) => s.reaction);
  // A reaction plays once, then locomotion takes over again; walking away cuts it short.
  const reacting = useRef<{ clip: Clip; left: number } | null>(null);
  const seen = useRef(reaction?.at ?? 0);
  // Any key, click or touch counts as an input: the foreman wakes at once, and the input is not consumed.
  useEffect(() => {
    const wake = () => { lastInput.at = performance.now(); };
    addEventListener("keydown", wake);
    addEventListener("pointerdown", wake);
    return () => { removeEventListener("keydown", wake); removeEventListener("pointerdown", wake); };
  }, []);

  // Scale the model to a human height and stand it on the capsule's feet.
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.material = toonOf(m.material as THREE.Material);
    });
    return h > 0 ? HEIGHT / h : 1;
  }, [scene]);

  const play = (clip: Clip) => {
    const next = actions[clip];
    if (!next) return;
    // useAnimations stops every action when its effect re-runs (StrictMode does that once at mount),
    // so a clip we started can be stopped behind our back: replay it whenever it is not running.
    if (current.current === clip && next.isRunning()) return;
    next.reset().fadeIn(FADE).play();
    if (current.current && current.current !== clip) actions[current.current]?.fadeOut(FADE);
    current.current = clip;
    // Read by the browser tests: what the foreman is doing now.
    if (group.current) group.current.userData.clip = clip;
  };

  useFrame((_, delta) => {
    const h = body.current;
    // Actions are bound to the group: wait until it is mounted, or the first clip binds to nothing.
    if (!h || !group.current) return;
    if (reaction && reaction.at !== seen.current) {
      seen.current = reaction.at;
      const clip = REACTIONS[reaction.kind];
      const action = actions[clip];
      if (action) {
        // Played once; locomotion fades back in during its last FADE seconds, so the fade ends as the clip does. Waiting
        // for the clip's end would fade from a finished action, which drops to the bind pose for a frame.
        action.setLoop(THREE.LoopOnce, 1);
        reacting.current = { clip, left: Math.max(0, action.getClip().duration - FADE) };
      }
    }
    const r = reacting.current;
    if (r && !h.isMoving) {
      r.left -= delta;
      if (r.left > 0) { play(r.clip); return; }
    }
    reacting.current = null;
    // Nothing pressed for 12 seconds: he sits down; the first key, click or touch makes him stand.
    if (!h.isMoving && restState(lastInput.at, performance.now()) === "rest") { play("Sit_Floor_Idle"); return; }
    if (!h.isOnGround && h.verticalSpeed > 0.5) play("Jump_Full_Short");
    else if (h.isMoving && h.runActive) play("Running_A");
    else if (h.isMoving && h.moveSpeed > 0.4) play("Walking_A");
    else play("Unarmed_Idle");
  });

  return (
    <group ref={group} position={[0, feetY, 0]} scale={scale} dispose={null} name="foreman">
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
