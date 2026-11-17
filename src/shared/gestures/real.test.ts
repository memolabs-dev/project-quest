import { describe, expect, it } from "vitest";
import type { RealSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import { prepareAsk } from "./real.ts";

const real = (assignees: string[] = []): RealSnapshot => ({
  repo: "fictif-org/fictif-site",
  issues: [{ id: "I_21", number: 21, title: "FICTIF fountain", url: "u21", assignees, comments: [] }],
});

describe("prepareAsk", () => {
  it("asks for a good first issue in the player's words", () => {
    const p = prepareAsk(real(), "fictif-volunteer", 21, "  I'd like this one.  ");
    expect(p).toEqual({
      kind: "ask", repo: "fictif-org/fictif-site", issueNumber: 21, title: "FICTIF fountain", comment: "I'd like this one.",
      mutations: [{ name: "addComment", input: { subjectId: "I_21", body: "I'd like this one." } }],
    });
  });
  it("never asks for an issue someone has", () => {
    expect(() => prepareAsk(real(["someone-else"]), "fictif-volunteer", 21, "mine?")).toThrow(GestureError);
  });
  it("never asks twice for the same issue", () => {
    const asked: RealSnapshot = { ...real(), issues: [{ ...real().issues[0], comments: [{ author: "Fictif-Volunteer", url: "c", createdAt: "2026-11-17T12:00:00Z" }] }] };
    expect(() => prepareAsk(asked, "fictif-volunteer", 21, "again?")).toThrow(GestureError);
  });
  it("refuses an empty comment, and an issue that is not an open good first issue", () => {
    expect(() => prepareAsk(real(), "fictif-volunteer", 21, "   ")).toThrow(GestureError);
    expect(() => prepareAsk(real(), "fictif-volunteer", 99, "mine?")).toThrow(GestureError);
  });
});
