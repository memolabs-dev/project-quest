// Where everything stands on the site. A road runs left to right; behind it, one yard per zone in the
// board's column order, then the buildings at the back. The player starts on the road, facing them all. Same site, same layout.
import type { Site } from "../../shared/site.ts";

export const ZONE_SPACING = 7;
const PALLET_STEP = 1.5;
const PALLET_COLS = 3;
const BUILDING_SPACING = 9;
export const BUILDING_ROW_Z = -20;
export const YARD_Z = -3;

export interface SiteLayout {
  zones: { name: string; x: number; z: number }[];
  buildings: { key: string; x: number; z: number; floors: number }[];
  pallets: { number: number; x: number; z: number }[];
}

const centred = (i: number, n: number, step: number) => (i - (n - 1) / 2) * step;

export function layoutSite(site: Site): SiteLayout {
  const zones = site.zones.map((z) => ({ name: z.name, x: centred(z.index, site.zones.length, ZONE_SPACING), z: YARD_Z }));
  const zoneX = new Map(zones.map((z) => [z.name, z.x]));
  const filled = new Map<string, number>();
  const pallets = [...site.pallets]
    .sort((a, b) => a.number - b.number)
    .map((p) => {
      const k = filled.get(p.zone) ?? 0;
      filled.set(p.zone, k + 1);
      const col = k % PALLET_COLS;
      const row = Math.floor(k / PALLET_COLS);
      return { number: p.number, x: (zoneX.get(p.zone) ?? 0) + (col - 1) * PALLET_STEP, z: YARD_Z - 1.5 - row * PALLET_STEP };
    });
  const buildings = site.buildings.map((b, i) => ({
    key: b.epicNumber === null ? "unassigned" : `epic-${b.epicNumber}`,
    x: centred(i, site.buildings.length, BUILDING_SPACING),
    z: BUILDING_ROW_Z,
    floors: b.floorsDone,
  }));
  return { zones, buildings, pallets };
}
