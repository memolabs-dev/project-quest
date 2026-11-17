// The light of the day (living site spec, section 5): from morning to evening over 12 minutes, then back to morning,
// so a long session never jumps; the sun never goes low enough for night, everything stays readable.
import * as THREE from "three";

export const DAY_SECONDS = 12 * 60;

const MORNING = new THREE.Color("#FFC98F");
const NOON = new THREE.Color("#FFE9C7");
const tmp = new THREE.Color();

/** The sun's position, the light's colour and strength, and the time of day (0 morning, 1 evening) at `seconds`. */
export function daylight(seconds: number): { sun: [number, number, number]; color: string; intensity: number; sky: number } {
  const t = (((seconds % (2 * DAY_SECONDS)) + 2 * DAY_SECONDS) % (2 * DAY_SECONDS)) / DAY_SECONDS;
  const sky = t <= 1 ? t : 2 - t;
  const high = Math.sin(Math.PI * sky);
  const turn = Math.PI * (0.15 + 0.7 * sky);
  return {
    sun: [-Math.cos(turn) * 30, 6 + 18 * high, 18],
    color: `#${tmp.copy(MORNING).lerp(NOON, high).getHexString()}`,
    intensity: 2.0 + 0.8 * high,
    sky,
  };
}

/** Where the shadow box stands: on the player, snapped to whole shadow texels so shadows never shimmer as it moves. */
export function shadowBox(player: { x: number; z: number }, half: number, mapSize: number): { x: number; z: number } {
  const texel = (2 * half) / mapSize;
  return { x: Math.round(player.x / texel) * texel, z: Math.round(player.z / texel) * texel };
}
