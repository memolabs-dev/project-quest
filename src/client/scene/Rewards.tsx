// The lead's rewards on the team site (lead's path spec, section 8): the sprint truck by the road while a sprint runs,
// the mayor's ribbon with the date of her next visit, the radio mast broadcasting the last bulletin. Plain boxes.
import { Html } from "@react-three/drei";
import { useTranslation } from "react-i18next";
import { teamRewards } from "../levels.ts";
import { useQuest } from "../store.ts";

const NONE = { truck: null, ribbon: null, mast: null };

function Box({ size, position, color }: { size: [number, number, number]; position: [number, number, number]; color: string }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function TeamRewards({ truckAt, ribbonAt, mastAt }: {
  truckAt: [number, number, number]; ribbonAt: [number, number, number]; mastAt: [number, number, number];
}) {
  const { t } = useTranslation();
  // Select stable references, then derive: a selector that builds a new object re-renders forever.
  const levels = useQuest((s) => s.levels);
  const kind = useQuest((s) => s.siteKind);
  const rewards = levels ? teamRewards(levels, kind) : NONE;
  return (
    <>
      {rewards.truck && (
        <group position={truckAt}>
          <Box size={[2.6, 0.5, 1.3]} position={[0, 0.55, 0]} color="#3D6E9E" />
          <Box size={[0.9, 0.9, 1.3]} position={[1.3, 1.05, 0]} color="#E8483B" />
          <Box size={[1.6, 0.5, 1.1]} position={[-0.35, 1.05, 0]} color="#C8A26B" />
          {[[-0.8, 0.65], [-0.8, -0.65], [1.1, 0.65], [1.1, -0.65]].map(([x, z]) => (
            <Box key={`${x}${z}`} size={[0.5, 0.5, 0.15]} position={[x, 0.25, z]} color="#2B2B2B" />
          ))}
          <Html position={[0, 2.1, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
            <div className="sign-label reward-label">
              {t("rewards.truck", { sprint: rewards.truck.title, points: rewards.truck.points, capacity: rewards.truck.capacity ?? "?" })}
            </div>
          </Html>
        </group>
      )}
      {rewards.mast && (
        <group position={mastAt}>
          <Box size={[0.14, 4.2, 0.14]} position={[0, 2.1, 0]} color="#B9B2A6" />
          <Box size={[0.9, 0.08, 0.08]} position={[0, 3.6, 0]} color="#B9B2A6" />
          <Box size={[0.6, 0.08, 0.08]} position={[0, 3.95, 0]} color="#B9B2A6" />
          <Box size={[0.22, 0.22, 0.22]} position={[0, 4.3, 0]} color="#E8483B" />
          <Html position={[0, 4.9, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
            <div className="sign-label reward-label">
              {/* A status update posted on GitHub without a status shows its words only. */}
              {rewards.mast.status
                ? t("rewards.mast", { status: t(`team.bulletin.statuses.${rewards.mast.status}`), line: rewards.mast.line })
                : rewards.mast.line}
            </div>
          </Html>
        </group>
      )}
      {rewards.ribbon && (
        <group position={ribbonAt}>
          <Box size={[0.12, 1.6, 0.12]} position={[-1, 0.8, 0]} color="#F7F2E8" />
          <Box size={[0.12, 1.6, 0.12]} position={[1, 0.8, 0]} color="#F7F2E8" />
          <Box size={[2, 0.18, 0.04]} position={[0, 1.25, 0]} color="#E8483B" />
          <Html position={[0, 2, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
            <div className="sign-label reward-label">{t("rewards.ribbon", { title: rewards.ribbon.title, date: rewards.ribbon.dueOn })}</div>
          </Html>
        </group>
      )}
    </>
  );
}
