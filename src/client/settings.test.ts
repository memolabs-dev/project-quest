import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, reduced, saveSettings } from "./settings.ts";

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

describe("settings", () => {
  it("defaults when nothing is stored", () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ sound: true, volume: 0.7, miniature: true, motion: "system", radio: true });
  });
  it("keeps what was saved", () => {
    const s = memory();
    saveSettings({ ...DEFAULT_SETTINGS, sound: false, volume: 0.3, motion: "reduce" }, s);
    expect(loadSettings(s)).toEqual({ sound: false, volume: 0.3, miniature: true, motion: "reduce", radio: true });
  });
  it("the radio setting defaults to on and survives a reload", () => {
    const s = memory();
    expect(loadSettings(s).radio).toBe(true);
    saveSettings({ ...DEFAULT_SETTINGS, radio: false }, s);
    expect(loadSettings(s).radio).toBe(false);
    s.setItem("project-quest.settings", JSON.stringify({ radio: "no" }));
    expect(loadSettings(s).radio).toBe(true);
  });
  it("settings survive a blocked storage", () => {
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, blocked)).not.toThrow();
  });
  it("a stored value out of range falls back", () => {
    const s = memory();
    s.setItem("project-quest.settings", JSON.stringify({ sound: "yes", volume: 7, miniature: false, motion: "wild" }));
    expect(loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, miniature: false });
    s.setItem("project-quest.settings", "{not json");
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
  });
  it("reduced follows the system unless forced", () => {
    expect(reduced({ ...DEFAULT_SETTINGS, motion: "system" }, true)).toBe(true);
    expect(reduced({ ...DEFAULT_SETTINGS, motion: "system" }, false)).toBe(false);
    expect(reduced({ ...DEFAULT_SETTINGS, motion: "reduce" }, false)).toBe(true);
    expect(reduced({ ...DEFAULT_SETTINGS, motion: "full" }, true)).toBe(false);
  });
});
