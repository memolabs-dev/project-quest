import { describe, expect, it } from "vitest";
import { SITE_FOREMAN } from "./lead.ts";
import { PARCELS, ZONES, SIZES, parcelBody } from "./parcels.ts";
import type { Observed, PracticeIssue, PracticeSnapshot } from "./types.ts";

const level = (id: string) => SITE_FOREMAN.find((l) => l.id === id)!;
const VIEWER = "fictif-lead";

const board = (o: Partial<NonNullable<PracticeSnapshot["board"]>> = {}): NonNullable<PracticeSnapshot["board"]> => ({
  id: "PVT_team", number: 9, url: "https://github.com/users/fictif-lead/projects/9", columns: [...ZONES],
  statusFieldId: "F_status", statusOptions: [...ZONES],
  fields: [{ id: "F_size", name: "Size", dataType: "SINGLE_SELECT", options: SIZES.map((name, i) => ({ id: `s${i}`, name })) }],
  ...o,
});
const parcel = (key: string, o: Partial<PracticeIssue> = {}): PracticeIssue => {
  const p = PARCELS.find((x) => x.key === key)!;
  return {
    id: `I_${key}`, number: PARCELS.indexOf(p) + 1, url: `u-${key}`, author: VIEWER, assignees: [], comments: [],
    status: "Backlog", closed: false, labels: [], body: parcelBody(p), stateReason: null, duplicateOf: null, itemId: `PVTI_${key}`, size: null, ...o,
  };
};
const team = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R_team", nameWithOwner: "fictif-lead/my-first-team", url: "r" },
  board: board(), issues: PARCELS.map((p) => parcel(p.key)),
  defaultBranch: null, readme: null, branches: [], pulls: [], plan: null, mainHistory: [], labels: [], ...o,
});
const seen = (t: PracticeSnapshot | null): Observed => ({ viewer: VIEWER, events: [], practice: null, team: t });
const sorted = () => PARCELS.map((p) => p.duplicateOf
  ? parcel(p.key, { closed: true, stateReason: "DUPLICATE", duplicateOf: 2 })
  : parcel(p.key, { labels: ["enhancement"] }));

describe("the Site foreman levels", () => {
  it("are four, on the lead's path", () => {
    expect(SITE_FOREMAN.map((l) => l.id)).toEqual(["l1-found-team", "l2-sort-parcels", "l3-ready", "l4-size"]);
    expect(SITE_FOREMAN.every((l) => l.path === "lead" && l.rank === "site-foreman")).toBe(true);
  });
  it("bring six FICTIF parcels, one a duplicate of another", () => {
    expect(PARCELS).toHaveLength(6);
    expect(PARCELS.every((p) => p.title.startsWith("FICTIF "))).toBe(true);
    expect(PARCELS.filter((p) => p.duplicateOf)).toHaveLength(1);
    expect(parcelBody(PARCELS[0])).toContain("Written by project-quest for practice.");
  });
});

describe("l1-found-team", () => {
  it("passes on a board with the five zones and the Size field, proof the board", () => {
    expect(level("l1-found-team").check(seen(team()))).toEqual({ done: true, proof: board().url });
  });
  it("needs the five zones in order, and the sizes", () => {
    expect(level("l1-found-team").check(seen(team({ board: board({ statusOptions: ["Todo", "In Progress", "Done"] }) }))).done).toBe(false);
    expect(level("l1-found-team").check(seen(team({ board: board({ fields: [] }) }))).done).toBe(false);
    expect(level("l1-found-team").check(seen(null)).done).toBe(false);
  });
});

describe("l2-sort-parcels", () => {
  it("passes once every parcel is labelled and the duplicate closed as such, proof the duplicate", () => {
    expect(level("l2-sort-parcels").check(seen(team({ issues: sorted() })))).toEqual({ done: true, proof: "u-bench-again" });
  });
  it("l2 needs the duplicate closed as a duplicate", () => {
    const wrong = sorted().map((i) => (i.stateReason === "DUPLICATE" ? { ...i, stateReason: "NOT_PLANNED", duplicateOf: null } : i));
    expect(level("l2-sort-parcels").check(seen(team({ issues: wrong }))).done).toBe(false);
  });
  it("needs the duplicate to point at its true original", () => {
    const wrongTarget = sorted().map((i) => (i.stateReason === "DUPLICATE" ? { ...i, duplicateOf: 1 } : i));
    expect(level("l2-sort-parcels").check(seen(team({ issues: wrongTarget }))).done).toBe(false);
  });
  it("needs every open parcel labelled, and all six parcels there", () => {
    const one = sorted().map((i, n) => (n === 0 ? { ...i, labels: [] } : i));
    expect(level("l2-sort-parcels").check(seen(team({ issues: one }))).done).toBe(false);
    expect(level("l2-sort-parcels").check(seen(team({ issues: sorted().slice(1) }))).done).toBe(false);
  });
});

describe("l3-ready", () => {
  it("passes on a parcel with a task list, in Ready", () => {
    const ready = parcel("bench", { body: `${parcelBody(PARCELS[1])}\n\n## Definition of Ready\n- [ ] Size agreed`, status: "Ready" });
    expect(level("l3-ready").check(seen(team({ issues: [ready] })))).toEqual({ done: true, proof: "u-bench" });
  });
  it("any task list counts", () => {
    for (const line of ["* [ ] a", "- [x] done", "* [x] done"]) {
      const ready = parcel("bench", { body: `text\n${line}`, status: "Ready" });
      expect(level("l3-ready").check(seen(team({ issues: [ready] }))).done, line).toBe(true);
    }
  });
  it("needs both the list and the Ready column", () => {
    expect(level("l3-ready").check(seen(team({ issues: [parcel("bench", { status: "Ready" })] }))).done).toBe(false);
    expect(level("l3-ready").check(seen(team({ issues: [parcel("bench", { body: "- [ ] a" })] }))).done).toBe(false);
  });
});

describe("l4-size", () => {
  it("l4 needs something in Ready, all of it sized", () => {
    const sized = parcel("bench", { status: "Ready", size: "S" });
    expect(level("l4-size").check(seen(team({ issues: [sized] })))).toEqual({ done: true, proof: board().url });
    expect(level("l4-size").check(seen(team({ issues: [sized, parcel("hinge", { status: "Ready" })] }))).done).toBe(false);
    expect(level("l4-size").check(seen(team({ issues: [parcel("hinge")] }))).done).toBe(false);
  });
});
