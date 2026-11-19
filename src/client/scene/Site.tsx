// The building site: ground, road, zone yards with their pallets, the buildings, the crane and the office.
import { Html, KeyboardControls, PerformanceMonitor } from "@react-three/drei";
import { QUALITY_START, nextQuality, quality } from "./quality.ts";
import { SiteLight } from "./Light.tsx";
import { TeamRewards, TruckHop } from "./Rewards.tsx";
import { RadioSet } from "./RadioSet.tsx";
import { Director } from "./Director.tsx";
import { useReducedMotion } from "./motion.ts";
import { Canvas } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import type { Site as SiteModel } from "../../shared/site.ts";
import { zoneLabel } from "../i18n.ts";
import { KEY_MAP } from "../keys.ts";
import { useQuest } from "../store.ts";
import { Building } from "./Building.tsx";
import { zoneColor } from "./colors.ts";
import { Effects } from "./Effects.tsx";
import { Piece, PieceRow } from "./kit.tsx";
import { dashesAt, fenceAt } from "./rows.ts";
import { BUILDING_ROW_Z, FOLLOW_START, RADIO_AT, YARD_Z, ZONE_SPACING, gateSignAt, layoutSite } from "./layout.ts";
import { Pallet } from "./Pallet.tsx";
import { Player } from "./Player.tsx";
import { ARRIVAL_SECONDS, Arrival, Dust, Termites, TurningCrane, Weather } from "./Life.tsx";
import { withWind } from "./wind.ts";
import { jacketColor, solidPallets, termiteSpots, visitorSpots, workerSpots } from "./show.ts";
import { livelyWorkers, sameMembers } from "./people.ts";
import { playerPosition } from "../moments/player.ts";
import { groundTexture, paintedNumber } from "./textures.ts";
import { Worker } from "./Worker.tsx";

const YARD_DEPTH = 6;
const GROUND_SIZE = 400;

const dash = new THREE.Object3D();

/** The road's dashes, one instanced mesh. */
function RoadDashes({ width }: { width: number }) {
  const xs = useMemo(() => dashesAt(width), [width]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    xs.forEach((x, i) => {
      dash.position.set(x, 0.02, 0);
      dash.rotation.set(-Math.PI / 2, 0, 0);
      dash.updateMatrix();
      row.setMatrixAt(i, dash.matrix);
    });
    row.instanceMatrix.needsUpdate = true;
  }, [xs]);
  return (
    <instancedMesh key={xs.length} ref={ref} args={[undefined, undefined, xs.length]} frustumCulled={false}>
      <planeGeometry args={[1.4, 0.16]} />
      <meshStandardMaterial color="#F7F2E8" />
    </instancedMesh>
  );
}

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
      <RoadDashes width={width} />
    </RigidBody>
  );
}

/** A yard: tinted gravel, a tape border on posts, its number painted on the ground, the sign at the road. */
function Yard({ name, index, x, z, count }: { name: string; index: number; x: number; z: number; count: number | null }) {
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
          <meshStandardMaterial ref={(m) => { if (m) withWind(m); }} color={i % 2 ? "#F7F2E8" : "#E8483B"} />
        </mesh>
      ))}
      <Piece name="zone_sign" position={[0, 0, 0.9]} />
      <Html position={[0, 1.55, 0.95]} center transform distanceFactor={6} zIndexRange={[5, 0]}>
        <div className="sign-label" style={{ borderColor: color }}>{zoneLabel(name)}{count !== null && <b className="yard-count"> · {count}</b>}</div>
      </Html>
    </group>
  );
}

/** The practice site's gate: the player's name at the road, once they founded it. */
function GateSign({ at: [x, z] }: { at: [number, number] }) {
  const { t } = useTranslation();
  const login = useQuest((s) => (s.siteKind === "practice" && s.levels?.unlocks.ownSite ? s.levels.login : null));
  if (!login) return null;
  return (
    <Html position={[x, 1.7, z]} center transform distanceFactor={6} zIndexRange={[5, 0]}>
      {/* The demo player is called "you": no possessive on it. */}
      <div className="gate-sign">{login === "you" ? t("practice.gateYou") : t("practice.gate", { login })}</div>
    </Html>
  );
}

function Scene({ site, reduceMotion, aoHalf, tiltShift }: { site: SiteModel; reduceMotion: boolean; aoHalf: boolean; tiltShift: boolean }) {
  const layout = useMemo(() => layoutSite(site), [site]);
  // A cleared duplicate is neither in the player's way nor near them.
  const solid = useMemo(() => solidPallets(site, layout.pallets), [site, layout]);
  // The moments' count when the scene opened: pallets already there never replay their arrival.
  const [openedAt] = useState(() => Object.values(useQuest.getState().motions).reduce((n, m) => Math.max(n, m.at), 0));
  const near = useQuest((s) => s.nearPallet);
  const zoneIndex = new Map(site.zones.map((z) => [z.name, z.index]));
  const width = site.zones.length * ZONE_SPACING + 10;
  const truckAt: [number, number, number] = [-width / 2 + 5, 0, YARD_Z - 5];
  const spots = useMemo(() => workerSpots(site, layout.pallets), [site, layout]);
  const fence = useMemo(() => fenceAt(width), [width]);
  // The twelve workers nearest the foreman live fully; refreshed every second, not every frame.
  const [lively, setLively] = useState(() => livelyWorkers(spots, playerPosition));
  useEffect(() => {
    const update = () => setLively((was) => {
      const now = livelyWorkers(spots, playerPosition);
      return sameMembers(was, now) ? was : now;
    });
    update();
    const every = setInterval(update, 1000);
    return () => clearInterval(every);
  }, [spots]);
  const termites = useMemo(() => termiteSpots(site, layout.pallets), [site, layout]);
  // The Site foreman's reward: on the team site, each yard's sign counts its open pallets.
  const counting = useQuest((s) => s.siteKind === "team" && s.levels?.ranks.lead != null);
  // A newcomer whose first pull request closes no pallet stands in a row beside the site office, waiting to be welcomed.
  const newcomers = site.people?.newcomers;
  const openTalk = useQuest((s) => s.openTalk);
  const visitors = useMemo(() => visitorSpots(newcomers, width), [newcomers, width]);
  const body = useRef<EcctrlHandle>(null);
  // The drone flies over once, when the site first opens; never with reduced motion.
  const arrival = useRef(reduceMotion ? 0 : ARRIVAL_SECONDS);
  const look = useRef(new THREE.Vector3().fromArray(FOLLOW_START.target));


  return (
    <>
      <color attach="background" args={["#F3D9B5"]} />
      <fog attach="fog" args={["#F3D9B5", 45, 110]} />
      <SiteLight />
      <Weather reduceMotion={reduceMotion} />
      <Physics>
        <Ground width={width} />
        {layout.zones.map((z) => (
          <Yard key={z.name} name={z.name} index={zoneIndex.get(z.name) ?? 0} x={z.x} z={z.z}
            count={counting ? site.pallets.filter((p) => p.zone === z.name && !p.closed).length : null} />
        ))}
        {layout.pallets.map((p) => {
          const pallet = site.pallets.find((x) => x.number === p.number)!;
          return <Pallet key={p.number} pallet={pallet} x={p.x} z={p.z} color={zoneColor(zoneIndex.get(pallet.zone) ?? 0)} near={near === p.number} reduceMotion={reduceMotion} openedAt={openedAt} />;
        })}
        {layout.buildings.map((b, i) => (
          <Building key={b.key} model={site.buildings[i]} x={b.x} z={b.z} reduceMotion={reduceMotion} />
        ))}
        <TurningCrane position={[width / 2 - 2, 0, BUILDING_ROW_Z + 7]} reduceMotion={reduceMotion} />
        <Termites spots={termites} reduceMotion={reduceMotion} />
        <Dust body={body} reduceMotion={reduceMotion} />
        <Director reduceMotion={reduceMotion} spotOf={(m) => {
          if (m.pallet !== undefined) {
            const p = layout.pallets.find((x) => x.number === m.pallet);
            return p ? [p.x, p.z] : null;
          }
          if (m.building !== undefined) {
            const b = layout.buildings.find((x) => x.key === (m.building === "unassigned" ? "unassigned" : `epic-${m.building}`));
            return b ? [b.x, b.z] : null;
          }
          return null;
        }} />
        <RigidBody type="fixed" colliders="cuboid" position={[-width / 2 + 1, 0, YARD_Z - 4]}>
          <Piece name="site_office" rotation-y={Math.PI / 2} />
        </RigidBody>
        <PieceRow name="fence" xs={fence} z={6} outline={0.02} />
        {/* Keyed by colour too: a new jacket means a new skeleton, which the animations must bind to. */}
        {spots.map((s) => (
          <Worker key={`${s.login}:${jacketColor(s.trade)}`} spot={s} lively={lively.has(s.login)} reduceMotion={reduceMotion} />
        ))}
        {visitors.map((v) => (
          <Worker key={`visitor:${v.spot.login}`} spot={v.spot} lively reduceMotion={reduceMotion} visitor={{ welcome: () => openTalk({ kind: "welcome", number: v.number }) }} />
        ))}
        {/* The radio set beside the spawn: its foot is solid, the foreman walks round it (the set on the mast is above his helmet). */}
        <RigidBody type="fixed" colliders={false} position={[RADIO_AT[0], 0, RADIO_AT[1]]}>
          <CuboidCollider args={[0.3, 0.5, 0.3]} position={[0, 0.5, 0]} />
          <RadioSet position={[0, 0, 0]} reduceMotion={reduceMotion} />
        </RigidBody>
        <GateSign at={gateSignAt(width)} />
        <TeamRewards truckAt={truckAt} ribbonAt={[width / 2 - 4, 0, YARD_Z - 5]} mastAt={[-width / 2 + 0.2, 0, YARD_Z - 4.8]} />
        <TruckHop truckAt={truckAt} reduceMotion={reduceMotion}
          fromOf={(n) => { const p = layout.pallets.find((x) => x.number === n); return p ? [p.x, p.z] : null; }}
          colorOf={(n) => zoneColor(zoneIndex.get(site.pallets.find((x) => x.number === n)?.zone ?? "") ?? 0)} />
        <Player pallets={solid} workers={spots} visitors={visitors} radioAt={RADIO_AT} reduceMotion={reduceMotion} body={body} arrival={arrival} look={look} />
      </Physics>
      <Arrival leftRef={arrival} lookRef={look} siteWidth={width} end={FOLLOW_START} />
      <Effects aoHalf={aoHalf} tiltShift={tiltShift} />
    </>
  );
}

export function SiteCanvas({ site }: { site: SiteModel }) {
  const reduceMotion = useReducedMotion();
  const miniature = useQuest((s) => s.settings.miniature);
  // A weak machine lowers the quality one step per drop of the frame rate, and raises it back when it holds.
  const [level, setLevel] = useState(QUALITY_START);
  const q = quality(level.level, miniature);
  // A visit's photo reads the canvas after the frame: it must keep its last frame (#16).
  const keepFrame = useQuest((s) => s.siteKind === "visit");
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} gl={{ preserveDrawingBuffer: keepFrame }} dpr={q.dpr} camera={{ position: [0, 10, 13], fov: 45 }} data-testid="site-canvas">
      <PerformanceMonitor onDecline={() => setLevel((s) => nextQuality(s, "decline"))} onIncline={() => setLevel((s) => nextQuality(s, "incline"))} />
      <KeyboardControls map={KEY_MAP}>
        <Suspense fallback={null}>
          <Scene site={site} reduceMotion={reduceMotion} aoHalf={q.aoHalf} tiltShift={q.tiltShift} />
        </Suspense>
      </KeyboardControls>
    </Canvas>
  );
}
