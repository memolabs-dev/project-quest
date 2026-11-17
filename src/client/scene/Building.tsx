// A building tells its epic's progress: built floors, scaffolding for the rest, a roof when it is done.
// When a pallet reaches the last zone, the new floor grows in a swirl of sparks: the game's one big effect.
import { Html, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import type { Building as BuildingModel } from "../../shared/site.ts";
import { Piece } from "./kit.tsx";
import { buildingPlan, facade } from "./show.ts";

const GROW_SECONDS = 0.56;
const SPARK_SECONDS = 1.8;

const LAID_NOTICE_MS = 4000;

export function Building({ model, x, z, grow, reduceMotion }: {
  model: BuildingModel; x: number; z: number; grow: number; reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  const plan = buildingPlan(model);
  const colors = facade(model.epicNumber);
  const top = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Group>(null);
  const growing = useRef(0);
  const sparkLeft = useRef(0);

  // `grow` changes each time this building gains floors: replay the growth once. With reduced motion, no growth:
  // the site board says it in colour and words for a few seconds instead.
  const [justLaid, setJustLaid] = useState(false);
  useEffect(() => {
    if (grow === 0) return;
    if (reduceMotion) {
      const show = setTimeout(() => setJustLaid(true), 0);
      const hide = setTimeout(() => setJustLaid(false), LAID_NOTICE_MS);
      return () => { clearTimeout(show); clearTimeout(hide); };
    }
    growing.current = GROW_SECONDS;
    sparkLeft.current = SPARK_SECONDS;
  }, [grow, reduceMotion]);

  useFrame((_, delta) => {
    if (sparks.current) {
      sparkLeft.current = Math.max(0, sparkLeft.current - delta);
      sparks.current.visible = sparkLeft.current > 0;
    }
    if (!top.current || growing.current <= 0) return;
    growing.current = Math.max(0, growing.current - delta);
    const k = 1 - growing.current / GROW_SECONDS;
    const eased = 1 - Math.pow(1 - k, 3);
    top.current.scale.set(1, Math.max(0.05, eased), 1);
  });

  const height = Math.max(1, plan.built + plan.scaffold) + (plan.roof ? 1.1 : 0);
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]}>
      <CuboidCollider args={[1.8, height / 2, 1.8]} position={[0, height / 2, 0]} />
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[4, 0.12, 4]} />
        <meshStandardMaterial color="#B9AE9C" />
      </mesh>
      {Array.from({ length: plan.built }, (_, f) => {
        const isTop = f === plan.built - 1;
        return (
          <group key={f} ref={isTop ? top : undefined} position={[0, 0.12 + f, 0]}>
            <Piece name="floor_module" recolor={{ wall: colors.wall, roof: colors.trim }} />
          </group>
        );
      })}
      {Array.from({ length: plan.scaffold }, (_, f) => (
        <Piece key={`s${f}`} name="scaffold_module" position={[0, 0.12 + plan.built + f, 0]} outline={0.02} />
      ))}
      {plan.roof && <Piece name="roof" position={[0, 0.12 + plan.built, 0]} recolor={{ roof: colors.trim, wall: colors.wall }} />}
      {grow > 0 && !reduceMotion && (
        <group ref={sparks} visible={false}>
          <Sparkles count={60} scale={[4, 2.5, 4]} size={6} speed={1.4} color="#FFD84D" position={[0, 0.12 + plan.built - 0.2, 0]} />
        </group>
      )}
      {/* The site board stands in front of the building, where the follow camera always sees it. */}
      <Html position={[0, 1.3, 2.4]} center distanceFactor={18} zIndexRange={[5, 0]}>
        <div className={justLaid ? "building-label just-laid" : "building-label"} style={{ borderTopColor: colors.trim }}>
          <b dir="auto">{model.epicNumber === null ? t("site.unassigned") : model.title}</b>
          <span>{t("site.floors", { done: model.floorsDone, total: model.floorsTotal })}</span>
          {justLaid && <span className="laid-note">{t("site.newFloor")}</span>}
        </div>
      </Html>
    </RigidBody>
  );
}
