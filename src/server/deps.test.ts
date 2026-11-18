import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/config.ts";
import type { Gql } from "./github/client.ts";
import { liveDeps } from "./deps.ts";

const config = loadConfig(JSON.parse(readFileSync(new URL("../../quest.config.json", import.meta.url), "utf8")) as unknown);

// The viewer is read once for the server's life: /api/site needs it before the board, on every load.
describe("the live viewer", () => {
  it("two viewer reads, and the viewer's id, make one GraphQL request", async () => {
    const queries: string[] = [];
    const gql = (async (query: string) => {
      queries.push(query);
      return { viewer: { id: "U_fictif", login: "fictif-lead", avatarUrl: "https://example.org/a.png" } };
    }) as Gql;
    const d = liveDeps(config, async () => gql);
    expect(await d.viewer()).toEqual({ login: "fictif-lead", avatarUrl: "https://example.org/a.png" });
    expect(await d.viewer()).toEqual({ login: "fictif-lead", avatarUrl: "https://example.org/a.png" });
    expect(await d.viewerId()).toBe("U_fictif");
    expect(queries.filter((q) => q.includes("viewer"))).toHaveLength(1);
  });

  it("a failed first read is retried, then kept", async () => {
    let calls = 0;
    const gql = (async () => {
      calls++;
      if (calls === 1) throw new Error("FICTIF GitHub is down");
      return { viewer: { id: "U_fictif", login: "fictif-lead", avatarUrl: "" } };
    }) as Gql;
    const d = liveDeps(config, async () => gql);
    await expect(d.viewer()).rejects.toThrow("FICTIF GitHub is down");
    expect((await d.viewer()).login).toBe("fictif-lead");
    await d.viewer();
    expect(calls).toBe(2);
  });
});
