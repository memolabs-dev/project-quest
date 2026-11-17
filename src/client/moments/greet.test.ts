import { describe, expect, it } from "vitest";
import type { PreparedWarm } from "../../shared/gestures/warm.ts";
import { greetAfter } from "./greet.ts";

const prepared = (kind: PreparedWarm["kind"]): PreparedWarm => ({
  kind, repo: "o/r", issueNumber: 6, title: "FICTIF", content: "HOORAY", words: null, mentions: [], mutations: [],
});

describe("greetAfter", () => {
  it("an accepted cheer or thank-you greets the pallet's worker", () => {
    expect(greetAfter({ ok: true }, prepared("cheer"), 1)).toEqual({ pallet: 6, emoji: "HOORAY", kind: "cheered", at: 1 });
    expect(greetAfter({ ok: true }, prepared("thank"), 2)).toEqual({ pallet: 6, emoji: "HOORAY", kind: "thanked", at: 2 });
  });
  it("a refusal never greets, and taking a sign back plays nothing", () => {
    expect(greetAfter({ ok: false }, prepared("cheer"), 1)).toBeNull();
    expect(greetAfter({ ok: true }, prepared("uncheer"), 1)).toBeNull();
  });
});
