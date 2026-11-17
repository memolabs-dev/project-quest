// Where moments come from: what a refreshed site shows changed, and what a gesture's answer says. Pure.
import type { Site } from "../../shared/site.ts";
import type { MomentKind } from "./list.ts";

export interface Moment {
  kind: MomentKind; pallet?: number; building?: number | "unassigned";
  /** Where it happens, when the one who announces it knows better than the last drawn layout. */
  spot?: [number, number];
  /** The crate touched the ground: its sound and dust play now (announced by the pallet itself). */
  landed?: boolean;
}

/**
 * The facts a refresh shows: moved, new, cleared pallets, and floors laid. Several floors laid at once make one big
 * moment (the first building that grew). A first view (prev null) shows what is there, it announces nothing.
 */
export function momentsBetween(prev: Site | null, next: Site): Moment[] {
  if (!prev) return [];
  const before = new Map(prev.pallets.map((p) => [p.number, p]));
  const now = new Set(next.pallets.map((p) => p.number));
  const grew = next.buildings.find((b) => {
    const old = prev.buildings.find((x) => x.epicNumber === b.epicNumber);
    return old !== undefined && b.floorsDone > old.floorsDone;
  });
  const moments: Moment[] = [];
  for (const p of next.pallets) {
    const old = before.get(p.number);
    if (!old) moments.push({ kind: "parcel", pallet: p.number });
    else if (p.discarded && !old.discarded) moments.push({ kind: "cleared", pallet: p.number });
    // A pallet laid in the last zone is the floor's moment when a floor grew: one celebration, not two.
    else if (p.zone !== old.zone && !(grew && p.closed && !old.closed)) moments.push({ kind: "pallet-moved", pallet: p.number });
  }
  for (const p of prev.pallets) if (!now.has(p.number)) moments.push({ kind: "cleared", pallet: p.number });
  if (grew) moments.push({ kind: "floor-laid", building: grew.epicNumber ?? "unassigned" });
  return moments;
}

/** The pallets a refresh shows newly laid (closed as completed, not cleared): the game offers to thank for them. */
export function laidBetween(prev: Site | null, next: Site): number[] {
  if (!prev) return [];
  const before = new Map(prev.pallets.map((p) => [p.number, p]));
  return next.pallets.filter((p) => p.closed && !p.discarded && before.has(p.number) && !before.get(p.number)!.closed).map((p) => p.number);
}

/** A move GitHub refused (or found stale) answers with a soft refusal; an accepted one is told by the refreshed site. */
export const momentsAfterMove = (result: { ok: boolean }, pallet: number): Moment[] =>
  result.ok ? [] : [{ kind: "refused", pallet }];
