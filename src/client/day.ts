// A day on the site (slice 8): the jobs of the day, taken from what the board really lacks, and the day kept in the
// browser until the player closes it at the site office. Pure apart from the storage helpers.
import type { Site } from "../shared/site.ts";
import { type RadioLine, type SiteSnapshot, snapshotOf } from "./radio.ts";

export const DAY_VERSION = 1;
/** Three jobs a day at most. */
export const MAX_JOBS = 3;
/** The logbook keeps this many days. */
export const MAX_PAGES = 30;

export type Job =
  /** Someone waits for an answer on this pallet. */
  | { kind: "answer"; pallet: number; login: string }
  /** A newcomer's first pull request waits for a welcome. */
  | { kind: "welcome"; pr: number; login: string; pallet: number | null }
  /** A pallet laid since the last visit, not yet thanked. */
  | { kind: "thank"; pallet: number }
  /** The oldest open pallet in the stock, which nobody carries. */
  | { kind: "unstick"; pallet: number };

export interface OpenDay {
  v: 1;
  /** The day it started (YYYY-MM-DD); a day left open is taken up whatever today's date. */
  date: string;
  /** The site as it stood in the morning: the evening tells what moved since. */
  morning: SiteSnapshot;
  jobs: Job[];
  /** One per job; a job once done stays done. */
  done: boolean[];
}

export interface DayPage {
  /** Day 1, 2, 3… on this site. */
  n: number;
  date: string;
  jobs: Job[];
  done: boolean[];
  /** What the radio said in the evening. */
  lines: RadioLine[];
}

/** A job's words, as a locale key and its values: who to answer or welcome, which pallet to thank or to unstick. */
export function jobWords(j: Job): [string, Record<string, string | number>] {
  if (j.kind === "welcome") return ["day.job.welcome", { login: j.login, pr: j.pr }];
  if (j.kind === "answer") return ["day.job.answer", { login: j.login, pallet: j.pallet }];
  return [`day.job.${j.kind}`, { pallet: j.pallet }];
}

/** The pallet a job is about, if any: its line opens that pallet's card. */
export const jobPallet = (j: Job): number | null => j.pallet;

/**
 * The jobs to give this morning, three at most, one per pallet or person. One of each kind first, in this order: who
 * waits longest for an answer, a newcomer, a pallet to thank, the oldest stuck in the stock; then the most pressing of
 * the rest. Only the lead's own gestures.
 */
export function dayJobs(site: Site, toThank: number[]): Job[] {
  const stock = site.zones[0]?.name;
  const carried = new Set(site.workers.flatMap((w) => w.carrying));
  // Oldest first: when the oldest has a job already, the next one is the stuck pallet.
  const stuck = site.pallets
    .filter((p) => !p.closed && p.zone === stock && !carried.has(p.number))
    .sort((a, b) => a.number - b.number);
  const candidates: Job[] = [
    ...[...(site.people?.waiting ?? [])].sort((a, b) => a.since.localeCompare(b.since)).map((w): Job => ({ kind: "answer", pallet: w.pallet, login: w.login })),
    ...(site.people?.newcomers ?? []).map((n): Job => ({ kind: "welcome", pr: n.pr.number, login: n.login, pallet: n.pallet })),
    ...toThank.filter((n) => site.pallets.some((p) => p.number === n)).map((n): Job => ({ kind: "thank", pallet: n })),
    ...stuck.map((p): Job => ({ kind: "unstick", pallet: p.number })),
  ];
  const jobs: Job[] = [];
  const taken = new Set<string>();
  const take = (j: Job) => {
    const keys = [
      ...(j.kind === "welcome" ? [`pr:${j.pr}`] : []), ...(j.pallet !== null ? [`pallet:${j.pallet}`] : []), ...("login" in j ? [`login:${j.login}`] : []),
    ];
    if (jobs.length === MAX_JOBS || keys.some((k) => taken.has(k)) || (j.kind === "unstick" && jobs.some((x) => x.kind === "unstick"))) return;
    keys.forEach((k) => taken.add(k));
    jobs.push(j);
  };
  // A varied day: the first free job of each kind, then the rest in order.
  const KINDS: Job["kind"][] = ["answer", "welcome", "thank", "unstick"];
  for (const kind of KINDS) {
    for (const j of candidates.filter((c) => c.kind === kind)) {
      const before = jobs.length;
      take(j);
      if (jobs.length > before) break;
    }
  }
  for (const j of candidates) if (!jobs.includes(j)) take(j);
  // Shown in the order of the kinds, whichever pass gave them.
  return jobs.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

/**
 * Whether a job is done, from a fact on the site: they no longer wait, the newcomer left the list, the pallet left the
 * stock (or is gone). A thank-you is done when GitHub accepted it or the player said "not now" (`thanked`). A site
 * read without its people tells nothing about the people's jobs.
 */
export function jobDone(job: Job, site: Site, thanked: ReadonlySet<number>): boolean {
  switch (job.kind) {
    case "answer":
      return site.people !== undefined && !site.people.waiting.some((w) => w.pallet === job.pallet && w.login === job.login);
    case "welcome":
      return site.people !== undefined && !site.people.newcomers.some((n) => n.pr.number === job.pr);
    case "thank":
      return thanked.has(job.pallet);
    case "unstick": {
      const p = site.pallets.find((x) => x.number === job.pallet);
      return !p || p.closed || p.zone !== site.zones[0]?.name;
    }
  }
}

/** The pallets laid (closed as completed) since the radio's last picture of the site: the ones to thank. */
export function laidSince(before: SiteSnapshot | null, site: Site): number[] {
  if (!before) return [];
  return site.pallets.filter((p) => p.closed && !p.discarded && before.pallets[p.number] !== undefined && !before.pallets[p.number].closed).map((p) => p.number);
}

/** A new day: today's jobs and the morning's picture. */
export function newDay(site: Site, toThank: number[], date: string): OpenDay {
  const jobs = dayJobs(site, toThank);
  return { v: DAY_VERSION, date, morning: snapshotOf(site, date), jobs, done: jobs.map(() => false) };
}

/** The day with the jobs now done ticked; the same object when nothing changed. */
export function tick(day: OpenDay, site: Site, thanked: ReadonlySet<number>): OpenDay {
  const done = day.jobs.map((j, i) => day.done[i] || jobDone(j, site, thanked));
  return done.every((d, i) => d === day.done[i]) ? day : { ...day, done };
}

const storageOrNull = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const dayKey = (site: string) => `project-quest.day.${site}`;
const pagesKey = (site: string) => `project-quest.days.${site}`;
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** The day left open on this site, or null: none, unreadable, of another version, or storage blocked. */
export function loadDay(site: string, storage: Storage | null = storageOrNull()): OpenDay | null {
  try {
    const raw = JSON.parse(storage?.getItem(dayKey(site)) ?? "null") as unknown;
    if (!isRecord(raw) || raw.v !== DAY_VERSION || !Array.isArray(raw.jobs) || !Array.isArray(raw.done) || !isRecord(raw.morning)) return null;
    return raw as unknown as OpenDay;
  } catch {
    return null;
  }
}

export function saveDay(site: string, day: OpenDay, storage: Storage | null = storageOrNull()): void {
  try {
    storage?.setItem(dayKey(site), JSON.stringify(day));
  } catch {
    // Blocked storage: the day lasts as long as the page.
  }
}

/** The logbook's days on this site, newest first; none when unreadable or blocked. */
export function loadDays(site: string, storage: Storage | null = storageOrNull()): DayPage[] {
  try {
    const raw = JSON.parse(storage?.getItem(pagesKey(site)) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((p): p is DayPage => isRecord(p) && typeof p.n === "number" && Array.isArray(p.jobs)) : [];
  } catch {
    return [];
  }
}

/** Closes the day: its page goes on top of the logbook (30 kept), the open day is forgotten. Returns the pages. */
export function closeDay(site: string, day: OpenDay, lines: RadioLine[], storage: Storage | null = storageOrNull()): DayPage[] {
  const pages = loadDays(site, storage);
  const page: DayPage = { n: (pages[0]?.n ?? 0) + 1, date: day.date, jobs: day.jobs, done: day.done, lines };
  const next = [page, ...pages].slice(0, MAX_PAGES);
  try {
    storage?.setItem(pagesKey(site), JSON.stringify(next));
    storage?.removeItem(dayKey(site));
  } catch {
    // Blocked storage: the page shows until the page is closed.
  }
  return next;
}
