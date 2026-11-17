import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../shared/config.ts";
import { buildSite, type BoardSnapshot } from "../../shared/site.ts";
import type { Gql } from "./client.ts";
import { readBoard } from "./read-board.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as unknown;
const config = loadConfig(read("../../../quest.config.json"));
const fixture = read("./__fixtures__/board-response.json") as {
  repositoryOwner: { projectV2: { items: { nodes: unknown[]; pageInfo: unknown } } };
};

const fakeGql = (pages: unknown[]): { gql: Gql; calls: Record<string, unknown>[] } => {
  const calls: Record<string, unknown>[] = [];
  const gql = (async (_query: string, variables: Record<string, unknown>) => {
    calls.push(variables);
    return pages[calls.length - 1];
  }) as Gql;
  return { gql, calls };
};

describe("readBoard", () => {
  it("turns the recorded board response into a snapshot", async () => {
    const { gql } = fakeGql([fixture]);
    const board = await readBoard(gql, config);
    const nodes = fixture.repositoryOwner.projectV2.items.nodes as { content: { __typename: string } | null }[];
    expect(board.items.length).toBe(nodes.filter((n) => n.content?.__typename === "Issue").length);
    expect(board.statusOptions.map((o) => o.name)).toEqual(config.zones);
    expect(board.items.every((i) => i.title.includes("FICTIF"))).toBe(true);
    expect(() => buildSite(board, config)).not.toThrow();
  });

  it("keeps only the configured repository's issues, so issue numbers never collide", async () => {
    const project = structuredClone(fixture.repositoryOwner.projectV2) as { items: { nodes: { content: Record<string, unknown> | null }[] } };
    const first = project.items.nodes.find((n) => n.content?.__typename === "Issue")!;
    const other = structuredClone(first);
    (other as unknown as { id: string }).id = "PVTI_other_repo";
    other.content!.repository = { nameWithOwner: "someone/else" };
    project.items.nodes.push(other);
    const { gql } = fakeGql([{ repositoryOwner: { projectV2: project } }]);
    const board = await readBoard(gql, config);
    expect(board.items.some((i) => i.itemId === "PVTI_other_repo")).toBe(false);
    expect(board.items.length).toBeGreaterThan(0);
  });

  it("the viewer's own reactions are read, nobody else's", async () => {
    const project = structuredClone(fixture.repositoryOwner.projectV2) as { items: { nodes: { content: Record<string, unknown> | null }[] } };
    const first = project.items.nodes.find((n) => n.content?.__typename === "Issue")!;
    first.content!.reactionGroups = [
      { content: "HOORAY", viewerHasReacted: true },
      { content: "HEART", viewerHasReacted: false },
      { content: "EYES", viewerHasReacted: true },
    ];
    const { gql } = fakeGql([{ repositoryOwner: { projectV2: project } }]);
    const board = await readBoard(gql, config);
    const item = board.items.find((i) => i.number === first.content!.number)!;
    expect(item.myReactions).toEqual(["HOORAY", "EYES"]);
    // The site keeps only the four warm signs.
    expect(buildSite(board, config).pallets.find((p) => p.number === item.number)?.myReactions ?? ["HOORAY"]).toEqual(["HOORAY"]);
  });

  it("follows pagination, passing the cursor back", async () => {
    const project = fixture.repositoryOwner.projectV2;
    const page = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null) => ({
      repositoryOwner: { projectV2: { ...project, items: { nodes, pageInfo: { hasNextPage, endCursor } } } },
    });
    const all = project.items.nodes;
    const { gql, calls } = fakeGql([page(all.slice(0, 2), true, "CURSOR1"), page(all.slice(2), false, null)]);
    const board = await readBoard(gql, config);
    expect(calls.map((c) => c.after ?? null)).toEqual([null, "CURSOR1"]);
    expect(board.items.length).toBeGreaterThan(2);
  });

  it("the demo board is a valid site", () => {
    const demo = read("../../shared/demo/demo-board.json") as BoardSnapshot;
    const site = buildSite(demo, config);
    expect(site.buildings.filter((b) => b.epicNumber !== null).length).toBe(3);
    expect(new Set(site.pallets.map((p) => p.zone))).toEqual(new Set(config.zones));
    expect(site.pallets.filter((p) => p.isBug).length).toBe(2);
    expect(site.buildings.some((b) => b.epicNumber === null)).toBe(true);
    expect(demo.items.every((i) => i.title.includes("FICTIF"))).toBe(true);
  });
});
