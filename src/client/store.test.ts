import { describe, expect, it } from "vitest";
import type { Pallet, Site } from "../shared/site.ts";
import { RADIO_LINE_MS } from "./radio.ts";
import { radioMayStart, radioTakesE, useQuest } from "./store.ts";

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
  it("loading the truck starts a hop, its landing does not start another", () => {
    const before = useQuest.getState().hop?.at ?? 0;
    useQuest.getState().announce({ kind: "loaded", pallet: 5 });
    expect(useQuest.getState().hop).toEqual({ kind: "loaded", pallet: 5, at: before + 1 });
    useQuest.getState().announce({ kind: "loaded", pallet: 5, landed: true, spot: [0, 0] });
    expect(useQuest.getState().hop?.at).toBe(before + 1);
    // The pallet itself does not move: the hop is a copy of the crate.
    expect(useQuest.getState().motions[5]).toBeUndefined();
    useQuest.getState().takeMoments();
  });
  it("a dialog opened from the card closes it with its rustle (the lead's gesture, an ask, a talk)", () => {
    const opens = [
      () => useQuest.getState().openTeam({ kind: "rope", issue: 4 }),
      () => useQuest.getState().ask(4),
      () => useQuest.getState().openTalk({ kind: "answer", number: 4 }),
    ];
    for (const openDialog of opens) {
      useQuest.getState().open(4);
      useQuest.getState().takeMoments();
      openDialog();
      expect(useQuest.getState().openCard).toBeNull();
      expect(useQuest.getState().takeMoments()).toEqual([{ kind: "card-close", pallet: 4 }]);
    }
    useQuest.setState({ teamDialog: null, practiceDialog: null, askIssue: null, talk: null });
    useQuest.getState().openTeam({ kind: "rope" });
    expect(useQuest.getState().takeMoments()).toEqual([]);
    useQuest.setState({ teamDialog: null });
  });
});

describe("the thank offer", () => {
  it("the thank offer shows once per laid pallet", () => {
    const open = site([pallet(41)]);
    const laid = site([{ ...pallet(41, "Done"), closed: true }]);
    useQuest.getState().setSite(open);
    useQuest.getState().setSite(laid);
    expect(useQuest.getState().toThank).toEqual([41]);
    useQuest.getState().dismissThank(41);
    expect(useQuest.getState().toThank).toEqual([]);
    // Seen again (a reload, a refresh that goes back and forth): offered once is enough.
    useQuest.getState().setSite(open);
    useQuest.getState().setSite(laid);
    expect(useQuest.getState().toThank).toEqual([]);
    useQuest.getState().takeMoments();
  });
});

describe("the thank offer's memory", () => {
  it("is kept per pallet address, so another site's #41 is still offered", () => {
    const at = (url: string, closed: boolean) => site([{ ...pallet(41, closed ? "Done" : "Backlog"), url, closed }]);
    useQuest.setState({ toThank: [] });
    useQuest.getState().setSite(at("https://github.com/o/a/issues/41", false));
    useQuest.getState().setSite(at("https://github.com/o/a/issues/41", true));
    expect(useQuest.getState().toThank).toEqual([41]);
    useQuest.setState({ toThank: [] });
    useQuest.getState().setSite(at("https://github.com/o/b/issues/41", false));
    useQuest.getState().setSite(at("https://github.com/o/b/issues/41", true));
    expect(useQuest.getState().toThank).toEqual([41]);
    useQuest.setState({ toThank: [] });
    useQuest.getState().takeMoments();
  });
});

describe("the radio", () => {
  const lines = [{ key: "onAir.calm", values: { variant: 0 } }, { key: "onAir.more", values: { variant: 0 } }];
  it("the radio waits for an open card", () => {
    useQuest.setState({ arrived: false, openCard: null });
    expect(radioMayStart(useQuest.getState())).toBe(false); // the fly-over is not done
    useQuest.getState().setArrived();
    expect(radioMayStart(useQuest.getState())).toBe(true);
    useQuest.getState().open(3);
    expect(radioMayStart(useQuest.getState())).toBe(false);
    useQuest.getState().open(null);
    expect(radioMayStart(useQuest.getState())).toBe(true);
    useQuest.getState().openTalk({ kind: "answer", number: 4 });
    expect(radioMayStart(useQuest.getState())).toBe(false);
    useQuest.getState().openTalk(null);
    useQuest.getState().takeMoments();
  });
  it("plays line after line, then falls silent; replay tells the same lines again", () => {
    expect(RADIO_LINE_MS).toBeGreaterThan(0);
    useQuest.getState().playRadio(lines);
    expect(useQuest.getState().radio).toEqual({ lines, at: 0 });
    useQuest.getState().nextRadioLine();
    expect(useQuest.getState().radio?.at).toBe(1);
    useQuest.getState().nextRadioLine();
    expect(useQuest.getState().radio).toBeNull();
    useQuest.getState().replayRadio();
    expect(useQuest.getState().radio).toEqual({ lines, at: 0 });
    useQuest.getState().skipRadio();
  });
  it("skip silences the radio", () => {
    useQuest.getState().playRadio(lines);
    useQuest.getState().skipRadio();
    expect(useQuest.getState().radio).toBeNull();
  });
});

describe("E by the radio set", () => {
  it("the radio wins E only when it has lines to tell", () => {
    useQuest.setState({ nearRadio: true, radioLines: [] });
    expect(radioTakesE(useQuest.getState())).toBe(false);
    useQuest.setState({ radioLines: [{ key: "onAir.calm", values: { variant: 0 } }] });
    expect(radioTakesE(useQuest.getState())).toBe(true);
    useQuest.setState({ nearRadio: false });
    expect(radioTakesE(useQuest.getState())).toBe(false);
    useQuest.setState({ radioLines: [] });
  });
});

describe("a day on the site", () => {
  const zones = ["Backlog", "Ready", "Done"].map((name, index) => ({ name, index }));
  const yard = (pallets: Pallet[]): Site => ({ zones, pallets, buildings: [], workers: [] });
  it("the morning gives the jobs, a move ticks one, the evening sums up and keeps a page", () => {
    useQuest.setState({ site: yard([pallet(5), pallet(6, "Ready")]), day: null, days: [], thanked: [] });
    const morning = useQuest.getState().beginDay("store-test", "2026-11-19", []);
    expect(morning).toMatchObject({ key: "onAir.dayJobs", values: { count: 1 } });
    expect(useQuest.getState().day?.jobs).toEqual([{ kind: "unstick", pallet: 5 }]);
    useQuest.getState().setSite(yard([pallet(5, "Ready"), pallet(6, "Ready")]));
    expect(useQuest.getState().day?.done).toEqual([true]);
    useQuest.getState().endDay();
    expect(useQuest.getState().day).toBeNull();
    expect(useQuest.getState().days).toHaveLength(1);
    // Written where the player stands until folded away.
    expect(useQuest.getState().closedDay).toBe(useQuest.getState().days[0]);
    useQuest.getState().dismissClosedDay();
    expect(useQuest.getState().closedDay).toBeNull();
    const lines = useQuest.getState().radio!.lines;
    expect(lines[lines.length - 1]).toMatchObject({ key: "onAir.dayEvening", values: { done: 1, total: 1 } });
    // A move to Ready is no radio news, but the day did something: no "dead calm" before the summing up.
    expect(lines.map((l) => l.key)).not.toContain("onAir.calm");
    useQuest.getState().skipRadio();
    useQuest.getState().takeMoments();
  });
  it("a thank-you set aside settles its job", () => {
    useQuest.setState({ site: yard([{ ...pallet(7, "Done"), closed: true }]), day: null, thanked: [], toThank: [7] });
    useQuest.getState().beginDay("store-test-2", "2026-11-19", [7]);
    expect(useQuest.getState().day?.jobs).toEqual([{ kind: "thank", pallet: 7 }]);
    useQuest.getState().dismissThank(7);
    expect(useQuest.getState().day?.done).toEqual([true]);
    useQuest.setState({ day: null, toThank: [] });
  });
  it("a site in order is a free day", () => {
    useQuest.setState({ site: yard([{ ...pallet(8, "Done"), closed: true }]), day: null, thanked: [] });
    expect(useQuest.getState().beginDay("store-test-3", "2026-11-19", []).key).toBe("onAir.dayFree");
    useQuest.setState({ day: null });
  });
});
