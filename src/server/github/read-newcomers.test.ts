import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../shared/config.ts";
import type { Gql } from "./client.ts";
import { readNewcomers } from "./read-newcomers.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as { repository: { contributing: unknown } };
const config = loadConfig(read("../../../quest.config.json"));
const fixture = read("./__fixtures__/newcomers-response.json");
const gqlOf = (res: unknown): Gql => (async () => res) as Gql;

describe("readNewcomers", () => {
  it("only first-time authors the viewer has not commented on", async () => {
    const found = await readNewcomers(gqlOf(fixture), config);
    expect(found.map((n) => n.login)).toEqual(["fictif-lucas", "fictif-sana"]);
    expect(found[0]).toMatchObject({ pr: { number: 31, title: "FICTIF Fix the clock" }, closes: [7, 9], avatarUrl: "https://example.org/lucas.png" });
    expect(found[1].closes).toEqual([]);
  });

  it("the contributing guide is linked when it exists", async () => {
    expect((await readNewcomers(gqlOf(fixture), config))[0].contributingUrl).toBe("https://github.com/fictif-org/demo-site/blob/HEAD/CONTRIBUTING.md");
    const without = { repository: { ...fixture.repository, contributing: null } };
    expect((await readNewcomers(gqlOf(without), config))[0].contributingUrl).toBeNull();
  });

  it("only people: a bot (no [bot] suffix in GraphQL) and a mannequin are never welcomed", async () => {
    const pr = (n: number, author: unknown) => ({
      id: `PR_fictif_${n}`, number: n, title: "FICTIF A change", url: `https://github.com/fictif-org/demo-site/pull/${n}`,
      authorAssociation: "FIRST_TIME_CONTRIBUTOR", author, closingIssuesReferences: { nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] },
    });
    const res = { repository: { ...fixture.repository, pullRequests: { nodes: [
      pr(40, { __typename: "Bot", login: "dependabot", avatarUrl: "" }),
      pr(41, { __typename: "Mannequin", login: "fictif-imported", avatarUrl: "" }),
      pr(42, { __typename: "User", login: "fictif-helper[bot]", avatarUrl: "" }),
      pr(43, { __typename: "User", login: "fictif-ines", avatarUrl: "" }),
    ] } } };
    expect((await readNewcomers(gqlOf(res), config)).map((n) => n.login)).toEqual(["fictif-ines"]);
  });
});
