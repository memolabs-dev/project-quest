import { describe, expect, it } from "vitest";
import type { People } from "../shared/people.ts";
import type { Pallet, Site } from "../shared/site.ts";
import { MAX_PAGES, closeDay, dayJobs, jobDone, jobWords, laidSince, loadDay, loadDays, newDay, saveDay, tick } from "./day.ts";
import { snapshotOf } from "./radio.ts";

const memory = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: () => null, get length() { return m.size; },
  };
};
const blocked: Storage = {
  getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); },
  clear: () => {}, key: () => null, length: 0,
};

const ZONES = ["Backlog", "Ready", "In progress", "In review", "Done"].map((name, index) => ({ name, index }));
const pallet = (number: number, o: Partial<Pallet> = {}): Pallet => ({
  number, itemId: `i${number}`, title: `FICTIF ${number}`, url: "", zone: "Backlog", closed: false, discarded: false, building: null,
  isBug: false, goodFirst: false, trade: null, myReactions: [], size: null, ...o,
});
const waiting = (pallet: number, login: string, since: string) => ({ pallet, login, since, excerpt: "FICTIF" });
const newcomer = (login: string, pr: number, pallet: number | null = null) => ({
  login, avatarUrl: "", pr: { id: `pr${pr}`, number: pr, title: "FICTIF", url: "" }, pallet, contributingUrl: null,
});
const site = (pallets: Pallet[], people?: People, carrying: Record<string, number[]> = {}): Site => ({
  zones: ZONES, buildings: [], pallets,
  workers: Object.entries(carrying).map(([login, c]) => ({ login, avatarUrl: "", carrying: c })),
  ...(people ? { people } : {}),
});
const NONE = new Set<number>();

describe("the jobs of the day", () => {
  it("a varied day, three at most: one of each kind first (who waits longest, a newcomer, a thank-you, the stuck pallet)", () => {
    const s = site([pallet(1), pallet(2), pallet(3), pallet(4, { zone: "Done", closed: true })], {
      waiting: [waiting(2, "lucas", "2026-11-17T10:00:00Z"), waiting(3, "maria", "2026-11-10T10:00:00Z")],
      newcomers: [newcomer("sana", 40)],
    });
    expect(dayJobs(s, [4])).toEqual([
      { kind: "answer", pallet: 3, login: "maria" },
      { kind: "welcome", pr: 40, login: "sana", pallet: null },
      { kind: "thank", pallet: 4 },
    ]);
  });
  it("then the most pressing of the rest", () => {
    const s = site([pallet(2, { zone: "Ready" }), pallet(3, { zone: "Ready" })], {
      waiting: [waiting(2, "lucas", "2026-11-17T10:00:00Z"), waiting(3, "maria", "2026-11-10T10:00:00Z")],
      newcomers: [newcomer("sana", 40), newcomer("jo", 41)],
    });
    expect(dayJobs(s, [])).toEqual([
      { kind: "answer", pallet: 3, login: "maria" },
      { kind: "answer", pallet: 2, login: "lucas" },
      { kind: "welcome", pr: 40, login: "sana", pallet: null },
    ]);
  });
  it("one job per pallet and per person", () => {
    const s = site([pallet(1), pallet(2)], {
      waiting: [waiting(1, "maria", "2026-11-10T10:00:00Z"), waiting(2, "maria", "2026-11-11T10:00:00Z")],
      newcomers: [newcomer("maria", 41, 2)],
    });
    expect(dayJobs(s, [])).toEqual([{ kind: "answer", pallet: 1, login: "maria" }, { kind: "unstick", pallet: 2 }]);
  });
  it("the stuck pallet is the oldest open one in the stock that nobody carries", () => {
    const s = site([pallet(9), pallet(5), pallet(3), pallet(2, { zone: "Ready" }), pallet(1, { closed: true })], undefined, { lucas: [3] });
    expect(dayJobs(s, [])).toEqual([{ kind: "unstick", pallet: 5 }]);
  });
  it("a pallet to thank must still be on the site", () => {
    expect(dayJobs(site([pallet(1, { zone: "Done", closed: true })]), [1, 7])).toEqual([{ kind: "thank", pallet: 1 }]);
  });
  it("a site in order gives a free day", () => {
    expect(dayJobs(site([pallet(1, { zone: "Done", closed: true })], { waiting: [], newcomers: [] }), [])).toEqual([]);
  });
});

describe("a job done", () => {
  const people = (w: ReturnType<typeof waiting>[], n: ReturnType<typeof newcomer>[] = []): People => ({ waiting: w, newcomers: n });
  it("an answer is done when they no longer wait; a site read without its people tells nothing", () => {
    const job = { kind: "answer", pallet: 2, login: "maria" } as const;
    expect(jobDone(job, site([pallet(2)], people([waiting(2, "maria", "x")])), NONE)).toBe(false);
    expect(jobDone(job, site([pallet(2)], people([])), NONE)).toBe(true);
    expect(jobDone(job, site([pallet(2)]), NONE)).toBe(false);
  });
  it("a welcome is done when the newcomer left the list", () => {
    const job = { kind: "welcome", pr: 40, login: "sana", pallet: null } as const;
    expect(jobDone(job, site([], people([], [newcomer("sana", 40)])), NONE)).toBe(false);
    expect(jobDone(job, site([], people([])), NONE)).toBe(true);
  });
  it("a thank-you is done when accepted or set aside", () => {
    const job = { kind: "thank", pallet: 4 } as const;
    expect(jobDone(job, site([pallet(4)]), NONE)).toBe(false);
    expect(jobDone(job, site([pallet(4)]), new Set([4]))).toBe(true);
  });
  it("the stuck pallet is done when it left the stock, was closed or is gone", () => {
    const job = { kind: "unstick", pallet: 5 } as const;
    expect(jobDone(job, site([pallet(5)]), NONE)).toBe(false);
    expect(jobDone(job, site([pallet(5, { zone: "Ready" })]), NONE)).toBe(true);
    expect(jobDone(job, site([pallet(5, { closed: true })]), NONE)).toBe(true);
    expect(jobDone(job, site([]), NONE)).toBe(true);
  });
  it("a job once done stays done", () => {
    const s = site([pallet(5)]);
    const day = newDay(s, [], "2026-11-19");
    const moved = tick(day, site([pallet(5, { zone: "Ready" })]), NONE);
    expect(moved.done).toEqual([true]);
    expect(tick(moved, s, NONE).done).toEqual([true]);
    expect(tick(moved, s, NONE)).toBe(moved);
  });
});

describe("the day kept in the browser", () => {
  it("an open day is taken up; closing it writes a page and forgets it", () => {
    const storage = memory();
    const day = newDay(site([pallet(5)]), [], "2026-11-19");
    saveDay("demo", day, storage);
    expect(loadDay("demo", storage)).toEqual(day);
    expect(loadDay("main", storage)).toBeNull();
    const pages = closeDay("demo", { ...day, done: [true] }, [{ key: "onAir.calm", values: {} }], storage);
    expect(pages).toEqual([{ n: 1, date: "2026-11-19", jobs: day.jobs, done: [true], lines: [{ key: "onAir.calm", values: {} }] }]);
    expect(loadDay("demo", storage)).toBeNull();
    expect(closeDay("demo", newDay(site([]), [], "2026-11-20"), [], storage).map((p) => p.n)).toEqual([2, 1]);
    expect(loadDays("demo", storage).map((p) => p.n)).toEqual([2, 1]);
  });
  it("the logbook keeps the 30 most recent days", () => {
    const storage = memory();
    const day = newDay(site([]), [], "2026-11-19");
    for (let i = 0; i < MAX_PAGES + 5; i++) closeDay("demo", day, [], storage);
    const pages = loadDays("demo", storage);
    expect(pages).toHaveLength(MAX_PAGES);
    expect(pages[0].n).toBe(MAX_PAGES + 5);
  });
  it("a day of another version or unreadable is no day", () => {
    const storage = memory();
    storage.setItem("project-quest.day.demo", JSON.stringify({ v: 2, jobs: [], done: [], morning: {} }));
    expect(loadDay("demo", storage)).toBeNull();
    storage.setItem("project-quest.day.demo", "{not json");
    expect(loadDay("demo", storage)).toBeNull();
  });
  it("blocked storage breaks nothing: no day kept, the page still shows", () => {
    const day = newDay(site([]), [], "2026-11-19");
    expect(() => saveDay("demo", day, blocked)).not.toThrow();
    expect(loadDay("demo", blocked)).toBeNull();
    expect(loadDays("demo", blocked)).toEqual([]);
    expect(closeDay("demo", day, [], blocked).map((p) => p.n)).toEqual([1]);
  });
});

describe("the pallets laid since the last visit", () => {
  it("only those the last picture saw open, and laid as completed", () => {
    const before = snapshotOf(site([pallet(1), pallet(2), pallet(3, { zone: "Done", closed: true })]), "2026-11-18");
    const now = site([pallet(1, { zone: "Done", closed: true }), pallet(2, { closed: true, discarded: true }), pallet(3, { zone: "Done", closed: true }), pallet(9, { zone: "Done", closed: true })]);
    expect(laidSince(before, now)).toEqual([1]);
    expect(laidSince(null, now)).toEqual([]);
  });
});

describe("a job's words", () => {
  it("names who and which pallet, in the locales", () => {
    expect(jobWords({ kind: "answer", pallet: 2, login: "maria" })).toEqual(["day.job.answer", { login: "maria", pallet: 2 }]);
    expect(jobWords({ kind: "welcome", pr: 40, login: "sana", pallet: null })).toEqual(["day.job.welcome", { login: "sana", pr: 40 }]);
    expect(jobWords({ kind: "unstick", pallet: 5 })).toEqual(["day.job.unstick", { pallet: 5 }]);
  });
});
