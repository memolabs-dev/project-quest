// The building site: ground, road, zone yards with their pallets, the buildings, the crane and the office.
import { ContactShadows, Html, KeyboardControls, Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import type { Site as SiteModel } from "../../shared/site.ts";
import { zoneLabel } from "../i18n.ts";
import { KEY_MAP } from "../keys.ts";
import { useQuest } from "../store.ts";
import { Effects } from "./Effects.tsx";
import { BUILDING_ROW_Z, YARD_Z, ZONE_SPACING, layoutSite } from "./layout.ts";
import { zoneColor } from "./colors.ts";
import { Piece } from "./kit.tsx";
import { Player } from "./Player.tsx";


function Ground({ width }: { width: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[width / 2 + 10, 0.5, 30]} position={[0, -0.5, 0]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width + 20, 60]} />
        <meshStandardMaterial color="#E6C99B" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[width + 20, 3.2]} />
        <meshStandardMaterial color="#6B6F78" roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.ceil((width + 20) / 3) }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-(width + 20) / 2 + 1.5 + i * 3, 0.02, 0]}>
          <planeGeometry args={[1.4, 0.16]} />
          <meshStandardMaterial color="#F7F2E8" />
        </mesh>
      ))}
    </RigidBody>
  );
}

function Scene({ site, reduceMotion }: { site: SiteModel; reduceMotion: boolean }) {
  const { t } = useTranslation();
  const layout = useMemo(() => layoutSite(site), [site]);
  const near = useQuest((s) => s.nearPallet);
  const open = useQuest((s) => s.open);
  const zoneIndex = new Map(site.zones.map((z) => [z.name, z.index]));
  const width = site.zones.length * ZONE_SPACING + 10;

  return (
    <>
      <Sky sunPosition={[40, 30, 20]} turbidity={4} rayleigh={0.6} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 15]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <Physics>
        <Ground width={width} />
        {layout.zones.map((z) => (
          <group key={z.name} position={[z.x, 0, z.z]}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, -2.5]} receiveShadow>
              <planeGeometry args={[ZONE_SPACING - 1.2, 6]} />
              <meshStandardMaterial color={zoneColor(zoneIndex.get(z.name) ?? 0)} transparent opacity={0.16} />
            </mesh>
            <Piece name="zone_sign" position={[0, 0, 0.6]} />
            <Html position={[0, 1.55, 0.65]} center transform distanceFactor={6} zIndexRange={[5, 0]}>
              <div className="sign-label" style={{ borderColor: zoneColor(zoneIndex.get(z.name) ?? 0) }}>{zoneLabel(z.name)}</div>
            </Html>
          </group>
        ))}
        {layout.pallets.map((p) => {
          const pallet = site.pallets.find((x) => x.number === p.number)!;
          const zi = zoneIndex.get(pallet.zone) ?? 0;
          return (
            <RigidBody key={p.number} type="fixed" colliders="cuboid" position={[p.x, 0, p.z]}>
              <Piece name="pallet" crateColor={zoneColor(zi)} outline={near === p.number ? 0.09 : 0.045}
                onClick={(e) => { e.stopPropagation(); open(p.number); }} />
              {near === p.number && (
                <Html position={[0, 1.3, 0]} center zIndexRange={[6, 0]}>
                  <div className="near-tag">#{p.number}</div>
                </Html>
              )}
            </RigidBody>
          );
        })}
        {layout.buildings.map((b, i) => {
          const model = site.buildings[i];
          return (
            <RigidBody key={b.key} type="fixed" colliders={false} position={[b.x, 0, b.z]}>
              <CuboidCollider args={[1.6, Math.max(1, b.floors) / 2 + 0.2, 1.6]} position={[0, Math.max(1, b.floors) / 2, 0]} />
              <mesh position={[0, 0.06, 0]} receiveShadow>
                <boxGeometry args={[3.6, 0.12, 3.6]} />
                <meshStandardMaterial color="#B9AE9C" />
              </mesh>
              {Array.from({ length: b.floors }, (_, f) => <Piece key={f} name="floor_module" position={[0, 0.12 + f, 0]} />)}
              <Html position={[0, b.floors + 1.6, 0]} center distanceFactor={18} zIndexRange={[5, 0]}>
                <div className="building-label">
                  <b>{model.epicNumber === null ? t("site.unassigned") : model.title}</b>
                  <span>{t("site.floors", { done: model.floorsDone, total: model.floorsTotal })}</span>
                </div>
              </Html>
            </RigidBody>
          );
        })}
        <Piece name="crane" position={[width / 2 - 4, 0, BUILDING_ROW_Z + 6]} />
        <RigidBody type="fixed" colliders="cuboid" position={[-width / 2 + 2, 0, YARD_Z - 4]}>
          <Piece name="site_office" rotation-y={Math.PI / 2} />
        </RigidBody>
        {Array.from({ length: Math.ceil(width / 2) }, (_, i) => (
          <Piece key={i} name="fence" position={[-width / 2 + 1 + i * 2, 0, 6]} outline={0.02} />
        ))}
        <Player pallets={layout.pallets} reduceMotion={reduceMotion} />
      </Physics>
      <ContactShadows position={[0, 0.03, 0]} opacity={0.35} scale={width + 20} blur={2.4} far={6} />
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
