// The site's sky and sun: the light drifts through the day (daylight.ts) and the shadow box follows the player, so
// shadows stay sharp near them with a smaller box. Updated each frame through refs: nothing re-renders.
import { Sky } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ComponentRef, useRef } from "react";
import * as THREE from "three";
import { playerPosition } from "../moments/player.ts";
import { DAY_SECONDS, daylight, lightAt, shadowBox } from "./daylight.ts";

const HALF = 30;
const MAP = 2048;
/** The site opens mid-morning: the first view has short, readable shadows. */
const START = DAY_SECONDS * 0.25;

export function SiteLight() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const sky = useRef<ComponentRef<typeof Sky>>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame(({ clock }) => {
    const d = daylight(clock.elapsedTime + START);
    const light = sun.current;
    if (light) {
      const box = shadowBox(playerPosition, d.sun, HALF, MAP);
      light.target.position.set(box.x, box.y, box.z);
      light.target.updateMatrixWorld();
      light.position.set(...lightAt(box, d.sun));
      light.color.set(d.color);
      light.intensity = d.intensity;
    }
    (sky.current?.material as THREE.ShaderMaterial | undefined)?.uniforms.sunPosition.value.set(...d.sun);
    hemi.current?.color.set(d.color);
  });
  return (
    <>
      <Sky ref={sky} sunPosition={[30, 14, 25]} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} />
      <hemisphereLight ref={hemi} args={["#FFE9C7", "#8C6A45", 0.7]} />
      <directionalLight ref={sun} position={[25, 22, 18]} intensity={2.6} color="#FFE2B8" castShadow shadow-mapSize={[MAP, MAP]}
        shadow-camera-left={-HALF} shadow-camera-right={HALF} shadow-camera-top={HALF} shadow-camera-bottom={-HALF}
        shadow-camera-near={1} shadow-camera-far={250} shadow-bias={-0.0004} shadow-radius={2.5} />
    </>
  );
}
