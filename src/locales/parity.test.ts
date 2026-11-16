import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPRENTICE } from "../shared/levels/apprentice.ts";

const load = (lang: string) =>
  JSON.parse(readFileSync(new URL(`./${lang}/common.json`, import.meta.url), "utf8")) as Record<string, unknown>;

const flatten = (o: Record<string, unknown>, prefix = ""): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null ? { ...acc, ...flatten(v as Record<string, unknown>, key) } : { ...acc, [key]: String(v) };
  }, {});

const en = flatten(load("en"));
const fr = flatten(load("fr"));

describe("locales", () => {
  it("has every key in both English and French, none empty", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(Object.entries({ ...en, ...fr }).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it("has a display name for every zone of the default config", () => {
    const config = JSON.parse(readFileSync(new URL("../../quest.config.json", import.meta.url), "utf8")) as { zones: string[] };
    for (const z of config.zones) expect(en[`zones.${z}`], z).toBeTruthy();
  });

  it("has a skill, a goal and a lesson for every level", () => {
    for (const l of APPRENTICE) {
      for (const part of ["skill", "goal", "lesson"]) expect(en[`levels.${l.id}.${part}`], `${l.id}.${part}`).toBeTruthy();
    }
  });

  it("uses no em or en dash in the French copy", () => {
    expect(Object.values(fr).filter((v) => /[—–]/.test(v))).toEqual([]);
  });
});
