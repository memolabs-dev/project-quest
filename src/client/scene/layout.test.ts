import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../shared/config.ts";
import { buildSite, type BoardSnapshot } from "../../shared/site.ts";
import { layoutSite } from "./layout.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const site = buildSite(read("../../shared/demo/demo-board.json") as BoardSnapshot, loadConfig(read("../../../quest.config.json")));

describe("layoutSite", () => {
  it("is deterministic", () => {
    expect(layoutSite(site)).toEqual(layoutSite(site));
  });

  it("places every zone and every building", () => {
    const l = layoutSite(site);
    expect(l.zones.map((z) => z.name)).toEqual(site.zones.map((z) => z.name));
    expect(l.buildings.length).toBe(site.buildings.length);
    expect(l.pallets.map((p) => p.number).sort((a, b) => a - b)).toEqual(site.pallets.map((p) => p.number).sort((a, b) => a - b));
  });

  it("never stacks two pallets on the same spot", () => {
    const { pallets } = layoutSite(site);
    for (const a of pallets) for (const b of pallets) {
      if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1.1);
    }
  });

  it("keeps pallets and buildings apart", () => {
    const { pallets, buildings } = layoutSite(site);
    for (const p of pallets) for (const b of buildings) expect(Math.hypot(p.x - b.x, p.z - b.z)).toBeGreaterThan(3);
  });
});
