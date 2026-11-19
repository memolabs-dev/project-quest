// What the director does with a moment, in full or with reduced motion. Pure.
import type { Moment } from "./diff.ts";
import { MOMENTS, type SoundName } from "./list.ts";

export interface MomentPlan {
  sound: SoundName | null;
  dust: "puff" | "ring" | null;
  kick: number;
  react: "cheer" | "lean" | null;
}

export function planMoment(m: Moment, reduced: boolean): MomentPlan {
  const spec = MOMENTS[m.kind];
  // A crate still in the air: no thud, no dust yet; its landing brings them.
  if (spec.onLanding && !m.landed) {
    return { sound: null, dust: null, kick: reduced ? 0 : spec.kick, react: reduced ? null : spec.react };
  }
  if (reduced) return { sound: spec.sound, dust: null, kick: 0, react: null };
  return { sound: spec.sound, dust: spec.dust, kick: spec.kick, react: spec.react };
}

const KICK_SECONDS = 0.3;

/** The camera kick's offset t seconds after it began: a quick dip that rebounds and fades to nothing at 300 ms. */
export function kickAt(t: number, strength: number): number {
  if (t < 0 || t >= KICK_SECONDS) return 0;
  const k = t / KICK_SECONDS;
  return strength * Math.cos(k * Math.PI * 3) * (1 - k);
}
