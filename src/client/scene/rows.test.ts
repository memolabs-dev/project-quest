import { describe, expect, it } from "vitest";
import { dashesAt, fenceAt } from "./rows.ts";

describe("rows", () => {
  it("the fence and the dashes stand where they stood", () => {
    const width = 60;
    const fence = fenceAt(width);
    expect(fence).toHaveLength(Math.ceil((width + 8) / 2));
    expect(fence[0]).toBe(-(width + 8) / 2 + 1);
    expect(fence[1] - fence[0]).toBe(2);
    expect(fence.at(-1)).toBe(-(width + 8) / 2 + 1 + (fence.length - 1) * 2);
    const dashes = dashesAt(width);
    expect(dashes).toHaveLength(Math.ceil((width + 40) / 3));
    expect(dashes[0]).toBe(-(width + 40) / 2 + 1.5);
    expect(dashes[1] - dashes[0]).toBe(3);
  });
});
