// A contributor on the site: the foreman's body in their trade's jacket, their GitHub avatar on a badge. They live at
// their own rhythm (living site spec, section 4): at work on their crate, or changing gesture every 4 to 9 seconds;
// near the foreman they turn their head and, once per visit, wave with their name showing. Nothing goes to GitHub.
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { playerPosition } from "../moments/player.ts";
import { headTurn } from "./head.ts";
import { toonOf } from "./toon.ts";
import { type ClipPlan, greeting, headYaw, nextClip } from "./people.ts";
import { badgeInitial, idleOffset, jacketColor, type WorkerSpot } from "./show.ts";

const URL = "/models/foreman.glb";
const HEIGHT = 1.7;
const FACING = -Math.PI / 5;
const FADE = 0.35;
const NAME_SECONDS = 3;

/** One visit's greetings, shared by every worker on the site. */
const visit = { greeted: new Set<string>() };

function Badge({ login, avatarUrl, color, named }: { login: string; avatarUrl: string; color: string; named: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="worker-tag">
      <div className="worker-badge" style={{ borderColor: color }} title={login}>
        {avatarUrl && !failed
          ? <img src={avatarUrl} alt={login} width={28} height={28} onError={() => setFailed(true)} />
          : <span aria-label={login}>{badgeInitial(login)}</span>}
      </div>
      {named && <span className="worker-name">{login}</span>}
    </div>
  );
}

export function Worker({ spot, lively, reduceMotion }: { spot: WorkerSpot; lively: boolean; reduceMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const color = jacketColor(spot.trade);
  const [named, setNamed] = useState(false);

  // Each worker needs its own skeleton, and its own jacket material.
  const { body, scale } = useMemo(() => {
    const body = clone(scene);
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === "jacket") {
        const jacket = mat.clone();
        jacket.color = new THREE.Color(color);
        m.material = toonOf(jacket);
      } else m.material = toonOf(mat);
    });
    const box = new THREE.Box3().setFromObject(body);
    const h = box.max.y - box.min.y;
    return { body, scale: h > 0 ? HEIGHT / h : 1 };
  }, [scene, color]);

  // The mixer's root is the body, which lives as long as the worker: the group is remade when their crate moves.
  const { actions } = useAnimations(animations, body);
  // The head bone, turned each frame on top of the pose the mixer gave it.
  const head = useRef<ReturnType<typeof headTurn> | null>(null);
  useEffect(() => {
    const bone = body.getObjectByName("head");
    head.current = bone ? headTurn(bone) : null;
  }, [body]);
  const clips = useRef<ClipPlan>({ step: 0, left: idleOffset(spot.login) * 4, gesture: null, wave: 0 });
  const plan = useRef({ clip: "" as string, nameLeft: 0, yaw: 0 });

  const play = (clip: string) => {
    const p = plan.current;
    const next = actions[clip];
    if (!next) return;
    if (p.clip === clip && next.isRunning()) return;
    next.reset().fadeIn(FADE).play();
    if (p.clip && p.clip !== clip) actions[p.clip]?.fadeOut(FADE);
    p.clip = clip;
    if (group.current) group.current.userData.clip = clip;
  };

  // Before the mixer: the head back to the animation's pose, without last frame's turn.
  useFrame(() => head.current?.restore(), -1);

  useFrame((_, delta) => {
    if (!group.current) return;
    const p = plan.current;
    // A wave plays once, then the worker goes back to what they were doing.
    play(nextClip(clips.current, { busy: spot.busy, lively, login: spot.login, delta }));
    // Near the foreman: the name (and once per visit a wave), the head turned toward him.
    const distance = Math.hypot(playerPosition.x - spot.x, playerPosition.z - spot.z);
    const greet = lively ? greeting(visit, spot.login, distance, reduceMotion) : null;
    if (greet === "wave" && actions.Interact) clips.current.wave = actions.Interact.getClip().duration;
    if (greet) p.nameLeft = NAME_SECONDS;
    else p.nameLeft = Math.max(0, p.nameLeft - delta);
    const show = p.nameLeft > 0;
    if (show !== named) setNamed(show);
  });

  // After the mixer has posed the skeleton this frame: the head turns, damped, toward the foreman.
  useFrame((_, delta) => {
    if (!head.current) return;
    const target = lively ? headYaw({ x: spot.x, z: spot.z, facing: FACING }, playerPosition, reduceMotion) : 0;
    easing.damp(plan.current, "yaw", target, 0.25, delta);
    head.current.apply(plan.current.yaw);
  });

  return (
    // A fixed body does not follow a new position: a new place makes a new body, so the worker follows their crate.
    <RigidBody key={`${spot.x}:${spot.z}`} type="fixed" colliders={false} position={[spot.x, 0, spot.z]} name={`worker-${spot.login}`}>
      <CuboidCollider args={[0.3, 0.85, 0.3]} position={[0, 0.85, 0]} />
      <group ref={group} scale={scale} rotation-y={FACING} dispose={null} name={`worker-${spot.login}`}>
        <primitive object={body} />
      </group>
      <Html position={[0, HEIGHT + 0.45, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        <Badge key={spot.avatarUrl} login={spot.login} avatarUrl={spot.avatarUrl} color={color} named={named} />
      </Html>
    </RigidBody>
  );
}
