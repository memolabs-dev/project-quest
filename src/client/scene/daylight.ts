// The light of the day (living site spec, section 5): from morning to evening over 12 minutes, then back to morning,
// so a long session never jumps; the sun never goes low enough for night, everything stays readable.
import * as THREE from "three";

export const DAY_SECONDS = 12 * 60;

const MORNING = new THREE.Color("#FFC98F");
const NOON = new THREE.Color("#FFE9C7");
const tmp = new THREE.Color();

/**
 * The sun's position, the light's colour and strength, and the time of day (0 morning, 1 evening) at `seconds`.
 * The colour is one shared object, rewritten on each call (read every frame, it builds nothing): copy it to keep it.
 */
export function daylight(seconds: number): { sun: [number, number, number]; color: THREE.Color; intensity: number; sky: number } {
  const t = (((seconds % (2 * DAY_SECONDS)) + 2 * DAY_SECONDS) % (2 * DAY_SECONDS)) / DAY_SECONDS;
  const sky = t <= 1 ? t : 2 - t;
  const high = Math.sin(Math.PI * sky);
  const turn = Math.PI * (0.15 + 0.7 * sky);
  return {
    sun: [-Math.cos(turn) * 30, 6 + 18 * high, 18],
    color: tmp.copy(MORNING).lerp(NOON, high),
    intensity: 2.0 + 0.8 * high,
    sky,
  };
}

/** How far the light stands from the box centre, along the sun: far enough that no tall caster is behind it. */
export const SUN_DISTANCE = 120;

const f = new THREE.Vector3();
const r = new THREE.Vector3();
const u = new THREE.Vector3();
const p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Where the shadow box stands: on the player, snapped to whole texels of the light's own grid (its right and up axes,
 * as the shadow camera sees them), so static shadows do not crawl as the box follows. The sun's own slow drift still
 * moves them a little: that is the day passing.
 */
export function shadowBox(player: { x: number; z: number }, sun: [number, number, number], half: number, mapSize: number): { x: number; y: number; z: number } {
  const texel = (2 * half) / mapSize;
  f.set(...sun).negate().normalize();
  r.crossVectors(f, UP).normalize();
  u.crossVectors(r, f);
  p.set(player.x, 0, player.z);
  const a = Math.round(p.dot(r) / texel) * texel;
  const b = Math.round(p.dot(u) / texel) * texel;
  const c = p.dot(f);
  p.copy(r).multiplyScalar(a).addScaledVector(u, b).addScaledVector(f, c);
  return { x: p.x, y: p.y, z: p.z };
}

/** The light's position: the box centre plus the sun's direction at SUN_DISTANCE. */
export function lightAt(box: { x: number; y: number; z: number }, sun: [number, number, number]): [number, number, number] {
  p.set(...sun).normalize().multiplyScalar(SUN_DISTANCE);
  return [box.x + p.x, box.y + p.y, box.z + p.z];
}
