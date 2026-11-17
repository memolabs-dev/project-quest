import { describe, expect, it } from "vitest";
import type { Building, Pallet, Site } from "../../shared/site.ts";
import { momentsAfterMove, momentsBetween } from "./diff.ts";

const pallet = (number: number, o: Partial<Pallet> = {}): Pallet => ({
  number, itemId: `I${number}`, title: "FICTIF", url: "", zone: "Backlog", closed: false, discarded: false,
  building: null, isBug: false, goodFirst: false, trade: null, size: null, myReactions: [], ...o,
});
const building = (epicNumber: number | null, floorsDone: number): Building => ({ epicNumber, title: "FICTIF", floorsDone, floorsTotal: 6 });
const site = (pallets: Pallet[], buildings: Building[] = []): Site => ({ zones: [], pallets, buildings, workers: [] });

describe("momentsBetween", () => {
  it("a moved pallet", () => {
    expect(momentsBetween(site([pallet(1)]), site([pallet(1, { zone: "Ready" })]))).toEqual([{ kind: "pallet-moved", pallet: 1 }]);
  });
  it("a new parcel", () => {
    expect(momentsBetween(site([pallet(1)]), site([pallet(1), pallet(2)]))).toEqual([{ kind: "parcel", pallet: 2 }]);
  });
  it("a cleared duplicate, gone or discarded", () => {
    expect(momentsBetween(site([pallet(1), pallet(2)]), site([pallet(1)]))).toEqual([{ kind: "cleared", pallet: 2 }]);
    expect(momentsBetween(site([pallet(2)]), site([pallet(2, { closed: true, discarded: true, zone: "Done" })]))).toEqual([{ kind: "cleared", pallet: 2 }]);
  });
  it("one big moment for several floors", () => {
    const before = site([], [building(1, 1), building(2, 0), building(null, 2)]);
    const after = site([], [building(1, 2), building(2, 3), building(null, 3)]);
    expect(momentsBetween(before, after)).toEqual([{ kind: "floor-laid", building: 1 }]);
  });
  it("a pallet laid in the last zone is the floor's moment, not a second one", () => {
    const before = site([pallet(1, { building: 1 })], [building(1, 1)]);
    const after = site([pallet(1, { building: 1, zone: "Done", closed: true })], [building(1, 2)]);
    expect(momentsBetween(before, after)).toEqual([{ kind: "floor-laid", building: 1 }]);
  });
  it("nothing announced on a first view or a new site", () => {
    expect(momentsBetween(null, site([pallet(1), pallet(2)], [building(1, 2)]))).toEqual([]);
  });
});

describe("momentsAfterMove", () => {
  it("a refused move announces refused, never pallet-moved", () => {
    expect(momentsAfterMove({ ok: false }, 4)).toEqual([{ kind: "refused", pallet: 4 }]);
    // An accepted move is announced by the refreshed site, once.
    expect(momentsAfterMove({ ok: true }, 4)).toEqual([]);
  });
});
