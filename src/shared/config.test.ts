import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.ts";

const json = JSON.parse(readFileSync(new URL("../../quest.config.json", import.meta.url), "utf8")) as Record<string, unknown>;

describe("config", () => {
  it("loads the repository's config", () => {
    const config = loadConfig(json);
    expect(config.zones).toEqual(["Backlog", "Ready", "In progress", "In review", "Done"]);
    expect(config.fields.iteration).toBe("Sprint");
  });

  it("rejects a config without zones, naming the field", () => {
    const { zones: _zones, ...rest } = json;
    expect(() => loadConfig(rest)).toThrow(ConfigError);
    expect(() => loadConfig(rest)).toThrow(/zones/);
  });
});
