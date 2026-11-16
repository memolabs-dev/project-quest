// Game state: the site, what the player is near, the open card and the move waiting for confirmation.
import { create } from "zustand";
import type { PreparedMove, SiteResponse } from "../shared/api.ts";
import type { Site } from "../shared/site.ts";
import { ApiFailure, api } from "./api.ts";

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
  refresh(): Promise<void>;
  setSite(site: Site): void;
  setNear(n: number | null): void;
  open(n: number | null): void;
  setPending(p: PreparedMove | null): void;
}

export const useQuest = create<QuestState>((set) => ({
  load: { status: "loading" },
  site: null,
  viewer: null,
  mode: "live",
  demoReason: null,
  nearPallet: null,
  openCard: null,
  pending: null,
  async refresh() {
    try {
      const r = await api.site();
      set({ site: r.site, viewer: r.viewer, mode: r.mode, demoReason: r.demoReason, load: { status: "ready" } });
    } catch (e) {
      set({ load: { status: "error", failure: e instanceof Error ? e : new Error(String(e)) } });
    }
  },
  setSite: (site) => set({ site }),
  setNear: (nearPallet) => set((s) => (s.nearPallet === nearPallet ? s : { nearPallet })),
  open: (openCard) => set({ openCard, pending: null }),
  setPending: (pending) => set({ pending }),
}));
