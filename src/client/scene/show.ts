// What the site shows, decided from the project's state. Pure functions: the components only draw them.
import type { Building, Site } from "../../shared/site.ts";

/** Drawn floors are capped so a huge epic stays readable; the label still says the real numbers. */
const MAX_DRAWN_FLOORS = 12;

export function buildingPlan(b: Building): { built: number; scaffold: number; roof: boolean } {
  const roof = b.floorsTotal > 0 && b.floorsDone === b.floorsTotal;
  if (b.floorsTotal <= MAX_DRAWN_FLOORS) return { built: b.floorsDone, scaffold: b.floorsTotal - b.floorsDone, roof };
  // A taller epic is drawn to scale: at least one floor once work is done, never full before it is.
  const scaled = Math.round((b.floorsDone / b.floorsTotal) * MAX_DRAWN_FLOORS);
  const built = roof ? MAX_DRAWN_FLOORS : Math.min(MAX_DRAWN_FLOORS - 1, Math.max(b.floorsDone > 0 ? 1 : 0, scaled));
  return { built, scaffold: MAX_DRAWN_FLOORS - built, roof };
}

const SIZES: Record<string, number> = { XS: 0.7, S: 0.85, M: 1, L: 1.15, XL: 1.3 };
const SPELLED: Record<string, string> = { SMALL: "S", MEDIUM: "M", LARGE: "L", "EXTRA SMALL": "XS", "EXTRA LARGE": "XL" };
/** A board's sizes are written by people: "m", "Medium" and " M " are the same size. */
export const crateScale = (size: string | null) => {
  const s = size?.trim().toUpperCase() ?? "";
  return SIZES[SPELLED[s] ?? s] ?? 1;
};

export interface WorkerSpot {
  login: string; avatarUrl: string; trade: string | null; x: number; z: number;
  /** At work: an open pallet they carry stands in a middle zone (people.ts). */
  busy: boolean;
  /** The pallet they stand by: the one a cheer goes to. */
  pallet: number;
}

/**
 * One spot per worker, beside the lowest-numbered pallet they are still working on (GitHub keeps assignees on
 * closed issues; those count only when nothing else is left). Co-assignees of one pallet stand side by side.
 */
export function workerSpots(site: Site, pallets: { number: number; x: number; z: number }[]): WorkerSpot[] {
  const at = new Map(pallets.map((p) => [p.number, p]));
  const byNumber = new Map(site.pallets.map((p) => [p.number, p]));
  const lastZone = site.zones[site.zones.length - 1]?.name;
  const done = (n: number) => { const p = byNumber.get(n); return !p || p.closed || p.zone === lastZone; };
  const standing = new Map<number, number>();
  const spots: WorkerSpot[] = [];
  for (const w of site.workers) {
    const mine = [...w.carrying].sort((a, b) => a - b).filter((n) => at.has(n));
    const first = mine.find((n) => !done(n)) ?? mine[0];
    if (first === undefined) continue;
    const p = at.get(first)!;
    const k = standing.get(first) ?? 0;
    standing.set(first, k + 1);
    spots.push({
      login: w.login, avatarUrl: w.avatarUrl, trade: byNumber.get(first)?.trade ?? null, x: p.x + 0.7 - k * 0.6, z: p.z - 0.8,
      busy: workerBusy(site, w.carrying), pallet: first,
    });
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

/**
 * A building grows when it gained floors while it stood on the site. prevDone is null when it just came into view
 * (the site opened, or it was gone and came back): then it shows as it is, without replaying a growth.
 */
export const growsNow = (prevDone: number | null, nextDone: number) => prevDone !== null && nextDone > prevDone;

const WALLS = ["#F2E3C6", "#E9C9B1", "#D9E4D1", "#E7DDEE", "#F4D9A6", "#CFE0EA"];
const TRIMS = ["#B5523B", "#3E6E8E", "#6B8F3A", "#8A5A9E", "#C2802E", "#2F6F6A"];

/** A facade per epic, stable from one visit to the next. */
export function facade(epicNumber: number | null): { wall: string; trim: string } {
  if (epicNumber === null) return { wall: "#E4E1D8", trim: "#7A7368" };
  return { wall: WALLS[epicNumber % WALLS.length], trim: TRIMS[(epicNumber * 7) % TRIMS.length] };
}

export interface TermiteSpot { number: number; x: number; z: number; scale: number }

/** Termites crawl on every open bug; a closed bug is a fixed one, so they are gone. */
export function termiteSpots(site: Site, pallets: { number: number; x: number; z: number }[]): TermiteSpot[] {
  const at = new Map(pallets.map((p) => [p.number, p]));
  return site.pallets
    .filter((p) => p.isBug && !p.closed && at.has(p.number))
    .map((p) => ({ number: p.number, x: at.get(p.number)!.x, z: at.get(p.number)!.z, scale: crateScale(p.size) }));
}

export interface CameraPose { position: number[]; target: number[] }

/**
 * The drone's arrival fly-over, t from 0 to 1: from high above the far left of the site, sweeping along the
 * buildings, down onto the follow camera's pose so the player takes over without a jump.
 */
export function dronePose(t: number, siteWidth: number, end: CameraPose): CameraPose {
  const k = Math.min(1, Math.max(0, t));
  if (k === 1) return end;
  const e = k * k * (3 - 2 * k); // smoothstep
  const start: CameraPose = { position: [-siteWidth / 2, 26, 22], target: [-siteWidth / 4, 0, -14] };
  const mix = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * e);
  return { position: mix(start.position, end.position), target: mix(start.target, end.target) };
}

/** The pallets that stand on the site: a cleared duplicate is neither in the player's way nor near them. */
export function solidPallets<P extends { number: number }>(site: { pallets: { number: number; discarded: boolean }[] }, pallets: P[]): P[] {
  const gone = new Set(site.pallets.filter((p) => p.discarded).map((p) => p.number));
  return pallets.filter((p) => !gone.has(p.number));
}

/** A worker is at work while an open pallet they carry stands in a middle zone (not the stock, not done). */
export function workerBusy(site: Site, carrying: number[]): boolean {
  const first = site.zones[0]?.name;
  const last = site.zones[site.zones.length - 1]?.name;
  return site.pallets.some((p) => carrying.includes(p.number) && !p.closed && p.zone !== first && p.zone !== last);
}
