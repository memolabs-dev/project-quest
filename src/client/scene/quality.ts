// The quality that lowers itself on a weak machine (living site spec, section 5): when the frame rate drops, in this
// order, the pixel ratio, then ambient occlusion at half resolution, then the miniature effect; back up when it holds.
export const QUALITY_LEVELS = 4;

/**
 * The quality at a level. `screen` is the screen's own pixel ratio: lowering to one pixel per point changes nothing on
 * a screen that already has one, so there the first step draws three pixels for four.
 */
export function quality(level: number, miniature: boolean, screen = 2): { dpr: [number, number]; aoHalf: boolean; tiltShift: boolean } {
  const low: [number, number] = screen > 1 ? [1, 1] : [0.75, 0.75];
  return { dpr: level >= 1 ? low : [1, 2], aoHalf: level >= 2, tiltShift: miniature && level < 3 };
}

export const stepQuality = (level: number, change: "decline" | "incline"): number =>
  Math.max(0, Math.min(QUALITY_LEVELS - 1, level + (change === "decline" ? 1 : -1)));

/** The quality's state: its level, the last change, how many times it changed direction, and whether it stays put. */
export interface QualityState { level: number; last: "decline" | "incline" | null; reversals: number; frozen: boolean }
export const QUALITY_START: QualityState = { level: 0, last: null, reversals: 0, frozen: false };

/**
 * One frame-rate verdict applied. A verdict that changes nothing (an incline at full quality, a decline at the lowest)
 * is ignored: a healthy machine is told "incline" every few seconds. After three real changes of direction the level
 * stays where it is: each change rebuilds the effects' shaders, and going back and forth costs more than it saves.
 */
export function nextQuality(s: QualityState, change: "decline" | "incline"): QualityState {
  if (s.frozen) return s;
  const level = stepQuality(s.level, change);
  if (level === s.level) return s;
  const reversals = s.last && s.last !== change ? s.reversals + 1 : s.reversals;
  return { level, last: change, reversals, frozen: reversals >= 3 };
}
