// Game state: the site, what the player is near, the open card and the move waiting for confirmation.
import { create } from "zustand";
import type { LevelsView, PreparedMove, SiteResponse } from "../shared/api.ts";
import type { TutorialEvent } from "../shared/levels/types.ts";
import type { Site } from "../shared/site.ts";
import { ApiFailure, api } from "./api.ts";
import { laterView, siteKindFromUrl, type SiteKind } from "./levels.ts";

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
  setSite(site: Site): void;
  setNear(n: number | null): void;
  open(n: number | null): void;
  setPending(p: PreparedMove | null): void;
}

export type PracticeDialog = "found" | "write" | "take" | "edit" | "pull" | "merge";

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
  siteKind: typeof location === "undefined" ? "main" : siteKindFromUrl(location.search),
  levels: null,
  levelsBefore: null,
  practiceDialog: null,
  openPractice: (practiceDialog) => set({ practiceDialog }),
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
  setSite: (site) => set({ site }),
  setNear: (nearPallet) => set((s) => (s.nearPallet === nearPallet ? s : { nearPallet })),
  open: (openCard) => set({ openCard, pending: null }),
  setPending: (pending) => set({ pending }),
}));
