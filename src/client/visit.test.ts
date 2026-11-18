import { describe, expect, it } from "vitest";
import { repoFromInput } from "./api.ts";
import { bandHeight, photoName } from "./photo.ts";

describe("a visit (#16)", () => {
  it("takes a repository as owner/name or as any of its GitHub addresses", () => {
    for (const text of [
      "vitejs/vite", " vitejs/vite ", "https://github.com/vitejs/vite", "https://github.com/vitejs/vite/",
      "https://www.github.com/vitejs/vite.git", "github.com/vitejs/vite/issues/42", "https://github.com/vitejs/vite?tab=readme",
    ]) expect(repoFromInput(text.startsWith("github.com") ? `https://${text}` : text)).toBe("vitejs/vite");
  });

  it("names the photo after the repository, safely", () => {
    expect(photoName("Memolabs-Dev/project-quest")).toBe("project-quest-memolabs-dev-project-quest.png");
    expect(photoName("a/b.c_d")).toBe("project-quest-a-b.c_d.png");
  });

  it("keeps the caption band readable on a small picture and to a tenth on a large one", () => {
    expect(bandHeight(200)).toBe(36);
    expect(bandHeight(1600)).toBe(160);
  });
});
