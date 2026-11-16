import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Gql } from "./client.ts";
import { practiceConfig, readPractice } from "./read-practice.ts";

const fixture = JSON.parse(readFileSync(new URL("./__fixtures__/practice-response.json", import.meta.url), "utf8")) as {
  repository: { projectsV2: { nodes: unknown[] } };
};
const gqlReturning = (data: unknown): Gql => (async () => data) as Gql;

describe("readPractice", () => {
  it("maps the repository, its board and its issues", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.repo).toEqual({ id: "R_fictif", nameWithOwner: "fictif-volunteer/my-first-site", url: "https://github.com/fictif-volunteer/my-first-site" });
    expect(p?.board).toEqual({ id: "PVT_fictif", number: 3, url: "https://github.com/users/fictif-volunteer/projects/3", columns: ["Todo", "In Progress", "Done"] });
    expect(p?.issues[0]).toEqual({
      id: "I_fictif_1", number: 1, url: "https://github.com/fictif-volunteer/my-first-site/issues/1", author: "fictif-volunteer",
      assignees: ["fictif-volunteer"], closed: false, status: "In Progress",
      comments: [{ author: "fictif-volunteer", url: "https://github.com/fictif-volunteer/my-first-site/issues/1#issuecomment-1" }],
    });
  });
  it("takes the status from the practice board only, and survives deleted accounts", async () => {
    const p = await readPractice(gqlReturning(fixture), "fictif-volunteer", "my-first-site");
    expect(p?.issues[1]).toMatchObject({ author: "ghost", status: null, closed: true, comments: [{ author: "ghost" }] });
  });
  it("has no board when none is linked", async () => {
    const data = structuredClone(fixture);
    data.repository.projectsV2.nodes = [];
    const p = await readPractice(gqlReturning(data), "fictif-volunteer", "my-first-site");
    expect(p?.board).toBeNull();
    expect(p?.issues[0].status).toBeNull();
  });
  it("returns null when the repository does not exist", async () => {
    expect(await readPractice(gqlReturning({ repository: null }), "fictif-volunteer", "my-first-site")).toBeNull();
  });
});

describe("practiceConfig", () => {
  it("draws the practice board with the existing site code: its columns are the zones", () => {
    const c = practiceConfig("fictif-volunteer", "my-first-site", 3, ["Todo", "In Progress", "Done"]);
    expect(c).toMatchObject({ owner: "fictif-volunteer", repo: "my-first-site", projectNumber: 3, zones: ["Todo", "In Progress", "Done"] });
    expect(c.fields.status).toBe("Status");
  });
});
