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
import { greets } from "../moments/greet.ts";
import { playerPosition } from "../moments/player.ts";
import { useQuest } from "../store.ts";
import { WarmPicker } from "../ui/Warm.tsx";
import { GLYPH } from "../ui/warm-gesture.ts";
import { headTurn } from "./head.ts";
import { tinted } from "./tint.ts";
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

export function Worker({ spot, lively, reduceMotion, visitor }: {
  spot: WorkerSpot; lively: boolean; reduceMotion: boolean;
  /** A newcomer with no pallet, waiting at the office: the 👋 bubble, and a click that opens the welcome. */
  visitor?: { welcome(): void };
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const color = jacketColor(spot.trade);
  const [named, setNamed] = useState(false);
  const picking = useQuest((s) => s.picker?.login === spot.login);

  // Each worker needs its own skeleton; the jacket is shared by every worker of the same trade (one toon material).
  const { body, scale } = useMemo(() => {
    const body = clone(scene);
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      m.material = toonOf(mat.name === "jacket" && mat.isMeshStandardMaterial ? tinted(mat, color) : mat);
    });
    const box = new THREE.Box3().setFromObject(body);
    const h = box.max.y - box.min.y;
    return { body, scale: h > 0 ? HEIGHT / h : 1 };
  }, [scene, color]);

  // The cloned skeleton keeps its bones in a texture on the GPU: freed when the worker leaves the site.
  useEffect(() => () => body.traverse((o) => { (o as THREE.SkinnedMesh).skeleton?.dispose(); }), [body]);

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
  // A warm gesture for the pallet they stand by: they answer it (people of the site spec, section 7).
  const greet = useQuest((s) => (greets(s.greet, spot) ? s.greet : null));
  const [shown, setShown] = useState<{ emoji: string; at: number } | null>(null);
  // Only answers given after they appeared: an old one is never replayed (a motion setting changed, a new place).
  const answered = useRef(useQuest.getState().greet?.at ?? 0);
  useEffect(() => {
    if (!greet || greet.at <= answered.current) return;
    answered.current = greet.at;
    const start = setTimeout(() => { if (greet.emoji) setShown({ emoji: GLYPH[greet.emoji], at: greet.at }); }, 0);
    const clear = setTimeout(() => setShown(null), reduceMotion ? 2000 : 1200);
    if (!reduceMotion) {
      const clip = greet.kind === "thanked" ? "Cheer" : "Interact";
      if (actions[clip]) clips.current.answer = { clip, left: actions[clip]!.getClip().duration };
    }
    return () => { clearTimeout(start); clearTimeout(clear); };
  }, [greet, reduceMotion, actions]);

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
    if (greet === "wave" && actions.Interact) {
      clips.current.wave = actions.Interact.getClip().duration;
      // Read by the browser tests: how many waves this worker gave.
      if (group.current) group.current.userData.waves = ((group.current.userData.waves as number | undefined) ?? 0) + 1;
    }
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
    // Read by the browser tests: how far the head turns, and whether a wave is playing.
    if (group.current) Object.assign(group.current.userData, { yaw: plan.current.yaw, waving: clips.current.wave > 0 });
  });

  return (
    // A fixed body does not follow a new position: a new place makes a new body, so the worker follows their crate.
    <RigidBody key={`${spot.x}:${spot.z}`} type="fixed" colliders={false} position={[spot.x, 0, spot.z]} name={`worker-${spot.login}`}>
      <CuboidCollider args={[0.3, 0.85, 0.3]} position={[0, 0.85, 0]} />
      <group ref={group} scale={scale} rotation-y={FACING} dispose={null} name={`worker-${spot.login}`}
        onClick={visitor ? (e) => { e.stopPropagation(); visitor.welcome(); } : undefined}>
        <primitive object={body} />
      </group>
      <Html position={[0, HEIGHT + 0.45, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        {visitor && <div className="talk-bubbles"><div className="talk-bubble"><b aria-hidden="true">👋</b> {spot.login}</div></div>}
        <Badge key={spot.avatarUrl} login={spot.login} avatarUrl={spot.avatarUrl} color={color} named={named} />
        {shown && <span key={shown.at} className={reduceMotion ? "greet-emoji" : "greet-emoji rising"} aria-hidden="true">{shown.emoji}</span>}
      </Html>
      {/* The signs keep their size whatever the distance: buttons stay 44 px, even at the edge of the reach. */}
      {picking && (
        <Html position={[0, HEIGHT + 1.1, 0]} center zIndexRange={[6, 0]}>
          <WarmPicker pallet={spot.pallet} login={spot.login} />
        </Html>
      )}
    </RigidBody>
  );
}
