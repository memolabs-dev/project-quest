import { describe, expect, it } from "vitest";
import type { Pallet, Site } from "../shared/site.ts";
import { useQuest } from "./store.ts";

const pallet = (number: number, zone = "Backlog"): Pallet => ({
  number, itemId: `I${number}`, title: "FICTIF", url: "", zone, closed: false, discarded: false,
  building: null, isBug: false, goodFirst: false, trade: null, size: null, myReactions: [],
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
  it("founding a site from the empty plot brings no flood of parcels", async () => {
    const { EMPTY_PLOT } = await import("./store.ts");
    useQuest.getState().setSite(EMPTY_PLOT);
    useQuest.getState().takeMoments();
    useQuest.getState().setSite(site([pallet(1), pallet(2), pallet(3)]));
    expect(useQuest.getState().takeMoments()).toEqual([]);
  });
  it("keeps only the latest moments when nothing plays them (a hidden tab)", () => {
    useQuest.getState().takeMoments();
    for (let i = 0; i < 40; i++) useQuest.getState().announce({ kind: "stamp" });
    expect(useQuest.getState().takeMoments()).toHaveLength(12);
  });
  it("a landing is played, never a new motion for the pallet", () => {
    const before = useQuest.getState().motions[1];
    useQuest.getState().announce({ kind: "pallet-moved", pallet: 1, landed: true, spot: [0, 0] });
    expect(useQuest.getState().motions[1]).toBe(before);
    useQuest.getState().takeMoments();
  });
  it("a card's rustle never replaces the pallet's own motion (closing the card right after a move)", () => {
    useQuest.getState().announce({ kind: "pallet-moved", pallet: 9 }, { kind: "card-close", pallet: 9 }, { kind: "card-open", pallet: 9 });
    expect(useQuest.getState().motions[9]).toMatchObject({ kind: "pallet-moved" });
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
