import { describe, expect, it } from "vitest";
import { prepareAnswer } from "../shared/gestures/talk.ts";
import type { Newcomer, People } from "../shared/people.ts";
import type { BoardSnapshot } from "../shared/site.ts";
import { actionAt, answerDraft, keepsWords, talkAt, talkPrompt, waitedDays, welcomeDraft } from "./talk.ts";

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

  it("the answer draft quotes mentions as code, so the quote notifies nobody", () => {
    expect(answerDraft("ask @fictif-tom or @fictif-ana.", say)).toBe("> ask `@fictif-tom` or `@fictif-ana`.\n\n");
    // A backtick of their own could open code around the name: it is quoted as a plain quote mark.
    expect(answerDraft("run `make` then @fictif-tom", say)).toBe("> run 'make' then `@fictif-tom`\n\n");
    // An address is no mention.
    expect(answerDraft("mail fictif@example.org", say)).toBe("> mail fictif@example.org\n\n");
  });

  it("a quoted @mention notifies nobody: only the player's own words can", () => {
    const board = { fetchedAt: "", projectId: "P", statusFieldId: "F", statusOptions: [], items: [{
      itemId: "PVTI_1", issueId: "I_1", number: 12, title: "FICTIF Paint the facade", url: "https://example.org/12", state: "OPEN",
      stateReason: null, status: "In progress", size: null, parent: null, isEpic: false, labels: [], assignees: [], updatedAt: "",
      lastComment: { author: "fictif-maria", association: "NONE", createdAt: "2026-11-16T09:30:00Z", excerpt: "x" },
    }] } satisfies BoardSnapshot;
    const now = Date.parse("2026-11-18T12:00:00Z");
    // The person who waits wrote mentions; the draft quotes them, the player adds none of their own.
    const draft = answerDraft("FICTIF @fictif-tom said I could take it, ok @fictif-ana?", say);
    const quiet = prepareAnswer(board, "o/r", 12, `${draft}Yes, it is yours.`, "fictif-lead", now);
    expect(quiet.mentions).toEqual([]);
    expect(quiet.words).toContain("`@fictif-tom`");
    // A mention in the player's own words, under the quote, is warned about.
    expect(prepareAnswer(board, "o/r", 12, `${draft}Ask @fictif-tom first.`, "fictif-lead", now).mentions).toEqual(["fictif-tom"]);
  });

  it("a cut quote ends with an ellipsis", () => {
    const draft = answerDraft("word ".repeat(80), say);
    expect(draft.trimEnd().endsWith("word…")).toBe(true);
    expect(draft.trimEnd().slice(2).length).toBeLessThanOrEqual(200);
    expect(answerDraft("short", say)).not.toContain("…");
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
    expect(talkAt(people, 13)).toEqual([{ kind: "welcome", number: 32, login: "sana", pallet: 13 }]);
    expect(talkAt(people, 14)).toEqual([]);
    expect(talkAt(undefined, 12)).toEqual([]);
  });

  it("E near a pallet with someone always opens its card; only a visitor, who has no card, opens the welcome", () => {
    const [maria] = talkAt(people, 12);
    expect(actionAt(12, maria)).toEqual({ card: 12 });
    // The sign's pallet wins over a nearer pallet without one: the prompt named it.
    expect(actionAt(11, maria)).toEqual({ card: 12 });
    expect(actionAt(13, talkAt(people, 13)[0])).toEqual({ card: 13 });
    const visitor = { kind: "welcome" as const, number: 33, login: "visitor", pallet: null };
    expect(actionAt(null, visitor)).toEqual({ talk: visitor });
    expect(actionAt(14, null)).toEqual({ card: 14 });
    expect(actionAt(null, null)).toBeNull();
  });

  it("the prompt names the pallet and who waits there, or the visitor to welcome", () => {
    expect(talkPrompt(talkAt(people, 12)[0], false)).toEqual({ key: "talk.nearAnswer", values: { number: 12, login: "maria" } });
    expect(talkPrompt(talkAt(people, 13)[0], false)).toEqual({ key: "talk.nearWelcome", values: { number: 13, login: "sana" } });
    expect(talkPrompt(talkAt(people, 12)[0], true).key).toBe("talk.nearAnswerTouch");
    const visitor = { kind: "welcome" as const, number: 33, login: "visitor", pallet: null };
    expect(talkPrompt(visitor, false)).toEqual({ key: "talk.nearVisitor", values: { number: 33, login: "visitor" } });
    expect(talkPrompt(visitor, true).key).toBe("talk.nearVisitorTouch");
  });

  it("counts whole days, never less than one", () => {
    expect(waitedDays("2026-11-16T09:30:00Z", Date.parse("2026-11-18T14:00:00Z"))).toBe(2);
    expect(waitedDays("2026-11-18T09:30:00Z", Date.parse("2026-11-18T14:00:00Z"))).toBe(1);
  });
});

describe("a send that fails", () => {
  it("keeps the dialog and the words, unless the server refused them (400, 403, 409)", () => {
    // No answer at all (the network) or a server in trouble: the player's words are kept, to send again.
    expect(keepsWords(null)).toBe(true);
    expect(keepsWords(500)).toBe(true);
    expect(keepsWords(502)).toBe(true);
    expect(keepsWords(503)).toBe(true);
    // A refusal that sending again cannot change (the team spoke, not a lead, the claim does not match): the talk closes.
    expect(keepsWords(400)).toBe(false);
    expect(keepsWords(403)).toBe(false);
    expect(keepsWords(409)).toBe(false);
  });
});
