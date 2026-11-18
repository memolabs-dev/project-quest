import { describe, expect, it } from "vitest";
import type { Newcomer, People } from "../shared/people.ts";
import { answerDraft, talkAt, waitedDays, welcomeDraft } from "./talk.ts";

// A stand-in for the player's language: the key and the values, readable in a test.
const say = (key: string, o?: Record<string, unknown>) => `<${key}${o ? ` ${JSON.stringify(o)}` : ""}>`;

const newcomer = (login: string, pallet: number | null, number = 40): Newcomer => ({
  login, avatarUrl: "", pallet, contributingUrl: null, pr: { id: `PR_${number}`, number, title: "FICTIF A first fix", url: `https://example.org/pull/${number}` },
});

describe("the drafts", () => {
  it("the answer draft quotes every line, 200 characters at most", () => {
    const long = `${"word ".repeat(80)}\nsecond line`;
    const draft = answerDraft(long, say);
    const quoted = draft.trimEnd().split("\n");
    expect(quoted.every((l) => l.startsWith("> "))).toBe(true);
    // The quoted text is at most 200 characters, cut on a word, and the answer starts after an empty line.
    expect(quoted.map((l) => l.slice(2)).join("\n").length).toBeLessThanOrEqual(200);
    expect(draft.endsWith("\n\n")).toBe(true);
    const lines = answerDraft("first line\nsecond line\n\nfourth line", say).trimEnd().split("\n");
    expect(lines).toEqual(["> first line", "> second line", "> ", "> fourth line"]);
    expect(answerDraft("short", say)).toBe("> short\n\n");
  });

  it("the welcome draft links the contributing guide only when there is one", () => {
    const url = "https://github.com/fictif-org/demo-site/blob/main/CONTRIBUTING.md";
    expect(welcomeDraft("lucas", url, say)).toContain(url);
    expect(welcomeDraft("lucas", null, say)).not.toContain("talk.welcomeGuide");
    expect(welcomeDraft("lucas", null, say)).toContain("lucas");
    // The game never adds a mention of its own.
    expect(welcomeDraft("lucas", url, say)).not.toContain("@");
  });
});

describe("who the player can talk to", () => {
  const people: People = {
    waiting: [{ pallet: 12, login: "maria", since: "2026-11-16T09:30:00Z", excerpt: "Can I take this one?" }],
    newcomers: [newcomer("lucas", 12, 31), newcomer("sana", 13, 32), newcomer("visitor", null, 33)],
  };

  it("a pallet offers its answer first, then its welcome", () => {
    expect(talkAt(people, 12).map((t) => `${t.kind}:${t.login}`)).toEqual(["answer:maria", "welcome:lucas"]);
    expect(talkAt(people, 13)).toEqual([{ kind: "welcome", number: 32, login: "sana" }]);
    expect(talkAt(people, 14)).toEqual([]);
    expect(talkAt(undefined, 12)).toEqual([]);
  });

  it("counts whole days, never less than one", () => {
    expect(waitedDays("2026-11-16T09:30:00Z", Date.parse("2026-11-18T14:00:00Z"))).toBe(2);
    expect(waitedDays("2026-11-18T09:30:00Z", Date.parse("2026-11-18T14:00:00Z"))).toBe(1);
  });
});
