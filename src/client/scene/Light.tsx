// The site's sky and sun: the light drifts through the day (daylight.ts) and the shadow box follows the player, so
// shadows stay sharp near them with a smaller box. Updated each frame through refs: nothing re-renders.
import { Sky } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ComponentRef, type RefObject, useRef } from "react";
import * as THREE from "three";
import { playerPosition } from "../moments/player.ts";
import { DAY_SECONDS, daylight, lightAt, shadowBox } from "./daylight.ts";

const HALF = 30;
const MAP = 2048;
/** The site opens mid-morning: the first view has short, readable shadows. */
const START = DAY_SECONDS * 0.25;
/** A frame counts for a tenth of a second at most: a tab left hidden does not jump the light forward on return. */
const MAX_STEP = 0.1;

export function SiteLight({ arrival, look }: {
  /** Seconds left of the drone's fly-over, and where it looks: the shadow box follows that point meanwhile. */
  arrival: RefObject<number>;
  look: RefObject<THREE.Vector3>;
}) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const sky = useRef<ComponentRef<typeof Sky>>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const time = useRef(START);
  useFrame((_, delta) => {
    time.current += Math.min(delta, MAX_STEP);
    const d = daylight(time.current);
    const light = sun.current;
    if (light) {
      // During the fly-over the drone looks across the whole site: the box stands where it looks, not on the foreman.
      const focus = arrival.current > 0 ? look.current : playerPosition;
      const box = shadowBox(focus, d.sun, HALF, MAP);
      light.target.position.set(box.x, box.y, box.z);
      light.target.updateMatrixWorld();
      light.position.set(...lightAt(box, d.sun));
      light.color.copy(d.color);
      light.intensity = d.intensity;
    }
    (sky.current?.material as THREE.ShaderMaterial | undefined)?.uniforms.sunPosition.value.set(...d.sun);
    hemi.current?.color.copy(d.color);
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
