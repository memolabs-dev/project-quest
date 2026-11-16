import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";

const kit = fileURLToPath(new URL("../public/models/site-kit.glb", import.meta.url));
const io = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
};
export const KIT_NODES = ["pallet", "floor_module", "scaffold_module", "roof", "zone_sign", "crane", "fence", "site_office", "worker"] as const;

describe("site kit", () => {
  it("is a small GLB", () => {
    expect(statSync(kit).size).toBeLessThan(500 * 1024);
  });

  it("contains every named piece the game uses", async () => {
    const doc = await (await io()).read(kit);
    const names = doc.getRoot().listNodes().map((n) => n.getName());
    for (const name of KIT_NODES) expect(names, name).toContain(name);
  });

  it("has a material the game recolours for each zone", async () => {
    const doc = await (await io()).read(kit);
    expect(doc.getRoot().listMaterials().map((m) => m.getName())).toContain("crate");
  });
});

describe("site manager (from KayKit, CC0)", () => {
  const foreman = fileURLToPath(new URL("../public/models/foreman.glb", import.meta.url));

  it("is light enough for the web", () => {
    expect(statSync(foreman).size).toBeLessThan(1500 * 1024);
  });

  it("wears a hard hat and keeps the animations the game plays", async () => {
    const doc = await (await io()).read(foreman);
    expect(doc.getRoot().listNodes().map((n) => n.getName())).toContain("hard_hat");
    const clips = doc.getRoot().listAnimations().map((a) => a.getName());
    for (const clip of ["Idle", "Walking_A", "Running_A", "Interact", "Cheer"]) expect(clips, clip).toContain(clip);
    expect(clips.some((c) => /Attack|Death|Spellcast/.test(c))).toBe(false);
  });
});
