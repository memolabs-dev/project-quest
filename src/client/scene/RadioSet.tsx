// The site radio set, standing in front of the office: a box, a grille and an antenna. While it speaks, the antenna
// sways (never with reduced motion), a light blinks, and a bubble shows the line. Plain boxes, no model.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { RADIO_LINE_MS, type RadioLine } from "../radio.ts";
import { useQuest } from "../store.ts";
import { Box } from "./Rewards.tsx";
import { useGameSound } from "./useGameSound.ts";

const LIGHT_ON = new THREE.Color("#E8483B");
const LIGHT_OFF = new THREE.Color("#5C2A26");

export function RadioSet({ position, reduceMotion }: { position: [number, number, number]; reduceMotion: boolean }) {
  const { t } = useTranslation();
  const radio = useQuest((s) => s.radio);
  const next = useQuest((s) => s.nextRadioLine);
  const skip = useQuest((s) => s.skipRadio);
  const open = useQuest((s) => s.open);
  const sound = useGameSound();
  const antenna = useRef<THREE.Group>(null);
  const light = useRef<THREE.MeshStandardMaterial>(null);
  const speaking = radio !== null;

  // Each line lasts a few seconds, with a crackle as it comes on; after the last, silence.
  useEffect(() => {
    if (!radio) return;
    sound.current?.play("radio");
    const timer = setTimeout(next, RADIO_LINE_MS);
    return () => clearTimeout(timer);
  }, [radio, next, sound]);

  useFrame(({ clock }) => {
    const a = antenna.current;
    if (a) a.rotation.z = speaking && !reduceMotion ? Math.sin(clock.elapsedTime * 9) * 0.12 : 0;
    // The light blinks even with reduced motion: it is a signal, not a movement.
    light.current?.color.copy(speaking && Math.floor(clock.elapsedTime * 3) % 2 === 0 ? LIGHT_ON : LIGHT_OFF);
  });

  const line: RadioLine | undefined = radio?.lines[radio.at];
  return (
    <group position={position} name="radio-set">
      <Box size={[0.9, 0.5, 0.4]} position={[0, 0.45, 0]} color="#3D6E9E" />
      <Box size={[0.5, 0.3, 0.05]} position={[-0.1, 0.45, 0.22]} color="#2B2B2B" />
      <group ref={antenna} name="radio-antenna" position={[0.3, 0.7, 0]}>
        <Box size={[0.05, 0.9, 0.05]} position={[0, 0.45, 0]} color="#B9B2A6" />
      </group>
      <mesh name="radio-light" position={[0.33, 0.55, 0.22]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial ref={light} color="#5C2A26" />
      </mesh>
      {/* The live region stays in the page, so a screen reader hears each line as it replaces the last. */}
      <Html position={[0, 1.9, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        <div aria-live="polite" aria-label={t("onAir.label")}>
          {line && radio && (
            <div className="radio-bubble" onClick={skip}>
              {line.pallet !== undefined ? (
                <button type="button" className="radio-pallet" onClick={(e) => { e.stopPropagation(); open(line.pallet!); }}>
                  {t(`${line.key}_${line.values.variant}`, line.values)}
                </button>
              ) : t(`${line.key}_${line.values.variant}`, line.values)}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
