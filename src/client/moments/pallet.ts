// Which animation a pallet plays when the board changes or one of its moments arrives. Pure.
import type { MomentKind } from "./list.ts";

export type PalletAnim = "arc" | "slide" | "fall" | "fold" | "fade" | "shake";

/** How long a refused pallet shakes: what follows a refusal waits for it. */
export const REFUSAL_SECONDS = 0.3;

/**
 * moved: its place changed. motion: its latest moment, counted by `at`; seen: the count it has already answered
 * (on a first view, the count when the scene opened: what was already there never replays).
 * Only the pallet whose own move it is hops; a neighbour that shifted a slot slides.
 * Reduced motion reduces, it does not remove (living site spec, 3.2): a moved crate slides to its place, a cleared one
 * fades; a parcel appears and a refusal does not shake.
 */
export function palletAnim(o: {
  moved: boolean; motion: { kind: MomentKind; at: number } | undefined; seen: number; reduced: boolean;
}): PalletAnim | null {
  const fresh = o.motion && o.motion.at > o.seen ? o.motion.kind : null;
  if (o.reduced) return o.moved ? "slide" : fresh === "cleared" ? "fade" : null;
  if (o.moved) return fresh === "pallet-moved" ? "arc" : "slide";
  if (fresh === "parcel") return "fall";
  if (fresh === "cleared") return "fold";
  if (fresh === "refused") return "shake";
  return null;
}
