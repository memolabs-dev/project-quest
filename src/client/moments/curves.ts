// The motion curves of the moments, over t from 0 to 1. Pure.

/** A hop: eased along the way, up and down on a parabola, `height` at the top. */
export function arc(t: number, height: number): { along: number; up: number } {
  const k = Math.min(1, Math.max(0, t));
  const along = k === 1 ? 1 : 1 - Math.pow(1 - k, 2);
  return { along, up: 4 * height * k * (1 - k) };
}

/** The vertical scale of a landing: flattened at first, back to 1 with a small bounce. */
export function squash(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  if (k === 0 || k === 1) return 1;
  return 1 - 0.28 * Math.sin(k * Math.PI) * (1 - k);
}

/** Grows past its size (about 1.12) then settles on 1: the new floor. */
export function overshoot(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  if (k === 0) return 0;
  if (k === 1) return 1;
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

/** A sideways shake, three times, ending at rest: a refusal. */
export function shake(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  if (k === 1) return 0;
  return Math.sin(k * Math.PI * 6) * (1 - k);
}
