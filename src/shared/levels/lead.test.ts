import { describe, expect, it } from "vitest";
import { SITE_FOREMAN, SITE_MANAGER, SIZE_POINTS, currentIteration } from "./lead.ts";
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

describe("the Site manager levels", () => {
  const TODAY = "2026-11-17";
  const sprintField = (iterations = [{ id: "it1", title: "Sprint 1", startDate: "2026-11-10", duration: 7 }, { id: "it2", title: "Sprint 2", startDate: "2026-11-17", duration: 7 }]) =>
    ({ id: "F_sprint", name: "Sprint", dataType: "ITERATION", iterations });
  const planned = (issues: PracticeIssue[], o: Partial<Observed> = {}): Observed => ({
    ...seen(team({ issues, board: board({ fields: [...board().fields!, sprintField()] }) })), capacity: 5, today: TODAY, ...o,
  });
  const m = (id: string) => SITE_MANAGER.find((l) => l.id === id)!;

  it("are four, on the lead's path, after the Site foreman", () => {
    expect(SITE_MANAGER.map((l) => l.id)).toEqual(["l5-sprint", "l6-milestone", "l7-split", "l8-rope"]);
    expect(SITE_MANAGER.every((l) => l.path === "lead" && l.rank === "site-manager")).toBe(true);
    expect(SIZE_POINTS).toEqual({ XS: 1, S: 2, M: 3, L: 5, XL: 8 });
  });

  describe("l5-sprint", () => {
    it("passes on a current sprint whose sized pallets fit the capacity, proof the board", () => {
      const o = planned([parcel("bench", { iteration: "it2", size: "S" }), parcel("hinge", { iteration: "it2", size: "M" })]);
      expect(m("l5-sprint").check(o)).toEqual({ done: true, proof: board().url });
    });
    it("l5 passes again once the load fits", () => {
      const over = [parcel("bench", { iteration: "it2", size: "S" }), parcel("square", { iteration: "it2", size: "XL" })];
      expect(m("l5-sprint").check(planned(over)).done).toBe(false);
      expect(m("l5-sprint").check(planned([over[0], { ...over[1], iteration: null }])).done).toBe(true);
    });
    it("l5 needs every pallet of the sprint sized", () => {
      expect(m("l5-sprint").check(planned([parcel("bench", { iteration: "it2", size: "S" }), parcel("nicer", { iteration: "it2" })])).done).toBe(false);
    });
    it("l5 needs a capacity declared", () => {
      expect(m("l5-sprint").check(planned([parcel("bench", { iteration: "it2", size: "S" })], { capacity: null })).done).toBe(false);
    });
    it("l5 counts only the current sprint, and only open pallets", () => {
      expect(m("l5-sprint").check(planned([parcel("bench", { iteration: "it1", size: "S" })])).done).toBe(false);
      expect(m("l5-sprint").check(planned([parcel("bench", { iteration: "it2", size: "S", closed: true })])).done).toBe(false);
      expect(m("l5-sprint").check(planned([parcel("bench", { iteration: "it2", size: "S" })], { today: "2026-11-24" })).done).toBe(false);
    });
    it("knows the current sprint: from its first day, up to the day before the next", () => {
      const f = sprintField();
      expect(currentIteration(f, "2026-11-16")?.id).toBe("it1");
      expect(currentIteration(f, "2026-11-17")?.id).toBe("it2");
      expect(currentIteration(f, "2026-11-23")?.id).toBe("it2");
      expect(currentIteration(f, "2026-11-24")).toBeNull();
    });
  });

  describe("l6-milestone", () => {
    const visit = { id: "MI_1", number: 1, title: "FICTIF The mayor visits", dueOn: "2026-11-29T12:00:00Z", url: "u-visit", closed: false };
    it("passes on an open milestone with a due date and an issue under it, proof the milestone", () => {
      expect(m("l6-milestone").check(seen(team({ milestones: [visit], issues: [parcel("bench", { milestone: 1 })] })))).toEqual({ done: true, proof: "u-visit" });
    });
    it("l6 needs a due date and an issue under it", () => {
      expect(m("l6-milestone").check(seen(team({ milestones: [{ ...visit, dueOn: null }], issues: [parcel("bench", { milestone: 1 })] }))).done).toBe(false);
      expect(m("l6-milestone").check(seen(team({ milestones: [visit], issues: [parcel("bench")] }))).done).toBe(false);
      expect(m("l6-milestone").check(seen(team({ milestones: [{ ...visit, closed: true }], issues: [parcel("bench", { milestone: 1 })] }))).done).toBe(false);
    });
  });

  describe("l7-split", () => {
    it("passes on an issue split in parts, proof that issue", () => {
      expect(m("l7-split").check(seen(team({ issues: [parcel("square", { subIssues: [7, 8] })] })))).toEqual({ done: true, proof: "u-square" });
    });
    it("l7 needs two parts at least", () => {
      expect(m("l7-split").check(seen(team({ issues: [parcel("square", { subIssues: [7] })] }))).done).toBe(false);
    });
  });

  describe("l8-rope", () => {
    it("passes on an open issue waiting for another, proof that issue", () => {
      expect(m("l8-rope").check(seen(team({ issues: [parcel("bench", { blockedBy: [1] })] })))).toEqual({ done: true, proof: "u-bench" });
    });
    it("needs the waiting issue open", () => {
      expect(m("l8-rope").check(seen(team({ issues: [parcel("bench", { blockedBy: [1], closed: true })] }))).done).toBe(false);
      expect(m("l8-rope").check(seen(team({ issues: [parcel("bench")] }))).done).toBe(false);
    });
  });
});
