import { describe, expect, it } from "vitest";
import type { Pallet, Site } from "../shared/site.ts";
import { useQuest } from "./store.ts";

const pallet = (number: number, zone = "Backlog"): Pallet => ({
  number, itemId: `I${number}`, title: "FICTIF", url: "", zone, closed: false, discarded: false,
  building: null, isBug: false, goodFirst: false, trade: null, size: null,
});
const site = (pallets: Pallet[]): Site => ({ zones: [], pallets, buildings: [], workers: [] });

describe("the store's moments", () => {
  it("a new site view announces what changed, once; the director takes them", () => {
    const s = useQuest.getState();
    s.takeMoments();
    s.setSite(site([pallet(1)]));
    expect(useQuest.getState().takeMoments()).toEqual([]);
    useQuest.getState().setSite(site([pallet(1, "Ready")]));
    expect(useQuest.getState().takeMoments()).toEqual([{ kind: "pallet-moved", pallet: 1 }]);
    expect(useQuest.getState().takeMoments()).toEqual([]);
  });
  it("each pallet keeps its latest motion for its own animation, counted so a repeat replays", () => {
    useQuest.getState().announce({ kind: "refused", pallet: 7 });
    const first = useQuest.getState().motions[7];
    useQuest.getState().announce({ kind: "refused", pallet: 7 }, { kind: "parcel", pallet: 8 });
    expect(useQuest.getState().motions[7]).toMatchObject({ kind: "refused" });
    expect(useQuest.getState().motions[7].at).toBeGreaterThan(first.at);
    expect(useQuest.getState().motions[8]).toMatchObject({ kind: "parcel" });
    useQuest.getState().takeMoments();
  });
  it("opening and closing a card announce their rustle", () => {
    useQuest.getState().takeMoments();
    useQuest.getState().open(3);
    useQuest.getState().open(null);
    useQuest.getState().open(null);
    expect(useQuest.getState().takeMoments()).toEqual([{ kind: "card-open", pallet: 3 }, { kind: "card-close", pallet: 3 }]);
  });
});
