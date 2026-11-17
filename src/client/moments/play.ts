// What the director does with a moment, in full or with reduced motion. Pure.
import type { Moment } from "./diff.ts";
import { MOMENTS, type SoundName } from "./list.ts";

export interface MomentPlan {
  sound: SoundName | null;
  dust: "puff" | "ring" | null;
  kick: number;
  react: "cheer" | "lean" | null;
  /** Words standing in for the motion (reduced motion only). */
  text: string | null;
}

export function planMoment(m: Moment, reduced: boolean): MomentPlan {
  const spec = MOMENTS[m.kind];
  if (reduced) return { sound: spec.reduced.sound, dust: null, kick: 0, react: null, text: spec.reduced.text };
  return { sound: spec.sound, dust: spec.dust, kick: spec.kick, react: spec.react, text: null };
}

const KICK_SECONDS = 0.3;

/** The camera kick's offset t seconds after it began: a quick dip that rebounds and fades to nothing at 300 ms. */
export function kickAt(t: number, strength: number): number {
  if (t >= KICK_SECONDS) return 0;
  const k = t / KICK_SECONDS;
  return strength * Math.cos(k * Math.PI * 3) * (1 - k);
}
