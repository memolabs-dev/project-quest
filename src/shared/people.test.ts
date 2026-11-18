import { describe, expect, it } from "vitest";
import { excerptOf, peopleOf, waitingOn, WAIT_MS, type Newcomer } from "./people.ts";
import type { BoardItem, BoardSnapshot } from "./site.ts";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const issue = (over: Partial<BoardItem> = {}): BoardItem => ({
  itemId: "PVTI_1", issueId: "I_1", number: 12, title: "FICTIF Build the shelves", url: "https://github.com/fictif-org/demo-site/issues/12",
  state: "OPEN", status: "Ready", size: null, parent: null, isEpic: false, labels: [], assignees: [], updatedAt: ago(0),
  lastComment: { author: "fictif-maria", association: "NONE", createdAt: ago(2 * WAIT_MS), excerpt: "can I take this one" },
  ...over,
});
const withComment = (over: Partial<NonNullable<BoardItem["lastComment"]>>) => issue({ lastComment: { ...issue().lastComment!, ...over } });

describe("who waits", () => {
  it("someone outside the team who wrote more than a day ago waits", () => {
    expect(waitingOn(issue(), "fictif-lead", NOW)).toEqual({ pallet: 12, login: "fictif-maria", since: ago(2 * WAIT_MS), excerpt: "can I take this one" });
  });
  it("the team's last word means nobody waits", () => {
    for (const association of ["OWNER", "MEMBER", "COLLABORATOR"]) expect(waitingOn(withComment({ association }), "fictif-lead", NOW)).toBeNull();
  });
  it("the player's own last word means nobody waits", () => {
    expect(waitingOn(withComment({ author: "fictif-lead" }), "fictif-lead", NOW)).toBeNull();
  });
  it("a word younger than a day does not wait yet", () => {
    expect(waitingOn(withComment({ createdAt: ago(WAIT_MS - 1) }), "fictif-lead", NOW)).toBeNull();
    expect(waitingOn(withComment({ createdAt: ago(WAIT_MS) }), "fictif-lead", NOW)).not.toBeNull();
  });
  it("no question mark is needed", () => {
    expect(waitingOn(withComment({ excerpt: "it fails on my machine" }), "fictif-lead", NOW)).not.toBeNull();
  });
  it("bots and deleted accounts never wait", () => {
    expect(waitingOn(withComment({ author: "fictif-helper[bot]" }), "fictif-lead", NOW)).toBeNull();
    expect(waitingOn(withComment({ author: null }), "fictif-lead", NOW)).toBeNull();
  });
  it("a closed issue never waits", () => {
    expect(waitingOn(issue({ state: "CLOSED" }), "fictif-lead", NOW)).toBeNull();
    expect(waitingOn(issue({ lastComment: null }), "fictif-lead", NOW)).toBeNull();
    expect(waitingOn(issue({ lastComment: undefined }), "fictif-lead", NOW)).toBeNull();
  });
});

describe("peopleOf", () => {
  const board: BoardSnapshot = {
    fetchedAt: ago(0), projectId: "P", statusFieldId: "F", statusOptions: [],
    items: [issue(), issue({ number: 13, itemId: "PVTI_2", issueId: "I_2", lastComment: null }), issue({ number: 1, isEpic: true, itemId: "PVTI_3", issueId: "I_3" })],
  };
  const newcomer = (closes: number[]): Newcomer => ({
    login: "fictif-lucas", avatarUrl: "", pr: { id: "PR_1", number: 40, title: "FICTIF first fix", url: "https://github.com/fictif-org/demo-site/pull/40" },
    pallet: null, closes, contributingUrl: null,
  });
  it("a newcomer's pallet is the first closing issue on the board, else none", () => {
    const p = peopleOf(board, [newcomer([99, 13, 12]), newcomer([99]), newcomer([]), newcomer([1])], "fictif-lead", NOW);
    expect(p.newcomers.map((n) => n.pallet)).toEqual([13, null, null, null]);
    expect(p.waiting.map((w) => w.pallet)).toEqual([12]);
  });
});

describe("excerptOf", () => {
  it("keeps a short comment whole and cuts a long one on a word within 200 characters", () => {
    expect(excerptOf("  FICTIF short  ")).toBe("FICTIF short");
    const long = excerptOf("word ".repeat(100));
    expect(long.length).toBeLessThanOrEqual(200);
    // A cut comment says so: it ends with an ellipsis, inside the 200 characters.
    expect(long.endsWith("word…")).toBe(true);
  });
});
