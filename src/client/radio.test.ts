import i18next from "i18next";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Building, Pallet, Site } from "../shared/site.ts";
import { chooseLines, loadSnapshot, MAX_LINES, RADIO_VERSION, radioLines, radioSiteKey, saveSnapshot, snapshotOf, variantOf } from "./radio.ts";

const locale = (lang: string) => JSON.parse(readFileSync(new URL(`../locales/${lang}/common.json`, import.meta.url), "utf8")) as Record<string, unknown>;
const en = locale("en");
const fr = locale("fr");

const memory = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: () => null, get length() { return m.size; },
  };
};
const blocked: Storage = {
  getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {},
  clear: () => {}, key: () => null, length: 0,
};

const pallet = (number: number, o: Partial<Pallet> = {}): Pallet => ({
  number, itemId: `i${number}`, title: `Pallet ${number}`, url: "", zone: "Backlog", closed: false, discarded: false, building: 1,
  isBug: false, goodFirst: false, trade: null, myReactions: [], size: null, ...o,
});
const laidPallet = (n: number, o: Partial<Pallet> = {}) => pallet(n, { zone: "Done", closed: true, ...o });
const building = (epicNumber: number | null, title: string, floorsDone: number, floorsTotal: number): Building => ({ epicNumber, title, floorsDone, floorsTotal });
const site = (pallets: Pallet[], buildings: Building[] = [building(1, "Public map", 0, 10)], logins: string[] = []): Site => ({
  zones: [], buildings, pallets, workers: logins.map((login) => ({ login, avatarUrl: "", carrying: [] })),
});
const DAY = "2026-11-18";
const keys = (lines: { key: string }[]) => lines.map((l) => l.key);

describe("the radio", () => {
  it("the first visit presents the site", () => {
    const s = site([pallet(1, { zone: "In review" }), pallet(2)], [building(1, "A", 0, 2), building(2, "B", 0, 0)]);
    const lines = radioLines(null, s, DAY, "vitejs/vite");
    expect(lines).toHaveLength(1);
    expect(lines[0].key).toBe("onAir.welcome");
    expect(lines[0].values).toMatchObject({ site: "vitejs/vite", buildings: 2, inspection: 1 });
  });

  it("nothing moved says the calm line", () => {
    const s = site([pallet(1)], [building(1, "A", 0, 1)], ["maria"]);
    const lines = radioLines(snapshotOf(s, "2026-11-17"), s, DAY, "x");
    expect(keys(lines)).toEqual(["onAir.calm"]);
  });

  it("floors laid come first, building by building", () => {
    const before = snapshotOf(site([pallet(1), pallet(2), pallet(3, { building: null })], [building(1, "Public map", 0, 2), building(null, "", 0, 1)]), "t");
    const now = site(
      [laidPallet(1), laidPallet(2), laidPallet(3, { building: null })],
      [building(1, "Public map", 2, 2), building(null, "", 1, 1)],
    );
    const lines = radioLines(before, now, DAY, "x");
    expect(keys(lines).slice(0, 2)).toEqual(["onAir.floors", "onAir.floorsUnassigned"]);
    expect(lines[0].values).toMatchObject({ title: "Public map", count: 2 });
    expect(lines[1].values).toMatchObject({ count: 1 });
    expect(lines[1].values).not.toHaveProperty("title");
    expect(keys(lines)).toContain("onAir.laid");
  });

  it("a visit's group building (negative epic number) is a floors line too", () => {
    const before = snapshotOf(site([pallet(1, { building: -1 })], [building(-1, "Group", 0, 1)]), "t");
    const now = site([laidPallet(1, { building: -1 })], [building(-1, "Group", 1, 1)]);
    expect(before.floors).toEqual({ "epic--1": 0 });
    expect(radioLines(before, now, DAY, "x")[0].key).toBe("onAir.floors");
  });

  it("laid, review, progress, parcels, termites and helmets, in that order", () => {
    const before = snapshotOf(
      site([pallet(1), pallet(2), pallet(3), pallet(4, { isBug: true }), pallet(5)], [building(1, "A", 0, 5)], ["maria"]), "t",
    );
    const now = site(
      [
        pallet(1, { zone: "Done", closed: true, isBug: false }), pallet(2, { zone: "In review" }), pallet(3, { zone: "In progress" }),
        pallet(4, { isBug: true, zone: "Done", closed: true }), pallet(5), pallet(6), pallet(7), pallet(8, { isBug: true }),
      ],
      [building(1, "A", 0, 8)],
      ["maria", "lucas"],
    );
    // Seven facts, so four lines and the rest.
    const lines = radioLines(before, now, DAY, "x");
    expect(keys(lines)).toEqual(["onAir.laid", "onAir.review", "onAir.progress", "onAir.parcels", "onAir.more"]);
    const fewer = radioLines(snapshotOf(site([pallet(4, { isBug: true })], [building(1, "A", 0, 1)], ["maria"]), "t"), site([laidPallet(4, { isBug: true }), pallet(9, { isBug: true })], [building(1, "A", 1, 2)], ["maria", "lucas"]), DAY, "x");
    expect(keys(fewer)).toEqual(["onAir.floors", "onAir.laid", "onAir.parcels", "onAir.termitesIn", "onAir.more"]);
  });

  it("each fact kind speaks when alone, in order", () => {
    const before = snapshotOf(site([pallet(1, { isBug: true }), pallet(2)], [building(1, "A", 0, 2)], ["maria"]), "t");
    const now = site([laidPallet(1, { isBug: true }), pallet(2, { zone: "In review" }), pallet(3, { isBug: true })], [building(1, "A", 0, 3)], ["maria"]);
    const lines = radioLines(before, now, DAY, "x");
    expect(keys(lines)).toEqual(["onAir.laid", "onAir.review", "onAir.parcels", "onAir.termitesIn", "onAir.termitesOut"]);
    const solo = radioLines(before, site([pallet(1, { isBug: true }), pallet(2)], [building(1, "A", 0, 2)], ["maria", "lucas"]), DAY, "x");
    expect(solo).toEqual([{ key: "onAir.helmet", values: { variant: expect.any(Number), login: "lucas" } }]);
    // A single pallet is pointed at; several are not.
    expect(lines[0].pallet).toBe(1);
    expect(lines[1].pallet).toBe(2);
    expect(lines[2].pallet).toBe(3);
  });

  it("lines about several pallets do not point at one", () => {
    const before = snapshotOf(site([pallet(1), pallet(2)]), "t");
    const lines = radioLines(before, site([laidPallet(1), laidPallet(2)], [building(1, "A", 0, 2)]), DAY, "x");
    expect(lines[0]).toMatchObject({ key: "onAir.laid", values: { count: 2 } });
    expect(lines[0].pallet).toBeUndefined();
  });

  it("more facts than lines end with and more besides", () => {
    const many = Array.from({ length: 300 }, (_, i) => i + 1);
    const before = snapshotOf(site([], [building(1, "A", 0, 0)], []), "t");
    const now = site(
      many.map((n) => laidPallet(n)),
      [building(1, "A", 300, 300), building(2, "B", 4, 4), building(3, "C", 4, 4), building(4, "D", 4, 4), building(5, "E", 4, 4), building(6, "F", 4, 4)],
      many.map((n) => `w${n}`),
    );
    const lines = radioLines(before, now, DAY, "x");
    expect(lines).toHaveLength(MAX_LINES);
    expect(lines[MAX_LINES - 1].key).toBe("onAir.more");
    expect(lines.slice(0, MAX_LINES - 1).every((l) => l.key !== "onAir.more")).toBe(true);
  });

  it("no line holds a login and a number", () => {
    const before = snapshotOf(site([pallet(1)], [building(1, "A", 0, 1)], ["maria"]), "t");
    const now = site([laidPallet(1), pallet(2)], [building(1, "A", 1, 2)], ["maria", "lucas", "zoe"]);
    for (const l of radioLines(before, now, DAY, "x")) {
      const { variant: _variant, ...rest } = l.values;
      const hasLogin = "login" in rest;
      const hasNumber = Object.values(rest).some((v) => typeof v === "number");
      expect(hasLogin && hasNumber, l.key).toBe(false);
    }
    // A new worker is named, never counted.
    const helmets = radioLines(before, now, DAY, "x").filter((l) => l.key === "onAir.helmet");
    expect(helmets.map((l) => l.values.login)).toEqual(["lucas", "zoe"]);
  });

  it("the variant follows the date", () => {
    expect(variantOf("2026-11-18", 3)).toBe(0);
    expect(variantOf("2026-11-19", 3)).toBe(1);
    expect(variantOf("2026-11-20", 3)).toBe(2);
    expect(variantOf("garbage", 3)).toBe(0);
    const s = site([pallet(1)]);
    const a = radioLines(null, s, "2026-11-18", "x")[0].values.variant;
    const b = radioLines(null, s, "2026-11-19", "x")[0].values.variant;
    expect(a).not.toBe(b);
    expect(radioLines(null, s, "2026-11-18", "x")[0].values.variant).toBe(a);
  });

  it("a reopened or deleted pallet never breaks the comparison", () => {
    const before = snapshotOf(site([laidPallet(1), pallet(2), pallet(3, { isBug: true })], [building(1, "A", 1, 3)]), "t");
    // 1 reopened, 2 deleted, 3 gone too.
    const now = site([pallet(1)], [building(1, "A", 0, 1)]);
    const lines = radioLines(before, now, DAY, "x");
    expect(keys(lines)).toEqual(["onAir.calm"]);
  });

  it("a picture of another version is ignored", () => {
    const st = memory();
    const s = site([pallet(1)]);
    st.setItem("project-quest.radio.main", JSON.stringify({ ...snapshotOf(s, "t"), v: 2 }));
    expect(loadSnapshot("main", st)).toBeNull();
    st.setItem("project-quest.radio.main", "{not json");
    expect(loadSnapshot("main", st)).toBeNull();
    st.setItem("project-quest.radio.main", JSON.stringify({ v: RADIO_VERSION }));
    expect(loadSnapshot("main", st)).toBeNull();
    expect(chooseLines("main", s, DAY, "your site", st)[0].key).toBe("onAir.welcome");
  });

  it("the picture is saved as soon as the lines are chosen", () => {
    const st = memory();
    const s1 = site([pallet(1)]);
    expect(chooseLines("main", s1, DAY, "x", st)[0].key).toBe("onAir.welcome");
    expect(loadSnapshot("main", st)).toEqual(snapshotOf(s1, DAY));
    expect(st.getItem("project-quest.radio.main")).not.toBeNull();
    // A reload: the same news is not told again.
    expect(keys(chooseLines("main", s1, DAY, "x", st))).toEqual(["onAir.calm"]);
    const s2 = site([laidPallet(1)], [building(1, "Public map", 1, 1)]);
    expect(keys(chooseLines("main", s2, DAY, "x", st))).toContain("onAir.laid");
    expect(keys(chooseLines("main", s2, DAY, "x", st))).toEqual(["onAir.calm"]);
  });

  it("blocked storage means a first visit, never a crash", () => {
    const s = site([pallet(1)]);
    expect(loadSnapshot("main", blocked)).toBeNull();
    expect(() => saveSnapshot("main", snapshotOf(s, DAY), blocked)).not.toThrow();
    expect(chooseLines("main", s, DAY, "x", blocked)[0].key).toBe("onAir.welcome");
    expect(chooseLines("main", s, DAY, "x", blocked)[0].key).toBe("onAir.welcome");
    expect(chooseLines("main", s, DAY, "x", null)[0].key).toBe("onAir.welcome");
  });

  it("the site key lowercases a visited repository", () => {
    expect(radioSiteKey("visit", "Vitejs/Vite")).toBe("visit:vitejs/vite");
    expect(radioSiteKey("visit", "vitejs/vite")).toBe(radioSiteKey("visit", "Vitejs/Vite"));
    expect(radioSiteKey("visit", "a/b")).not.toBe(radioSiteKey("visit", "a/c"));
    for (const k of ["main", "demo", "practice", "team"] as const) expect(radioSiteKey(k, null)).toBe(k);
    const st = memory();
    saveSnapshot(radioSiteKey("visit", "Vitejs/Vite"), snapshotOf(site([]), DAY), st);
    expect(loadSnapshot(radioSiteKey("visit", "vitejs/vite"), st)).not.toBeNull();
    expect(loadSnapshot(radioSiteKey("visit", "other/repo"), st)).toBeNull();
  });
});

describe("the radio's words", () => {
  const kinds: [string, Record<string, string | number>][] = [
    ["floors", { count: 2, title: "Public map" }], ["floorsUnassigned", { count: 2 }], ["laid", { count: 2 }], ["review", { count: 2 }],
    ["progress", { count: 2 }], ["parcels", { count: 2 }], ["termitesIn", { count: 2 }], ["termitesOut", { count: 2 }],
    ["helmet", { login: "lucas" }], ["more", {}], ["calm", {}], ["welcome", { site: "a/b", buildings: 3, inspection: 4 }],
  ];
  for (const [lng, common] of [["en", en], ["fr", fr]] as const) {
    it(`speaks every kind and variant in ${lng}, with singular and plural, no dash`, async () => {
      const i = i18next.createInstance();
      await i.init({ lng, resources: { [lng]: { common } }, defaultNS: "common", interpolation: { escapeValue: false } });
      for (const [kind, values] of kinds) for (let variant = 0; variant < 3; variant++) {
        for (const count of "count" in values ? [1, 2] : [undefined]) {
          const text = i.t(`onAir.${kind}_${variant}`, count === undefined ? values : { ...values, count });
          expect(text, `${kind}_${variant}`).not.toMatch(/onAir|\{\{|\$t\(/);
          expect(text).not.toMatch(/[\u2013\u2014]/);
        }
      }
      expect(i.t("onAir.floorsUnassigned_0", { count: 1 })).toContain(i.t("site.unassigned"));
    });
  }
});

describe("the radio's key under the demo mode", () => {
  it("the demo data is kept under demo, whatever the page asks for", async () => {
    const { radioKey } = await import("./radio.ts");
    expect(radioKey("main", "demo", null)).toBe("demo");
    expect(radioKey("demo", "live", null)).toBe("demo");
    expect(radioKey("main", "live", null)).toBe("main");
    expect(radioKey("visit", "live", "Vitejs/Vite")).toBe("visit:vitejs/vite");
  });
});
