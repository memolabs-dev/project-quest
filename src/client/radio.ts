// The site radio's memory and words: a small picture of the site kept in the browser, the comparison with today's
// site, and the lines to say. Pure apart from the storage helpers; works only on the site already loaded.
import type { Site } from "../shared/site.ts";
import type { SiteKind } from "./levels.ts";

export const RADIO_VERSION = 1;
export const MAX_LINES = 5;
/** Each line stays about this long, and the radio starts this long after the arrival fly-over ends. */
export const RADIO_LINE_MS = 3000;
export const RADIO_DELAY_MS = 1000;

/** Every kind of line has this many variants in the locales (`onAir.<kind>_0`, `_1`, `_2`). */
const VARIANTS = 3;

export interface SiteSnapshot {
  v: 1;
  at: string;
  pallets: Record<number, { zone: string; closed: boolean; discarded: boolean; bug: boolean }>;
  /** Floors laid per building, keyed like the layout: `epic-<n>` or `unassigned`. */
  floors: Record<string, number>;
  workers: string[];
}

export interface RadioLine {
  /** The text key without its variant: the words are `<key>_<variant>`, with `_one` or `_other` when it has a count. */
  key: string;
  values: Record<string, string | number>;
  /** Set when the line is about one pallet: a click opens its card. */
  pallet?: number;
}

const buildingKey = (epicNumber: number | null) => (epicNumber === null ? "unassigned" : `epic-${epicNumber}`);

export function snapshotOf(site: Site, at: string): SiteSnapshot {
  const pallets: SiteSnapshot["pallets"] = {};
  for (const p of site.pallets) pallets[p.number] = { zone: p.zone, closed: p.closed, discarded: p.discarded, bug: p.isBug };
  const floors: SiteSnapshot["floors"] = {};
  for (const b of site.buildings) floors[buildingKey(b.epicNumber)] = b.floorsDone;
  return { v: RADIO_VERSION, at, pallets, floors, workers: site.workers.map((w) => w.login) };
}

/** The variant of a line: the day's number modulo the count, never chance. */
export function variantOf(date: string, count: number): number {
  const day = Number(date.split("-")[2]);
  return Number.isFinite(day) && day >= 0 ? day % count : 0;
}

type Fact = { key: string; values: Record<string, string | number>; pallet?: number };

/** One fact about a set of pallets: it points at the pallet only when it is a single one. */
const aboutPallets = (key: string, numbers: number[]): Fact | null =>
  numbers.length === 0 ? null : { key, values: { count: numbers.length }, ...(numbers.length === 1 ? { pallet: numbers[0] } : {}) };

export function radioLines(before: SiteSnapshot | null, now: Site, date: string, site: string): RadioLine[] {
  const variant = variantOf(date, VARIANTS);
  const line = (f: Fact): RadioLine => ({ key: f.key, values: { ...f.values, variant }, ...(f.pallet !== undefined ? { pallet: f.pallet } : {}) });

  if (!before) {
    const inspection = now.pallets.filter((p) => !p.closed && p.zone === "In review").length;
    return [line({ key: "onAir.welcome", values: { site, buildings: now.buildings.filter((b) => b.epicNumber !== null).length, inspection } })];
  }

  const facts: Fact[] = [];
  for (const b of now.buildings) {
    const gained = b.floorsDone - (before.floors[buildingKey(b.epicNumber)] ?? 0);
    if (gained > 0) {
      facts.push(b.epicNumber === null ? { key: "onAir.floorsUnassigned", values: { count: gained } } : { key: "onAir.floors", values: { count: gained, title: b.title } });
    }
  }
  const was = (n: number) => before.pallets[n];
  const isLaid = (p: { closed: boolean; discarded: boolean }) => p.closed && !p.discarded;
  const isActiveBug = (p: { bug: boolean; closed: boolean }) => p.bug && !p.closed;
  const numbers = (pick: (p: Site["pallets"][number], old: SiteSnapshot["pallets"][number] | undefined) => boolean) =>
    now.pallets.filter((p) => pick(p, was(p.number))).map((p) => p.number);

  const laid = aboutPallets("onAir.laid", numbers((p, old) => isLaid(p) && !(old && isLaid(old))));
  const review = aboutPallets("onAir.review", numbers((p, old) => !p.closed && p.zone === "In review" && old?.zone !== "In review"));
  const progress = aboutPallets("onAir.progress", numbers((p, old) => !p.closed && p.zone === "In progress" && old?.zone !== "In progress"));
  const parcels = aboutPallets("onAir.parcels", numbers((_p, old) => old === undefined));
  const termitesIn = aboutPallets("onAir.termitesIn", numbers((p, old) => isActiveBug({ bug: p.isBug, closed: p.closed }) && !(old && isActiveBug(old))));
  const termitesOut = aboutPallets("onAir.termitesOut", numbers((p, old) => p.isBug && p.closed && old !== undefined && isActiveBug(old)));
  for (const f of [laid, review, progress, parcels, termitesIn, termitesOut]) if (f) facts.push(f);

  const known = new Set(before.workers);
  for (const w of now.workers) if (!known.has(w.login)) facts.push({ key: "onAir.helmet", values: { login: w.login } });

  if (facts.length === 0) return [line({ key: "onAir.calm", values: {} })];
  if (facts.length > MAX_LINES) return [...facts.slice(0, MAX_LINES - 1).map(line), line({ key: "onAir.more", values: {} })];
  return facts.map(line);
}

/** The storage key's site part: `main`, `demo`, `practice`, `team`, or `visit:<owner/repo lowercased>`. */
export function radioSiteKey(kind: SiteKind, visitRepo: string | null): string {
  return kind === "visit" ? `visit:${(visitRepo ?? "").toLowerCase()}` : kind;
}

const storageOrNull = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const storageKey = (key: string) => `project-quest.radio.${key}`;
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** The stored picture, or null: nothing stored, unreadable, of another version, or storage blocked. */
export function loadSnapshot(key: string, storage: Storage | null = storageOrNull()): SiteSnapshot | null {
  try {
    const raw = JSON.parse(storage?.getItem(storageKey(key)) ?? "null") as unknown;
    if (!isRecord(raw) || raw.v !== RADIO_VERSION || !isRecord(raw.pallets) || !isRecord(raw.floors) || !Array.isArray(raw.workers)) return null;
    return raw as unknown as SiteSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(key: string, s: SiteSnapshot, storage: Storage | null = storageOrNull()): void {
  try {
    storage?.setItem(storageKey(key), JSON.stringify(s));
  } catch {
    // Blocked storage: every visit is a first visit.
  }
}

/** The lines to say now. Today's picture is written before returning, so a reload does not repeat the news. */
export function chooseLines(key: string, site: Site, date: string, name: string, storage: Storage | null = storageOrNull()): RadioLine[] {
  const lines = radioLines(loadSnapshot(key, storage), site, date, name);
  saveSnapshot(key, snapshotOf(site, date), storage);
  return lines;
}
