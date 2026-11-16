// A contributor on the site: the foreman's body in their trade's jacket, their GitHub avatar on a badge.
// Workers only stand by their pallet for now; the lead is the only one who walks and scores.
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { badgeInitial, idleOffset, jacketColor, type WorkerSpot } from "./show.ts";

const URL = "/models/foreman.glb";
const HEIGHT = 1.7;
const IDLE = "Unarmed_Idle";

/** Plays a loop from a point in its cycle (0 to 1). */
function startAt(action: THREE.AnimationAction, fraction: number) {
  action.reset().play();
  action.time = fraction * action.getClip().duration;
}

function Badge({ login, avatarUrl, color }: { login: string; avatarUrl: string; color: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="worker-badge" style={{ borderColor: color }} title={login}>
      {avatarUrl && !failed
        ? <img src={avatarUrl} alt={login} width={28} height={28} onError={() => setFailed(true)} />
        : <span aria-label={login}>{badgeInitial(login)}</span>}
    </div>
  );
}

export function Worker({ spot }: { spot: WorkerSpot }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const color = jacketColor(spot.trade);

  // Each worker needs its own skeleton, and its own jacket material.
  const { body, scale } = useMemo(() => {
    const body = clone(scene);
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === "jacket") {
        m.material = mat.clone();
        (m.material as THREE.MeshStandardMaterial).color = new THREE.Color(color);
      }
    });
    const box = new THREE.Box3().setFromObject(body);
    const h = box.max.y - box.min.y;
    return { body, scale: h > 0 ? HEIGHT / h : 1 };
  }, [scene, color]);

  const { actions } = useAnimations(animations, group);
  useFrame(() => {
    const idle = actions[IDLE];
    // Replay when stopped: useAnimations stops every action when its effect re-runs.
    if (!group.current || !idle || idle.isRunning()) return;
    startAt(idle, idleOffset(spot.login));
  });

  return (
    <RigidBody type="fixed" colliders={false} position={[spot.x, 0, spot.z]}>
      <CuboidCollider args={[0.3, 0.85, 0.3]} position={[0, 0.85, 0]} />
      <group ref={group} scale={scale} rotation-y={-Math.PI / 5} dispose={null}>
        <primitive object={body} />
      </group>
      <Html position={[0, HEIGHT + 0.45, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        <Badge login={spot.login} avatarUrl={spot.avatarUrl} color={color} />
      </Html>
    </RigidBody>
  );
}
