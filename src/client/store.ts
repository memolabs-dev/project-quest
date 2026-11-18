// Game state: the site, what the player is near, the open card and the move waiting for confirmation.
import type { PreparedWarm } from "../shared/gestures/warm.ts";
import { create } from "zustand";
import type { LevelsView, PreparedMove, RepoInfo, SiteResponse } from "../shared/api.ts";
import type { TalkKind, PreparedTalk } from "../shared/gestures/talk.ts";
import type { TeamKind } from "../shared/gestures/team.ts";
import type { TutorialEvent } from "../shared/levels/types.ts";
import type { Pallet, Site } from "../shared/site.ts";
import { ApiFailure, LANDING_REPO, api, pageSearch, visitedRepo } from "./api.ts";
import { laterView, siteKindFromUrl, type SiteKind } from "./levels.ts";
import { laidBetween, momentsBetween, type Moment } from "./moments/diff.ts";
import type { Greet } from "./moments/greet.ts";
import { loadSettings, saveSettings, type Settings } from "./settings.ts";
import { sameTarget, type TalkTarget } from "./talk.ts";

type Load = { status: "loading" } | { status: "ready" } | { status: "error"; failure: ApiFailure | Error };

interface QuestState {
  load: Load;
  site: Site | null;
  viewer: SiteResponse["viewer"] | null;
  mode: SiteResponse["mode"];
  demoReason: SiteResponse["demoReason"];
  nearPallet: number | null;
  openCard: number | null;
  pending: PreparedMove | null;
  /** Which site is played, from the page address. */
  siteKind: SiteKind;
  /** The public repository being visited, once read (#16). */
  visitRepo: RepoInfo | null;
  levels: LevelsView | null;
  /** The previous levels view, so the mentor can cheer what was just stamped. */
  levelsBefore: LevelsView | null;
  refresh(): Promise<void>;
  refreshLevels(check?: boolean): Promise<void>;
  setLevels(v: LevelsView): void;
  /** Tutorial events count only on the tutorial site, and only once each. */
  sendEvent(e: TutorialEvent): void;
  /** The practice gesture dialog open, if any. */
  practiceDialog: PracticeDialog | null;
  openPractice(d: PracticeDialog | null): void;
  /** The lead's gesture dialog open, if any, with the issue it is about. */
  teamDialog: { kind: TeamKind; issue?: number } | null;
  openTeam(d: { kind: TeamKind; issue?: number } | null): void;
  /** The real project's issue the player is asking for (level 16). */
  askIssue: number | null;
  ask(issue: number): void;
  setSite(site: Site): void;
  setNear(n: number | null): void;
  open(n: number | null): void;
  setPending(p: PreparedMove | null): void;
  /** Sound, the miniature effect, motion: kept in the browser. */
  settings: Settings;
  setSettings(patch: Partial<Settings>): void;
  /** Moments waiting for the director: announced from facts only (living site spec, 3). */
  moments: Moment[];
  announce(...m: Moment[]): void;
  /** Hands the waiting moments to the director and forgets them. */
  takeMoments(): Moment[];
  /** Each pallet's latest moment, for its own animation; `at` grows each time, so a repeat replays. */
  motions: Record<number, { kind: Moment["kind"]; at: number }>;
  /** The foreman's latest reaction to a moment; `at` changes each time, so the same reaction can repeat. */
  reaction: { kind: "cheer" | "lean"; at: number } | null;
  react(kind: "cheer" | "lean"): void;
  /** The worker within reach of a cheer, and the pallet they stand by. */
  nearWorker: { login: string; pallet: number } | null;
  setNearWorker(w: { login: string; pallet: number } | null): void;
  /** The four warm signs, open above a worker (login) or on a card (login null). */
  picker: { login: string | null; pallet: number } | null;
  openPicker(p: { login: string | null; pallet: number } | null): void;
  /** A warm gesture waiting for the player's confirmation. */
  warm: PreparedWarm | null;
  setWarm(p: PreparedWarm | null): void;
  /** The one notice over the site (a gesture's outcome); it clears by itself. */
  notice: string | null;
  say(text: string | null): void;
  /** Pallets just laid, waiting for the player's thank-you or "not now"; each is offered once. */
  toThank: number[];
  dismissThank(n: number): void;
  /** The thank-you dialog open, for this pallet. */
  thanking: number | null;
  openThank(n: number | null): void;
  /** The talk dialog open (answer someone who waits, welcome a newcomer): the number is the issue or the pull request. */
  talk: { kind: TalkKind; number: number } | null;
  openTalk(t: { kind: TalkKind; number: number } | null): void;
  /** A talk waiting for the player's confirmation. */
  talkPrepared: PreparedTalk | null;
  setTalkPrepared(p: PreparedTalk | null): void;
  /** Who the foreman can talk to where he stands (a pallet that shows a sign, or a visitor at the office). */
  nearTalk: TalkTarget | null;
  setNearTalk(t: TalkTarget | null): void;
  /** The latest warm gesture GitHub accepted: the pallet's worker answers it; `at` grows so a repeat replays. */
  greet: Greet | null;
  greetWith(g: Omit<Greet, "at">): void;
}

export type PracticeDialog = "found" | "write" | "take" | "edit" | "pull" | "merge" | "mayor" | "ask";

const sent = new Set<TutorialEvent>();
export const EMPTY_PLOT: Site = { zones: [], buildings: [], pallets: [], workers: [] };
/** Moments wait for the director at most this many: a hidden tab never piles up a flood. */
const QUEUE = 12;
/** The moments a pallet animates itself; a card's rustle or the truck's creak never replaces them. */
const MOVES_A_PALLET = new Set<Moment["kind"]>(["pallet-moved", "parcel", "cleared", "refused"]);
/** The site the moments compare with: the empty plot before founding counts as a first view. */
const shown = (site: Site | null) => (site === EMPTY_PLOT ? null : site);

/** The pallets already offered for a thank-you, remembered in the browser (read in a try: the game works without it). */
const OFFERED_KEY = "project-quest.thank-offered";
// Kept by the pallet's address (owner/repo/issues/n): the demo's #12 is not the real project's #12.
const offered = (() => {
  try {
    return new Set<string>(JSON.parse(globalThis.localStorage?.getItem(OFFERED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
})();
const laidOn = (site: Site, numbers: number[]) => site.pallets.filter((p) => numbers.includes(p.number));
/** The warm gestures belong to the configured project and the demo site: no thank-you offer on the player's own sites. */
const offerThanks = (kind: SiteKind, waiting: number[], laid: Pallet[]) => {
  if (kind !== "main" && kind !== "demo") return waiting;
  const fresh = laid.filter((p) => !offered.has(p.url || `#${p.number}`) && !waiting.includes(p.number));
  if (!fresh.length) return waiting;
  for (const p of fresh) offered.add(p.url || `#${p.number}`);
  try {
    globalThis.localStorage?.setItem(OFFERED_KEY, JSON.stringify([...offered].slice(-200)));
  } catch {
    // Not remembered: the offer may come back after a reload, nothing worse.
  }
  return [...waiting, ...fresh.map((p) => p.number)];
};

export const useQuest = create<QuestState>((set, get) => ({
  load: { status: "loading" },
  site: null,
  viewer: null,
  mode: "live",
  demoReason: null,
  nearPallet: null,
  openCard: null,
  pending: null,
  siteKind: siteKindFromUrl(pageSearch()),
  visitRepo: null,
  settings: loadSettings(),
  moments: [],
  reaction: null,
  react: (kind) => set((s) => ({ reaction: { kind, at: (s.reaction?.at ?? 0) + 1 } })),
  motions: {},
  announce(...m) {
    if (!m.length) return;
    set((s) => {
      const motions = { ...s.motions };
      let at = Object.values(s.motions).reduce((n, x) => Math.max(n, x.at), 0);
      for (const x of m) if (x.pallet !== undefined && !x.landed && MOVES_A_PALLET.has(x.kind)) motions[x.pallet] = { kind: x.kind, at: ++at };
      return { moments: [...s.moments, ...m].slice(-QUEUE), motions };
    });
  },
  takeMoments() {
    const m = get().moments;
    if (m.length) set({ moments: [] });
    return m;
  },
  setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    saveSettings(settings);
    set({ settings });
  },
  levels: null,
  levelsBefore: null,
  practiceDialog: null,
  openPractice: (practiceDialog) => set({ practiceDialog }),
  teamDialog: null,
  openTeam: (teamDialog) => set({ teamDialog, openCard: null }),
  askIssue: null,
  ask: (askIssue) => set({ askIssue, practiceDialog: "ask", openCard: null }),
  async refreshLevels(check = false) {
    // A visitor has no levels: the visit reads a stranger's repository.
    if (get().siteKind === "visit") return;
    try {
      const v = await (check ? api.checkLevels() : api.levels());
      set((s) => ({ levelsBefore: s.levels, levels: laterView(s.levels, v) }));
    } catch {
      // The levels are a layer over the site: if they cannot be read, the site still plays.
    }
  },
  setLevels: (v) => set((s) => ({ levelsBefore: s.levels, levels: laterView(s.levels, v) })),
  sendEvent(e) {
    if (get().siteKind !== "demo" || sent.has(e)) return;
    sent.add(e);
    void api.levelEvent(e).then((v) => get().setLevels(v)).catch(() => sent.delete(e));
  },
  async refresh() {
    if (get().siteKind === "visit") {
      const repo = visitedRepo();
      // No repository named yet: the visit page asks for one, over a real site drawn behind the question.
      if (!repo) {
        const site = await api.visit(LANDING_REPO).then((r) => r.site).catch(() => null);
        set({ site, visitRepo: null, load: { status: "ready" } });
        return;
      }
      try {
        const r = await api.visit(repo);
        set({ site: r.site, visitRepo: r.repo, load: { status: "ready" } });
      } catch (e) {
        set({ load: { status: "error", failure: e instanceof Error ? e : new Error(String(e)) } });
      }
      return;
    }
    try {
      const r = await api.site();
      get().announce(...momentsBetween(shown(get().site), r.site));
      set({ toThank: offerThanks(get().siteKind, get().toThank, laidOn(r.site, laidBetween(shown(get().site), r.site))) });
      set({ site: r.site, viewer: r.viewer, mode: r.mode, demoReason: r.demoReason, load: { status: "ready" } });
    } catch (e) {
      // Before founding, the practice site is an empty plot: the mentor offers to found it.
      if (e instanceof ApiFailure && e.body.error === "practice-missing") {
        set({ site: EMPTY_PLOT, mode: "live", demoReason: null, load: { status: "ready" } });
        return;
      }
      set({ load: { status: "error", failure: e instanceof Error ? e : new Error(String(e)) } });
    }
  },
  setSite(site) {
    get().announce(...momentsBetween(shown(get().site), site));
    set({ site, toThank: offerThanks(get().siteKind, get().toThank, laidOn(site, laidBetween(shown(get().site), site))) });
  },
  setNear: (nearPallet) => set((s) => (s.nearPallet === nearPallet ? s : { nearPallet })),
  open(openCard) {
    const was = get().openCard;
    if (openCard !== null && openCard !== was) get().announce({ kind: "card-open", pallet: openCard });
    if (openCard === null && was !== null) get().announce({ kind: "card-close", pallet: was });
    set({ openCard, pending: null });
  },
  setPending: (pending) => set({ pending }),
  nearWorker: null,
  // Walking away from a worker closes the signs open above them.
  setNearWorker: (w) => set((s) => (s.nearWorker?.login === w?.login && s.nearWorker?.pallet === w?.pallet ? s
    : { nearWorker: w, picker: s.picker?.login && s.picker.login !== w?.login ? null : s.picker })),
  picker: null,
  openPicker: (picker) => set({ picker }),
  warm: null,
  setWarm: (warm) => set({ warm }),
  notice: null,
  say: (notice) => set({ notice }),
  toThank: [],
  dismissThank: (n) => set((s) => ({ toThank: s.toThank.filter((x) => x !== n) })),
  thanking: null,
  talk: null,
  openTalk: (talk) => set({ talk, openCard: null }),
  talkPrepared: null,
  setTalkPrepared: (talkPrepared) => set({ talkPrepared }),
  nearTalk: null,
  setNearTalk: (t) => set((s) => (sameTarget(s.nearTalk, t) ? s : { nearTalk: t })),
  greet: null,
  greetWith: (g) => set((s) => ({ greet: { ...g, at: (s.greet?.at ?? 0) + 1 } })),
  openThank: (thanking) => set((s) => ({ thanking, toThank: thanking === null ? s.toThank : s.toThank.filter((x) => x !== thanking) })),
}));
