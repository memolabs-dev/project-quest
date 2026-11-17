// Which animation a pallet plays when the board changes or one of its moments arrives. Pure.
import type { MomentKind } from "./list.ts";

export type PalletAnim = "arc" | "slide" | "fall" | "fold" | "shake";

/**
 * moved: its place changed. motion: its latest moment, counted by `at`; seen: the count it has already answered
 * (on a first view, the count when the scene opened: what was already there never replays).
 * Only the pallet whose own move it is hops; a neighbour that shifted a slot slides.
 */
export function palletAnim(o: {
  moved: boolean; motion: { kind: MomentKind; at: number } | undefined; seen: number; reduced: boolean;
}): PalletAnim | null {
  if (o.reduced) return null;
  const fresh = o.motion && o.motion.at > o.seen ? o.motion.kind : null;
  if (o.moved) return fresh === "pallet-moved" ? "arc" : "slide";
  if (fresh === "parcel") return "fall";
  if (fresh === "cleared") return "fold";
  if (fresh === "refused") return "shake";
  return null;
}
