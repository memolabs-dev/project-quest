import { describe, expect, it } from "vitest";
import type { BoardItem, BoardSnapshot } from "../site.ts";
import type { Newcomer } from "../people.ts";
import { GestureError } from "./move.ts";
import { prepareAnswer, prepareWelcome } from "./talk.ts";

const REPO = "memolabs-dev/project-quest-sandbox";
const NOW = Date.parse("2026-11-18T12:00:00Z");
const item = (o: Partial<BoardItem> = {}): BoardItem => ({
  itemId: "PVTI_1", issueId: "I_1", number: 12, title: "FICTIF Paint the facade", url: "https://example.org/12", state: "OPEN",
  stateReason: null, status: "In progress", size: null, parent: null, isEpic: false, labels: [], assignees: [],
  updatedAt: "2026-11-17T10:00:00Z", myReactions: [],
  lastComment: { author: "fictif-maria", association: "NONE", createdAt: "2026-11-16T09:30:00Z", excerpt: "FICTIF can I take this one" }, ...o,
});
const board = (...items: BoardItem[]): BoardSnapshot => ({
  fetchedAt: "2026-11-17T10:00:00Z", projectId: "P", statusFieldId: "F", statusOptions: [], items,
});
const lucas: Newcomer = {
  login: "fictif-lucas", avatarUrl: "", pallet: null, closes: [13], contributingUrl: null,
  pr: { id: "PR_1", number: 31, title: "FICTIF Light the reading room", url: "https://example.org/pull/31" },
};

describe("answer and welcome", () => {
  it("an answer sends one comment on the waiting issue, nothing else", () => {
    const p = prepareAnswer(board(item()), REPO, 12, "  Yes, it is yours.  ", "fictif-lead", NOW);
    expect(p).toMatchObject({
      kind: "answer", repo: REPO, to: "fictif-maria", words: "Yes, it is yours.", mentions: [],
      target: { kind: "issue", number: 12, title: "FICTIF Paint the facade", url: "https://example.org/12" },
    });
    expect(p.mutations).toEqual([{ name: "addComment", input: { subjectId: "I_1", body: "Yes, it is yours." } }]);
  });

  it("an answer is refused when nobody waits any more", () => {
    const spoke = item({ lastComment: { author: "fictif-tom", association: "MEMBER", createdAt: "2026-11-17T09:00:00Z", excerpt: "x" } });
    expect(() => prepareAnswer(board(spoke), REPO, 12, "Hi", "fictif-lead", NOW)).toThrow("Nobody waits for an answer on #12 any more");
  });

  it("a welcome sends one comment on the pull request", () => {
    const p = prepareWelcome([lucas], REPO, 31, "Welcome, and thank you!");
    expect(p).toMatchObject({
      kind: "welcome", repo: REPO, to: "fictif-lucas", words: "Welcome, and thank you!", mentions: [],
      target: { kind: "pull", number: 31, title: "FICTIF Light the reading room", url: "https://example.org/pull/31" },
    });
    expect(p.mutations).toEqual([{ name: "addComment", input: { subjectId: "PR_1", body: "Welcome, and thank you!" } }]);
  });

  it("a welcome is refused once the newcomer was welcomed", () => {
    expect(() => prepareWelcome([], REPO, 31, "Hi")).toThrow("This newcomer was already welcomed");
  });

  it("empty words are refused", () => {
    expect(() => prepareAnswer(board(item()), REPO, 12, "   ", "fictif-lead", NOW)).toThrow(GestureError);
    expect(() => prepareWelcome([lucas], REPO, 31, "")).toThrow(GestureError);
  });

  it("words with an @mention carry the warning", () => {
    expect(prepareAnswer(board(item()), REPO, 12, "Ask @fictif-tom, please", "fictif-lead", NOW).mentions).toEqual(["fictif-tom"]);
    expect(prepareWelcome([lucas], REPO, 31, "Thanks, @fictif-lucas!").mentions).toEqual(["fictif-lucas"]);
  });
});
