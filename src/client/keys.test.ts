import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY_MAP, keyLetters } from "./keys.ts";

afterEach(() => vi.unstubAllGlobals());

describe("keys", () => {
  it("moves with physical codes only, never with letters that differ between layouts", () => {
    const codes = KEY_MAP.flatMap((k) => k.keys);
    expect(codes).not.toContain("KeyZ");
    expect(codes).not.toContain("KeyQ");
    expect(KEY_MAP.find((k) => k.name === "forward")!.keys).toEqual(["ArrowUp", "KeyW"]);
  });

  it("shows AZERTY letters on an AZERTY keyboard", async () => {
    const azerty: Record<string, string> = { KeyW: "z", KeyA: "q", KeyS: "s", KeyD: "d" };
    vi.stubGlobal("navigator", { keyboard: { getLayoutMap: async () => ({ get: (c: string) => azerty[c] }) } });
    expect(await keyLetters(["KeyW", "KeyA", "KeyS", "KeyD"])).toEqual(["Z", "Q", "S", "D"]);
  });

  it("falls back to QWERTY letters when the browser cannot tell", async () => {
    vi.stubGlobal("navigator", {});
    expect(await keyLetters(["KeyW", "KeyA", "KeyS", "KeyD", "KeyE"])).toEqual(["W", "A", "S", "D", "E"]);
  });
});
