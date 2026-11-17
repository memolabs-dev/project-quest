import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../shared/config.ts";
import type { Gql } from "./client.ts";
import { GOOD_FIRST_QUERY, readGoodFirst } from "./read-real.ts";

const fixture = JSON.parse(readFileSync(new URL("./__fixtures__/good-first-response.json", import.meta.url), "utf8")) as unknown;
const base = JSON.parse(readFileSync(new URL("../../../quest.config.json", import.meta.url), "utf8")) as Record<string, unknown>;

describe("readGoodFirst", () => {
  it("reads the configured project's open good first issues with their comments", async () => {
    const calls: Record<string, unknown>[] = [];
    const gql = (async (_q: string, v: Record<string, unknown>) => { calls.push(v); return fixture; }) as Gql;
    const config = loadConfig({ ...base, owner: "fictif-org", repo: "fictif-site" });
    const r = await readGoodFirst(gql, config);
    expect(calls[0]).toMatchObject({ owner: "fictif-org", name: "fictif-site", labels: ["good first issue"] });
    expect(r).toEqual({
      repo: "fictif-org/fictif-site",
      issues: [{
        id: "I_gf_21", number: 21, title: "FICTIF The mayor's small idea: a fountain", url: "https://github.com/fictif-org/fictif-site/issues/21",
        assignees: [],
        comments: [
          { author: "fictif-volunteer", url: "https://github.com/fictif-org/fictif-site/issues/21#issuecomment-1" },
          { author: "ghost", url: "https://github.com/fictif-org/fictif-site/issues/21#issuecomment-2" },
        ],
      }],
    });
  });
  it("takes the label names from the configuration", async () => {
    const calls: Record<string, unknown>[] = [];
    const gql = (async (_q: string, v: Record<string, unknown>) => { calls.push(v); return fixture; }) as Gql;
    await readGoodFirst(gql, loadConfig({ ...base, labels: { ...(base.labels as object), goodFirst: ["débutant"] } }));
    expect(calls[0].labels).toEqual(["débutant"]);
    expect(GOOD_FIRST_QUERY).toMatch(/states: OPEN/);
  });
});
