import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_DECISIONS, OPERATIONS, REVIEWED_ONE_BY_ONE, type Decision } from "./api-coverage.ts";

interface Operation { id: string; api: string; category: string }
const inventory = JSON.parse(readFileSync(new URL("../../docs/github-api/inventory.json", import.meta.url), "utf8")) as { operations: Operation[] };
const key = (o: Operation) => `${o.api}:${o.category}`;
const reviewed = new Set<string>(REVIEWED_ONE_BY_ONE);

describe("GitHub API coverage", () => {
  it("decides every operation of the API, by name or by category", () => {
    const missing = inventory.operations.filter((o) => !OPERATIONS[o.id] && !CATEGORY_DECISIONS[key(o)]).map((o) => o.id);
    expect(missing).toEqual([]);
  });

  it("decides each operation of a reviewed category by name, never by a category default", () => {
    expect(REVIEWED_ONE_BY_ONE.filter((c: string) => CATEGORY_DECISIONS[c])).toEqual([]);
    const missing = inventory.operations.filter((o) => reviewed.has(key(o)) && !OPERATIONS[o.id]).map((o) => o.id);
    expect(missing).toEqual([]);
  });

  it("names only operations that exist in the downloaded API", () => {
    const known = new Set(inventory.operations.map((o) => o.id));
    expect(Object.keys(OPERATIONS).filter((id) => !known.has(id))).toEqual([]);
    const categories = new Set(inventory.operations.map(key));
    expect(Object.keys(CATEGORY_DECISIONS).filter((c) => !categories.has(c))).toEqual([]);
  });

  it("makes founding the practice site a gesture (levels, Apprentice rank)", () => {
    for (const id of ["graphql.mutation.createRepository", "graphql.mutation.createProjectV2"]) {
      expect(OPERATIONS[id]?.kind, id).toBe("gesture");
    }
  });

  it("makes the Journeyman's gestures gestures, and merging one only on your practice site", () => {
    for (const id of ["graphql.mutation.createRef", "graphql.mutation.createCommitOnBranch", "graphql.mutation.createPullRequest",
      "graphql.mutation.mergePullRequest", "rest.repos/create-or-update-file-contents"]) {
      expect(OPERATIONS[id]?.kind, id).toBe("gesture");
    }
    const merge = OPERATIONS["graphql.mutation.mergePullRequest"];
    expect(merge.kind === "gesture" && merge.gesture).toMatch(/your own pull request on your practice site/);
  });

  it("makes setting up a team board a gesture (lead's path)", () => {
    for (const id of ["graphql.mutation.createProjectV2Field", "graphql.mutation.updateProjectV2Field"]) {
      expect(OPERATIONS[id]?.kind, id).toBe("gesture");
    }
  });

  it("gives every decision a reason or a gesture", () => {
    const decisions: Decision[] = [...Object.values(OPERATIONS), ...Object.values(CATEGORY_DECISIONS)];
    for (const d of decisions) {
      const text = d.kind === "gesture" ? d.gesture : d.kind === "read" ? d.shows : d.why;
      expect(text.length).toBeGreaterThan(10);
    }
  });
});
