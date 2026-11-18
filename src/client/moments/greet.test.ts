import { describe, expect, it } from "vitest";
import type { PreparedWarm } from "../../shared/gestures/warm.ts";
import type { PreparedTalk } from "../../shared/gestures/talk.ts";
import { greetAfter, greetAfterTalk, greets } from "./greet.ts";

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

describe("who answers a greet", () => {
  it("a warm gesture greets the pallet's workers, a talk greets the person it was for, by login only", () => {
    const cheer = greetAfter({ ok: true }, prepared("cheer"), 1)!;
    expect(greets(cheer, { login: "fictif-tom", pallet: 6 })).toBe(true);
    expect(greets(cheer, { login: "fictif-tom", pallet: 7 })).toBe(false);
    const talked = greetAfterTalk({ ok: true }, talk("answer"), 9, 1)!;
    expect(greets(talked, { login: "fictif-ana", pallet: 9 })).toBe(true);
    expect(greets(talked, { login: "fictif-ana", pallet: null })).toBe(true);
    // Another worker on the answered pallet does not wave for fictif-ana.
    expect(greets(talked, { login: "fictif-tom", pallet: 9 })).toBe(false);
    expect(greets(null, { login: "fictif-ana", pallet: 9 })).toBe(false);
  });
});
