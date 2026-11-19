import { describe, expect, it } from "vitest";
import { zoneKey } from "./zones.ts";

const KNOWN = ["Backlog", "Ready", "In progress", "In review", "Done", "none"];

describe("zoneKey", () => {
  it("finds the locales' zone whatever the board's case", () => {
    expect(zoneKey("In Progress", KNOWN)).toBe("In progress");
    expect(zoneKey("in review", KNOWN)).toBe("In review");
    expect(zoneKey("Done", KNOWN)).toBe("Done");
  });
  it("keeps a column the locales do not know", () => {
    expect(zoneKey("Blocked", KNOWN)).toBe("Blocked");
  });
});
