// What the site shows, decided from the project's state. Pure functions: the components only draw them.
import type { Building, Site } from "../../shared/site.ts";

/** Drawn floors are capped so a huge epic stays readable; the label still says the real numbers. */
const MAX_DRAWN_FLOORS = 12;

export function buildingPlan(b: Building): { built: number; scaffold: number; roof: boolean } {
  const built = Math.min(b.floorsDone, MAX_DRAWN_FLOORS);
  const scaffold = Math.max(0, Math.min(b.floorsTotal, MAX_DRAWN_FLOORS) - built);
  return { built, scaffold, roof: b.floorsTotal > 0 && b.floorsDone === b.floorsTotal };
}

const SIZES: Record<string, number> = { XS: 0.7, S: 0.85, M: 1, L: 1.15, XL: 1.3 };
export const crateScale = (size: string | null) => (size ? SIZES[size] ?? 1 : 1);

export interface WorkerSpot { login: string; avatarUrl: string; trade: string | null; x: number; z: number }

/** One spot per worker, beside the lowest-numbered pallet they carry. */
export function workerSpots(site: Site, pallets: { number: number; x: number; z: number }[]): WorkerSpot[] {
  const at = new Map(pallets.map((p) => [p.number, p]));
  const spots: WorkerSpot[] = [];
  for (const w of site.workers) {
    const first = [...w.carrying].sort((a, b) => a - b).find((n) => at.has(n));
    if (first === undefined) continue;
    const p = at.get(first)!;
    const pallet = site.pallets.find((x) => x.number === first);
    spots.push({ login: w.login, avatarUrl: w.avatarUrl, trade: pallet?.trade ?? null, x: p.x + 0.7, z: p.z - 0.8 });
  }
  return spots;
}

/** The letter on a worker's badge when their avatar is missing or fails to load. */
export function badgeInitial(login: string): string {
  return login.match(/[a-z0-9]/i)?.[0].toUpperCase() ?? "?";
}

const JACKETS: Record<string, string> = { mason: "#C0622F", painter: "#2F7FD0", surveyor: "#2E9B6A", architect: "#7A4FB0" };
const NO_TRADE = "#8A8F98";
/** A worker's jacket says their trade; the lead keeps the orange one. */
export const jacketColor = (trade: string | null) => (trade ? JACKETS[trade] ?? NO_TRADE : NO_TRADE);

/** Where a worker's idle loop starts (0 to 1), so the crew does not breathe in step. */
export function idleOffset(login: string): number {
  let h = 2166136261;
  for (const c of login) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Buildings that gained floors since the previous site: each grows once, however many floors came. */
export function newlyLaid(prev: Site | null, next: Site): number[] {
  if (!prev) return [];
  const before = new Map(prev.buildings.map((b) => [b.epicNumber, b.floorsDone]));
  return next.buildings
    .filter((b) => b.epicNumber !== null && b.floorsDone > (before.get(b.epicNumber) ?? b.floorsDone))
    .map((b) => b.epicNumber as number);
}

const WALLS = ["#F2E3C6", "#E9C9B1", "#D9E4D1", "#E7DDEE", "#F4D9A6", "#CFE0EA"];
const TRIMS = ["#B5523B", "#3E6E8E", "#6B8F3A", "#8A5A9E", "#C2802E", "#2F6F6A"];

/** A facade per epic, stable from one visit to the next. */
export function facade(epicNumber: number | null): { wall: string; trim: string } {
  if (epicNumber === null) return { wall: "#E4E1D8", trim: "#7A7368" };
  return { wall: WALLS[epicNumber % WALLS.length], trim: TRIMS[(epicNumber * 7) % TRIMS.length] };
}
