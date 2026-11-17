// How the site's people behave (living site spec, section 4). Pure: the components apply it each frame.
// No gesture judges a real person's pace: they work, wait, pick up, check, look and wave; never sleep, never get hit.
import { idleOffset } from "./show.ts";
export { workerBusy } from "./show.ts";

export const GESTURES = ["Idle", "PickUp", "Interact"] as const;
export type Gesture = (typeof GESTURES)[number];

const NEAR = 4;
const MAX_YAW = Math.PI / 3;
const REST_SECONDS = 12;

/** A small, stable random number for a login and a step (0 to 1). */
const seeded = (login: string, n: number) => {
  const x = Math.sin((idleOffset(login) * 9973 + n * 7919) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** The worker's n-th gesture and how long it lasts: 4 to 9 seconds, never the same clip twice in a row. */
export function gestureAt(login: string, n: number): { clip: Gesture; seconds: number } {
  let i = -1;
  for (let k = 0; k <= n; k++) {
    const next = Math.floor(seeded(login, k) * GESTURES.length);
    i = next === i ? (next + 1) % GESTURES.length : next;
  }
  return { clip: GESTURES[i], seconds: 4 + seeded(login, n + 1000) * 5 };
}

/** What a worker is doing between frames: their gesture, its time left, and a wave's time left. */
export interface ClipPlan { step: number; left: number; gesture: Gesture | null; wave: number }

/** The clip a worker plays this frame: a wave first, then work, then a plain idle beyond the twelve, else their gesture. */
export function nextClip(p: ClipPlan, o: { busy: boolean; lively: boolean; login: string; delta: number }): string {
  if (p.wave > 0) {
    p.wave -= o.delta;
    return "Interact";
  }
  if (o.busy) return "Use_Item";
  if (!o.lively) return "Unarmed_Idle";
  p.left -= o.delta;
  if (p.left <= 0 || !p.gesture) {
    const g = gestureAt(o.login, p.step++);
    p.gesture = g.clip;
    p.left = g.seconds;
  }
  return p.gesture;
}

/** Whether two sets hold the same logins: the scene re-renders only when the twelve change. */
export const sameMembers = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** How far a worker's head turns toward the player: within 4 m, clamped to 60°, none with reduced motion. */
export function headYaw(worker: { x: number; z: number; facing: number }, player: { x: number; z: number }, reduced: boolean): number {
  const dx = player.x - worker.x;
  const dz = player.z - worker.z;
  if (reduced || Math.hypot(dx, dz) > NEAR) return 0;
  let a = Math.atan2(dx, dz) - worker.facing;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.max(-MAX_YAW, Math.min(MAX_YAW, a));
}

/** Near the player: a wave the first time in the visit (the name only with reduced motion), then the name. */
export function greeting(state: { greeted: Set<string> }, login: string, distance: number, reduced: boolean): "wave" | "name" | null {
  if (distance > NEAR) return null;
  if (state.greeted.has(login)) return "name";
  state.greeted.add(login);
  return reduced ? "name" : "wave";
}

/** The workers nearest the player who live fully (look, wave); the others keep a plain idle. */
export function livelyWorkers(spots: { login: string; x: number; z: number }[], player: { x: number; z: number }, max = 12): Set<string> {
  return new Set([...spots]
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))
    .slice(0, max)
    .map((s) => s.login));
}

/** The foreman sits down after 12 seconds without input. */
export const restAfter = (idleSeconds: number) => idleSeconds >= REST_SECONDS;

/** Whether the foreman rests, from the last input's time and now (milliseconds): the first input wakes him. */
export const restState = (lastInput: number, now: number): "rest" | "awake" => (restAfter((now - lastInput) / 1000) ? "rest" : "awake");
