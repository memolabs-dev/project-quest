import { describe, expect, it } from "vitest";
import type { PreparedWarm } from "../../shared/gestures/warm.ts";
import type { PreparedTalk } from "../../shared/gestures/talk.ts";
import { greetAfter, greetAfterTalk } from "./greet.ts";

const prepared = (kind: PreparedWarm["kind"]): PreparedWarm => ({
  kind, repo: "o/r", issueNumber: 6, title: "FICTIF", content: "HOORAY", words: null, mentions: [], mutations: [],
});

describe("greetAfter", () => {
  it("an accepted cheer or thank-you greets the pallet's worker", () => {
    expect(greetAfter({ ok: true }, prepared("cheer"), 1)).toEqual({ pallet: 6, login: null, emoji: "HOORAY", kind: "cheered", at: 1 });
    expect(greetAfter({ ok: true }, prepared("thank"), 2)).toEqual({ pallet: 6, login: null, emoji: "HOORAY", kind: "thanked", at: 2 });
  });
  it("a refusal never greets, and taking a sign back plays nothing", () => {
    expect(greetAfter({ ok: false }, prepared("cheer"), 1)).toBeNull();
    expect(greetAfter({ ok: true }, prepared("uncheer"), 1)).toBeNull();
  });
});

const talk = (kind: PreparedTalk["kind"]): PreparedTalk => ({
  kind, repo: "o/r", to: "fictif-ana", words: "Hi", mentions: [], mutations: [],
  target: { kind: kind === "answer" ? "issue" : "pull", number: 9, title: "FICTIF", url: "https://example.org/9" },
});

describe("greetAfterTalk", () => {
  it("an accepted talk greets the person by login, with no emoji", () => {
    expect(greetAfterTalk({ ok: true }, talk("answer"), 9, 1)).toEqual({ pallet: 9, login: "fictif-ana", emoji: null, kind: "talked", at: 1 });
    expect(greetAfterTalk({ ok: true }, talk("welcome"), null, 2)).toEqual({ pallet: null, login: "fictif-ana", emoji: null, kind: "talked", at: 2 });
  });
  it("a refusal never greets", () => {
    expect(greetAfterTalk({ ok: false }, talk("answer"), 9, 1)).toBeNull();
  });
});
