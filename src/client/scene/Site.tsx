// The building site: ground, road, zone yards with their pallets, the buildings, the crane and the office.
import { Html, KeyboardControls, Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Site as SiteModel } from "../../shared/site.ts";
import { zoneLabel } from "../i18n.ts";
import { KEY_MAP } from "../keys.ts";
import { useQuest } from "../store.ts";
import { Building } from "./Building.tsx";
import { zoneColor } from "./colors.ts";
import { Effects } from "./Effects.tsx";
import { Piece } from "./kit.tsx";
import { BUILDING_ROW_Z, FOLLOW_START, YARD_Z, ZONE_SPACING, layoutSite } from "./layout.ts";
import { Pallet } from "./Pallet.tsx";
import { Player } from "./Player.tsx";
import { ARRIVAL_SECONDS, Arrival, Dust, Termites, TurningCrane } from "./Life.tsx";
import { newlyLaid, termiteSpots, workerSpots } from "./show.ts";
import { groundTexture, paintedNumber } from "./textures.ts";
import { Worker } from "./Worker.tsx";

const YARD_DEPTH = 6;
const GROUND_SIZE = 400;

function Ground({ width }: { width: number }) {
  const texture = useMemo(() => {
    const t = groundTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(GROUND_SIZE / 12, GROUND_SIZE / 12);
    return t;
  }, []);
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[width / 2 + 20, 0.5, 40]} position={[0, -0.5, 0]} />
      {/* Larger than the site, so the drone never sees its edge. */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[width + 40, 3.2]} />
        <meshStandardMaterial color="#5E626B" roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.ceil((width + 40) / 3) }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-(width + 40) / 2 + 1.5 + i * 3, 0.02, 0]}>
          <planeGeometry args={[1.4, 0.16]} />
          <meshStandardMaterial color="#F7F2E8" />
        </mesh>
      ))}
    </RigidBody>
  );
}

/** A yard: tinted gravel, a tape border on posts, its number painted on the ground, the sign at the road. */
function Yard({ name, index, x, z }: { name: string; index: number; x: number; z: number }) {
  const color = zoneColor(index);
  const number = useMemo(() => paintedNumber(String(index + 1), "rgba(255,255,255,0.85)"), [index]);
  const w = ZONE_SPACING - 1.2;
  const cz = -YARD_DEPTH / 2 + 0.5;
  const posts: [number, number][] = [[-w / 2, 0.5], [w / 2, 0.5], [-w / 2, -YARD_DEPTH + 0.5], [w / 2, -YARD_DEPTH + 0.5]];
  return (
    <group position={[x, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, cz]} receiveShadow>
        <planeGeometry args={[w, YARD_DEPTH]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -YARD_DEPTH + 1.6]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={number} transparent toneMapped={false} />
      </mesh>
      {posts.map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.45, pz]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.9, 8]} />
          <meshStandardMaterial color="#F08A24" />
        </mesh>
      ))}
      {[[0, 0.5, w, 0], [0, -YARD_DEPTH + 0.5, w, 0], [-w / 2, cz, YARD_DEPTH, Math.PI / 2], [w / 2, cz, YARD_DEPTH, Math.PI / 2]].map(([tx, tz, len, rot], i) => (
        <mesh key={`t${i}`} position={[tx, 0.8, tz]} rotation-y={rot}>
          <boxGeometry args={[len, 0.07, 0.012]} />
          <meshStandardMaterial color={i % 2 ? "#F7F2E8" : "#E8483B"} />
        </mesh>
      ))}
      <Piece name="zone_sign" position={[0, 0, 0.9]} />
      <Html position={[0, 1.55, 0.95]} center transform distanceFactor={6} zIndexRange={[5, 0]}>
        <div className="sign-label" style={{ borderColor: color }}>{zoneLabel(name)}</div>
      </Html>
    </group>
  );
}

function Scene({ site, reduceMotion }: { site: SiteModel; reduceMotion: boolean }) {
  const layout = useMemo(() => layoutSite(site), [site]);
  const near = useQuest((s) => s.nearPallet);
  const zoneIndex = new Map(site.zones.map((z) => [z.name, z.index]));
  const width = site.zones.length * ZONE_SPACING + 10;
  const spots = useMemo(() => workerSpots(site, layout.pallets), [site, layout]);
  const termites = useMemo(() => termiteSpots(site, layout.pallets), [site, layout]);
  const body = useRef<EcctrlHandle>(null);
  // The drone flies over once, when the site first opens; never with reduced motion.
  const arrival = useRef(reduceMotion ? 0 : ARRIVAL_SECONDS);
  const look = useRef(new THREE.Vector3().fromArray(FOLLOW_START.target));

  // Count each building's growths, so its floor grows once per new laid floor batch.
  const previous = useRef<SiteModel | null>(null);
  const [growths, setGrowths] = useState<Record<number, number>>({});
  useEffect(() => {
    const grown = newlyLaid(previous.current, site);
    previous.current = site;
    if (grown.length) setGrowths((g) => ({ ...g, ...Object.fromEntries(grown.map((n) => [n, (g[n] ?? 0) + 1])) }));
  }, [site]);

  return (
    <>
      <color attach="background" args={["#F3D9B5"]} />
      <fog attach="fog" args={["#F3D9B5", 45, 110]} />
      <Sky sunPosition={[30, 14, 25]} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} />
      <hemisphereLight args={["#FFE9C7", "#8C6A45", 0.7]} />
      <directionalLight position={[25, 22, 18]} intensity={2.6} color="#FFE2B8" castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-bias={-0.0004} />
      <Physics>
        <Ground width={width} />
        {layout.zones.map((z) => <Yard key={z.name} name={z.name} index={zoneIndex.get(z.name) ?? 0} x={z.x} z={z.z} />)}
        {layout.pallets.map((p) => {
          const pallet = site.pallets.find((x) => x.number === p.number)!;
          return <Pallet key={p.number} pallet={pallet} x={p.x} z={p.z} color={zoneColor(zoneIndex.get(pallet.zone) ?? 0)} near={near === p.number} />;
        })}
        {layout.buildings.map((b, i) => (
          <Building key={b.key} model={site.buildings[i]} x={b.x} z={b.z} reduceMotion={reduceMotion}
            grow={site.buildings[i].epicNumber === null ? 0 : growths[site.buildings[i].epicNumber as number] ?? 0} />
        ))}
        <TurningCrane position={[width / 2 - 2, 0, BUILDING_ROW_Z + 7]} reduceMotion={reduceMotion} />
        <Termites spots={termites} reduceMotion={reduceMotion} />
        <Dust body={body} reduceMotion={reduceMotion} />
        <RigidBody type="fixed" colliders="cuboid" position={[-width / 2 + 1, 0, YARD_Z - 4]}>
          <Piece name="site_office" rotation-y={Math.PI / 2} />
        </RigidBody>
        {Array.from({ length: Math.ceil((width + 8) / 2) }, (_, i) => (
          <Piece key={i} name="fence" position={[-(width + 8) / 2 + 1 + i * 2, 0, 6]} outline={0.02} />
        ))}
        {spots.map((s) => <Worker key={s.login} spot={s} />)}
        <Player pallets={layout.pallets} reduceMotion={reduceMotion} body={body} arrival={arrival} look={look} />
      </Physics>
      <Arrival leftRef={arrival} lookRef={look} siteWidth={width} end={FOLLOW_START} />
      <Effects />
    </>
  );
}

export function SiteCanvas({ site }: { site: SiteModel }) {
  const reduceMotion = useMemo(() => matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ position: [0, 10, 13], fov: 45 }} data-testid="site-canvas">
      <KeyboardControls map={KEY_MAP}>
        <Suspense fallback={null}>
          <Scene site={site} reduceMotion={reduceMotion} />
        </Suspense>
      </KeyboardControls>
    </Canvas>
  );
}
