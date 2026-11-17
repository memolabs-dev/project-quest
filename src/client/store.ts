// Game state: the site, what the player is near, the open card and the move waiting for confirmation.
import { create } from "zustand";
import type { LevelsView, PreparedMove, SiteResponse } from "../shared/api.ts";
import type { TeamKind } from "../shared/gestures/team.ts";
import type { TutorialEvent } from "../shared/levels/types.ts";
import type { Site } from "../shared/site.ts";
import { ApiFailure, api, pageSearch } from "./api.ts";
import { laterView, siteKindFromUrl, type SiteKind } from "./levels.ts";
import { momentsBetween, type Moment } from "./moments/diff.ts";
import { loadSettings, saveSettings, type Settings } from "./settings.ts";

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
}

export type PracticeDialog = "found" | "write" | "take" | "edit" | "pull" | "merge" | "mayor" | "ask";

const sent = new Set<TutorialEvent>();
const EMPTY_PLOT: Site = { zones: [], buildings: [], pallets: [], workers: [] };

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
  settings: loadSettings(),
  moments: [],
  announce: (...m) => { if (m.length) set((s) => ({ moments: [...s.moments, ...m] })); },
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
    try {
      const r = await api.site();
      get().announce(...momentsBetween(get().site, r.site));
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
    get().announce(...momentsBetween(get().site, site));
    set({ site });
  },
  setNear: (nearPallet) => set((s) => (s.nearPallet === nearPallet ? s : { nearPallet })),
  open(openCard) {
    const was = get().openCard;
    if (openCard !== null && openCard !== was) get().announce({ kind: "card-open", pallet: openCard });
    if (openCard === null && was !== null) get().announce({ kind: "card-close", pallet: was });
    set({ openCard, pending: null });
  },
  setPending: (pending) => set({ pending }),
}));
