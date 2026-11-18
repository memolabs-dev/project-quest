import { describe, expect, it } from "vitest";
import type { BoardItem, BoardSnapshot } from "../site.ts";
import { GestureError } from "./move.ts";
import { WARM_EMOJIS, mentionsIn, prepareCheer, prepareThank, prepareUncheer } from "./warm.ts";

const REPO = "memolabs-dev/project-quest-sandbox";
const item = (o: Partial<BoardItem>): BoardItem => ({
  itemId: "PVTI_1", issueId: "I_1", number: 1, title: "FICTIF Paint the facade", url: "https://example.org/1", state: "OPEN",
  stateReason: null, status: "In progress", size: null, parent: null, isEpic: false, labels: [], assignees: [],
  updatedAt: "2026-11-17T10:00:00Z", myReactions: [], ...o,
});
const board = (...items: BoardItem[]): BoardSnapshot => ({
  fetchedAt: "2026-11-17T10:00:00Z", projectId: "P", statusFieldId: "F", statusOptions: [], items,
});
const laid = item({ number: 2, issueId: "I_2", state: "CLOSED", stateReason: "COMPLETED", status: "Done" });

describe("warm gestures", () => {
  it("only the four positive emojis", () => {
    expect(WARM_EMOJIS).toEqual(["HOORAY", "HEART", "ROCKET", "THUMBS_UP"]);
    expect(() => prepareCheer(board(item({})), REPO, 1, "THUMBS_DOWN")).toThrow(GestureError);
    expect(() => prepareCheer(board(item({})), REPO, 1, "CONFUSED")).toThrow(GestureError);
  });

  it("a cheer sends one reaction on the issue", () => {
    const p = prepareCheer(board(item({})), REPO, 1, "HOORAY");
    expect(p).toMatchObject({ kind: "cheer", repo: REPO, issueNumber: 1, title: "FICTIF Paint the facade", content: "HOORAY", words: null, mentions: [] });
    expect(p.mutations).toEqual([{ name: "addReaction", input: { subjectId: "I_1", content: "HOORAY" } }]);
  });

  it("an emoji already given can only be taken back", () => {
    const given = board(item({ myReactions: ["HOORAY"] }));
    expect(() => prepareCheer(given, REPO, 1, "HOORAY")).toThrow(/take it back/);
    expect(prepareUncheer(given, REPO, 1, "HOORAY").mutations).toEqual([{ name: "removeReaction", input: { subjectId: "I_1", content: "HOORAY" } }]);
    expect(() => prepareUncheer(board(item({})), REPO, 1, "HOORAY")).toThrow(GestureError);
  });

  it("an issue not on the board is refused", () => {
    expect(() => prepareCheer(board(item({})), REPO, 9, "HEART")).toThrow(GestureError);
  });

  it("thank needs a pallet laid as completed", () => {
    expect(() => prepareThank(board(item({})), REPO, 1, "HOORAY", null, false)).toThrow(GestureError);
    const dup = item({ number: 3, state: "CLOSED", stateReason: "DUPLICATE" });
    expect(() => prepareThank(board(dup), REPO, 3, "HOORAY", null, false)).toThrow(GestureError);
    expect(() => prepareThank(board(laid), REPO, 2, "ROCKET", null, false)).toThrow(GestureError);
    const p = prepareThank(board(laid), REPO, 2, "HEART", null, false);
    expect(p.mutations).toEqual([{ name: "addReaction", input: { subjectId: "I_2", content: "HEART" } }]);
  });

  it("thanks with words: the reaction, then the player's own words", () => {
    const p = prepareThank(board(laid), REPO, 2, "HOORAY", "  Thanks, lovely work!  ", false);
    expect(p.words).toBe("Thanks, lovely work!");
    expect(p.mutations).toEqual([
      { name: "addReaction", input: { subjectId: "I_2", content: "HOORAY" } },
      { name: "addComment", input: { subjectId: "I_2", body: "Thanks, lovely work!" } },
    ]);
    // The reaction already given: only the words leave.
    const again = prepareThank(board({ ...laid, myReactions: ["HOORAY"] }), REPO, 2, "HOORAY", "Thanks!", false);
    expect(again.mutations.map((m) => m.name)).toEqual(["addComment"]);
  });

  it("words with an @mention carry the warning", () => {
    const p = prepareThank(board(laid), REPO, 2, "HEART", "Thanks @maria-fictif and @jo, great job (not mail@example.org)", false);
    expect(p.mentions).toEqual(["maria-fictif", "jo"]);
  });

  it("a mention written as code notifies nobody, so it is not warned about", () => {
    expect(mentionsIn("`@tom` and @ana")).toEqual(["ana"]);
    expect(mentionsIn("see ``x @tom y`` then")).toEqual([]);
    expect(mentionsIn("```\n@tom\n```\nand @jo")).toEqual(["jo"]);
    // A lone backtick opens no code: the mention still notifies.
    expect(mentionsIn("it's ` broken @tom")).toEqual(["tom"]);
  });

  it("empty words are refused", () => {
    expect(() => prepareThank(board(laid), REPO, 2, "HEART", "   ", false)).toThrow(/empty/);
  });

  it("a second thank with words is refused", () => {
    expect(() => prepareThank(board(laid), REPO, 2, "HEART", "Thanks again", true)).toThrow(/already thanked/);
    expect(prepareThank(board(laid), REPO, 2, "HEART", null, true).mutations).toHaveLength(1);
  });

  it("a thank that would send nothing is refused", () => {
    expect(() => prepareThank(board({ ...laid, myReactions: ["HEART"] }), REPO, 2, "HEART", null, false)).toThrow(GestureError);
  });
});
