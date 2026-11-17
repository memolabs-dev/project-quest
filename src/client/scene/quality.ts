// The quality that lowers itself on a weak machine (living site spec, section 5): when the frame rate drops, in this
// order, the pixel ratio, then ambient occlusion at half resolution, then the miniature effect; back up when it holds.
export const QUALITY_LEVELS = 4;

export function quality(level: number, miniature: boolean): { dpr: [number, number]; aoHalf: boolean; tiltShift: boolean } {
  return { dpr: level >= 1 ? [1, 1] : [1, 2], aoHalf: level >= 2, tiltShift: miniature && level < 3 };
}

export const stepQuality = (level: number, change: "decline" | "incline"): number =>
  Math.max(0, Math.min(QUALITY_LEVELS - 1, level + (change === "decline" ? 1 : -1)));
