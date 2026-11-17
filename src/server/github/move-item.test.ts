import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../shared/config.ts";
import { prepareMove } from "../../shared/gestures/move.ts";
import type { BoardSnapshot } from "../../shared/site.ts";
import type { Gql } from "./client.ts";
import { applyMove } from "./move-item.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const config = loadConfig(read("../../../quest.config.json"));
const demo = read("../../shared/demo/demo-board.json") as BoardSnapshot;
const item = demo.items.find((i) => i.status === "Backlog" && !i.isEpic && i.state === "OPEN")!;
const prepared = prepareMove(demo, item.itemId, "Ready");

/** A fake GitHub: answers the freshness check, records mutations, then serves the board. */
const fakeGitHub = (current: { status: string; updatedAt: string }, opts: { failMutation?: string; failReadBoard?: boolean } = {}) => {
  const mutations: Record<string, unknown>[] = [];
  const gql = (async (query: string, variables: Record<string, unknown>) => {
    if (query.includes("query ItemState")) {
      return { node: { id: item.itemId, updatedAt: current.updatedAt, status: { name: current.status } } };
    }
    if (query.includes("mutation")) {
      if (opts.failMutation) throw Object.assign(new Error(opts.failMutation), { errors: [{ message: opts.failMutation }] });
      mutations.push(variables);
      return { updateProjectV2ItemFieldValue: { projectV2Item: { id: item.itemId } } };
    }
    if (opts.failReadBoard) throw new Error("network down");
    return read("./__fixtures__/board-response.json");
  }) as Gql;
  return { gql, mutations };
};

describe("applyMove, when the pallet is no longer as it was", () => {
  const answering = (node: unknown) => (async (query: string) => {
    if (query.includes("query ItemState")) return { node };
    throw new Error("nothing else expected");
  }) as Gql;
  it("says whether it was moved, changed or is gone", async () => {
    expect(await applyMove(answering({ updatedAt: item.updatedAt, status: { name: "Done" } }), config, prepared))
      .toMatchObject({ ok: false, reason: "stale", current: { status: "Done", change: "moved" } });
    expect(await applyMove(answering({ updatedAt: "2099-01-01T00:00:00Z", status: { name: "Backlog" } }), config, prepared))
      .toMatchObject({ ok: false, reason: "stale", current: { change: "changed" } });
    expect(await applyMove(answering(null), config, prepared))
      .toMatchObject({ ok: false, reason: "stale", current: { status: null, change: "gone" } });
  });
  it("reports a freshness check GitHub refused instead of throwing", async () => {
    const refusing = (async () => { throw Object.assign(new Error("bad id"), { errors: [{ message: "Could not resolve to a node" }] }); }) as Gql;
    expect(await applyMove(refusing, config, prepared)).toEqual({ ok: false, reason: "github", message: "Could not resolve to a node" });
  });
});

describe("applyMove", () => {
  it("sends the prepared mutation once when nothing changed meanwhile", async () => {
    const { gql, mutations } = fakeGitHub({ status: "Backlog", updatedAt: item.updatedAt });
    const result = await applyMove(gql, config, prepared);
    expect(result.ok).toBe(true);
    expect(mutations).toEqual([prepared.mutation.input]);
  });

  it("refuses a stale move without sending anything", async () => {
    const { gql, mutations } = fakeGitHub({ status: "In progress", updatedAt: "2026-11-16T11:00:00Z" });
    const result = await applyMove(gql, config, prepared);
    expect(result).toMatchObject({ ok: false, reason: "stale", current: { status: "In progress" } });
    expect(mutations).toEqual([]);
  });

  it("moves an item that had no column, without calling it stale", async () => {
    const noColumn = { ...prepared, from: null };
    const { gql, mutations } = fakeGitHub({ status: null as unknown as string, updatedAt: item.updatedAt });
    const result = await applyMove(gql, config, noColumn);
    expect(result.ok).toBe(true);
    expect(mutations.length).toBe(1);
  });

  it("still reports success when the board cannot be re-read after the write", async () => {
    const { gql, mutations } = fakeGitHub({ status: "Backlog", updatedAt: item.updatedAt }, { failReadBoard: true });
    const result = await applyMove(gql, config, prepared);
    expect(result).toEqual({ ok: true, board: null });
    expect(mutations.length).toBe(1);
  });

  it("reports GitHub's own message when the mutation fails", async () => {
    const { gql } = fakeGitHub({ status: "Backlog", updatedAt: item.updatedAt }, { failMutation: "Resource not accessible by integration" });
    const result = await applyMove(gql, config, prepared);
    expect(result).toEqual({ ok: false, reason: "github", message: "Resource not accessible by integration" });
  });
});
