import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { BoardSnapshot } from "../site.ts";
import { prepareMove } from "./move.ts";

const demo = JSON.parse(readFileSync(new URL("../demo/demo-board.json", import.meta.url), "utf8")) as BoardSnapshot;
const backlog = demo.items.find((i) => i.status === "Backlog" && !i.isEpic && i.state === "OPEN")!;

describe("prepareMove", () => {
  it("builds exactly the mutation that will be sent", () => {
    const p = prepareMove(demo, backlog.itemId, "Ready");
    const ready = demo.statusOptions.find((o) => o.name === "Ready")!;
    expect(p).toMatchObject({ kind: "move", itemId: backlog.itemId, issueNumber: backlog.number, from: "Backlog", to: "Ready" });
    expect(p.expectedUpdatedAt).toBe(backlog.updatedAt);
    expect(p.mutation).toEqual({
      name: "updateProjectV2ItemFieldValue",
      input: { projectId: demo.projectId, itemId: backlog.itemId, fieldId: demo.statusFieldId, value: { singleSelectOptionId: ready.id } },
    });
  });

  it("refuses a zone the board does not have", () => {
    expect(() => prepareMove(demo, backlog.itemId, "Somewhere")).toThrow(/Somewhere/);
  });

  it("refuses to move a pallet to the zone it is already in", () => {
    expect(() => prepareMove(demo, backlog.itemId, "Backlog")).toThrow(/already/);
  });

  it("refuses an item that is not on the board", () => {
    expect(() => prepareMove(demo, "PVTI_nope", "Ready")).toThrow(/PVTI_nope/);
  });
});
