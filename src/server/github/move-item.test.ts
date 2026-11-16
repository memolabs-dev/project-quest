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
const fakeGitHub = (current: { status: string; updatedAt: string }, opts: { failMutation?: string } = {}) => {
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
    return read("./__fixtures__/board-response.json");
  }) as Gql;
  return { gql, mutations };
};

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

  it("reports GitHub's own message when the mutation fails", async () => {
    const { gql } = fakeGitHub({ status: "Backlog", updatedAt: item.updatedAt }, { failMutation: "Resource not accessible by integration" });
    const result = await applyMove(gql, config, prepared);
    expect(result).toEqual({ ok: false, reason: "github", message: "Resource not accessible by integration" });
  });
});
