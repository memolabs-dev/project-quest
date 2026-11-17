import { describe, expect, it } from "vitest";
import { PARCELS, SIZES, ZONES, parcelBody } from "../levels/parcels.ts";
import type { PracticeIssue, PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import {
  prepareAttach, prepareBulletin, prepareChecklist, prepareCloseVisit, prepareFinish, prepareMoveVisit, prepareTeamDay, prepareWipLimit, prepareCloseDuplicate, prepareFoundTeam, prepareLabel, prepareLoad, prepareMilestone,
  prepareParcels, prepareRope, prepareSize, prepareSplit, prepareSprintField, prepareUnload,
} from "./team.ts";

const viewer = { login: "fictif-lead", id: "U_lead" };
const sizeField = { id: "F_size", name: "Size", dataType: "SINGLE_SELECT", options: SIZES.map((name, i) => ({ id: `s${i}`, name })) };
const issue = (number: number, o: Partial<PracticeIssue> = {}): PracticeIssue => ({
  id: `I_${number}`, number, url: `u${number}`, author: "fictif-lead", assignees: [], comments: [], status: "Backlog", closed: false,
  labels: [], body: "FICTIF body", stateReason: null, duplicateOf: null, itemId: `PVTI_${number}`, size: null, ...o,
});
const team = (o: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  repo: { id: "R_team", nameWithOwner: "fictif-lead/my-first-team", url: "r" },
  board: { id: "PVT_team", number: 9, url: "b", columns: [...ZONES], statusFieldId: "F_status", statusOptions: [...ZONES], fields: [sizeField] },
  issues: [], defaultBranch: null, readme: null, branches: [], pulls: [], plan: null, mainHistory: [],
  labels: [{ id: "LA_bug", name: "bug" }, { id: "LA_enh", name: "enhancement" }], ...o,
});

describe("prepareFoundTeam", () => {
  it("founds a team site: repository, board, five zones, sizes", () => {
    const p = prepareFoundTeam(viewer, null, "my-first-team", "PRIVATE");
    expect(p.mutations.map((m) => m.name)).toEqual(["createRepository", "createProjectV2", "updateProjectV2Field", "createProjectV2Field"]);
    expect(p.mutations[2].input).toMatchObject({ fieldId: "$statusFieldId" });
    const options = p.mutations[2].input.singleSelectOptions as { name: string; color: string; description: string }[];
    expect(options.map((o) => o.name)).toEqual([...ZONES]);
    expect(options.every((o) => o.color && o.description)).toBe(true);
    expect(p.mutations[3].input).toMatchObject({ projectId: "$projectId", name: "Size", dataType: "SINGLE_SELECT" });
  });
  it("sets up an existing team board", () => {
    const p = prepareFoundTeam(viewer, team({ board: { ...team().board!, statusOptions: ["Todo", "In Progress", "Done"], fields: [] } }), "my-first-team", "PRIVATE");
    expect(p.mutations.map((m) => m.name)).toEqual(["updateProjectV2Field", "createProjectV2Field"]);
    expect(p.mutations[0].input).toMatchObject({ fieldId: "F_status" });
    expect(p.mutations[1].input).toMatchObject({ projectId: "PVT_team" });
  });
  it("keeps the options that already exist, so their items keep their column", () => {
    const old = team({ board: { ...team().board!, statusOptions: ["Backlog", "Done"], statusOptionIds: [{ id: "opt_b", name: "Backlog" }, { id: "opt_d", name: "Done" }] } });
    const options = prepareFoundTeam(viewer, old, "my-first-team", "PRIVATE").mutations[0].input.singleSelectOptions as { id?: string; name: string }[];
    expect(options.find((o) => o.name === "Backlog")?.id).toBe("opt_b");
    expect(options.find((o) => o.name === "Done")?.id).toBe("opt_d");
    expect(options.find((o) => o.name === "Ready")?.id).toBeUndefined();
  });
  it("refuses to drop a column that still holds items", () => {
    const old = team({
      board: { ...team().board!, statusOptions: ["Todo", "Done"], statusOptionIds: [{ id: "opt_t", name: "Todo" }, { id: "opt_d", name: "Done" }] },
      issues: [issue(1, { status: "Todo" })],
    });
    expect(() => prepareFoundTeam(viewer, old, "my-first-team", "PRIVATE")).toThrow(/Todo/);
  });
  it("founds nothing when the site is complete", () => {
    expect(() => prepareFoundTeam(viewer, team(), "my-first-team", "PRIVATE")).toThrow(GestureError);
  });
});

describe("prepareParcels", () => {
  it("the mayor's six parcels, each put on the board", () => {
    const p = prepareParcels(team());
    expect(p.mutations).toHaveLength(12);
    expect(p.mutations.filter((m) => m.name === "createIssue").map((m) => m.input.title)).toEqual(PARCELS.map((x) => x.title));
    expect(p.mutations[0].input).toMatchObject({ repositoryId: "R_team", body: parcelBody(PARCELS[0]) });
    expect(p.mutations[1]).toEqual({ name: "addProjectV2ItemById", input: { projectId: "PVT_team", contentId: "$issueId" } });
  });
  it("sends only what is missing after a batch stopped half-way", () => {
    const half = team({ issues: [
      issue(1, { body: parcelBody(PARCELS[0]) }),
      issue(2, { body: parcelBody(PARCELS[1]), itemId: null }),
    ] });
    const p = prepareParcels(half);
    expect(p.mutations.filter((m) => m.name === "createIssue").map((m) => m.input.title)).toEqual(PARCELS.slice(2).map((x) => x.title));
    expect(p.mutations[0]).toEqual({ name: "addProjectV2ItemById", input: { projectId: "PVT_team", contentId: "I_2" } });
  });
  it("refuses the parcels once all six are there, on the board", () => {
    const all = team({ issues: PARCELS.map((x, n) => issue(n + 1, { body: parcelBody(x) })) });
    expect(() => prepareParcels(all)).toThrow(GestureError);
  });
});

describe("the sorting gestures", () => {
  it("labels with the repository's own label", () => {
    const p = prepareLabel(team({ issues: [issue(1)] }), 1, "bug");
    expect(p.mutations).toEqual([{ name: "addLabelsToLabelable", input: { labelableId: "I_1", labelIds: ["LA_bug"] } }]);
    expect(() => prepareLabel(team({ issues: [issue(1)] }), 1, "unicorn")).toThrow(GestureError);
  });
  it("closes the duplicate as a duplicate of its original", () => {
    const p = prepareCloseDuplicate(team({ issues: [issue(2), issue(6)] }), 6, 2);
    expect(p.mutations).toEqual([{ name: "closeIssue", input: { issueId: "I_6", stateReason: "DUPLICATE", duplicateIssueId: "I_2" } }]);
    expect(() => prepareCloseDuplicate(team({ issues: [issue(2)] }), 2, 2)).toThrow(GestureError);
  });
  it("writes the Definition of Ready under the body", () => {
    const p = prepareChecklist(team({ issues: [issue(2)] }), 2, ["One wooden bench", " ", "Faces the square"]);
    expect(p.mutations).toEqual([{ name: "updateIssue", input: {
      id: "I_2", body: "FICTIF body\n\n## Definition of Ready\n- [ ] One wooden bench\n- [ ] Faces the square",
    } }]);
    expect(() => prepareChecklist(team({ issues: [issue(2)] }), 2, ["  "])).toThrow(GestureError);
  });
  it("sizes on the board's Size field", () => {
    const p = prepareSize(team({ issues: [issue(2)] }), 2, "M");
    expect(p.mutations).toEqual([{ name: "updateProjectV2ItemFieldValue", input: {
      projectId: "PVT_team", itemId: "PVTI_2", fieldId: "F_size", value: { singleSelectOptionId: "s2" },
    } }]);
    expect(() => prepareSize(team({ issues: [issue(2)] }), 2, "XXL")).toThrow(GestureError);
  });
});

describe("the Site manager's gestures", () => {
  const TODAY = "2026-11-17";
  const sprint = (iterations = [{ id: "it1", title: "Sprint 1", startDate: "2026-11-17", duration: 7 }]) =>
    ({ id: "F_sprint", name: "Sprint", dataType: "ITERATION", iterations });
  const withSprint = (o: Partial<PracticeSnapshot> = {}, iterations?: Parameters<typeof sprint>[0]) =>
    team({ board: { ...team().board!, fields: [sizeField, sprint(iterations)] }, ...o });

  it("creates the Sprint field with its first week", () => {
    const p = prepareSprintField(team(), TODAY);
    expect(p.mutations).toEqual([{ name: "createProjectV2Field", input: {
      projectId: "PVT_team", name: "Sprint", dataType: "ITERATION",
      iterationConfiguration: { startDate: TODAY, duration: 7, iterations: [{ title: "Sprint 1", startDate: TODAY, duration: 7 }] },
    } }]);
    expect(() => prepareSprintField(withSprint(), TODAY)).toThrow(GestureError);
  });
  it("adds the next sprint, keeping the past ones", () => {
    const past = [{ id: "it1", title: "Sprint 1", startDate: "2026-11-03", duration: 7 }, { id: "it2", title: "Sprint 2", startDate: "2026-11-10", duration: 7 }];
    const p = prepareSprintField(withSprint({}, past), TODAY);
    expect(p.mutations).toEqual([{ name: "updateProjectV2Field", input: {
      fieldId: "F_sprint",
      iterationConfiguration: { startDate: "2026-11-03", duration: 7, iterations: [...past, { title: "Sprint 3", startDate: TODAY, duration: 7 }] },
    } }]);
  });
  it("loads and unloads a pallet on the current sprint", () => {
    const t = withSprint({ issues: [issue(2), issue(3, { iteration: "it1" }), issue(4, { itemId: null })] });
    expect(prepareLoad(t, 2, TODAY).mutations).toEqual([{ name: "updateProjectV2ItemFieldValue", input: {
      projectId: "PVT_team", itemId: "PVTI_2", fieldId: "F_sprint", value: { iterationId: "it1" },
    } }]);
    expect(prepareUnload(t, 3).mutations).toEqual([{ name: "clearProjectV2ItemFieldValue", input: { projectId: "PVT_team", itemId: "PVTI_3", fieldId: "F_sprint" } }]);
    expect(() => prepareLoad(t, 3, TODAY)).toThrow(/already/);
    expect(() => prepareLoad(t, 4, TODAY)).toThrow(GestureError);
    expect(() => prepareUnload(t, 2)).toThrow(GestureError);
    expect(() => prepareLoad(t, 2, "2026-12-01")).toThrow(/sprint/);
  });
  it("sets the mayor's visit and puts issues under it", () => {
    const p = prepareMilestone(team({ issues: [issue(2), issue(3)] }), " FICTIF The mayor visits ", "2026-11-29", [2, 3], TODAY);
    expect(p.mutations).toEqual([
      { name: "createMilestone", input: { title: "FICTIF The mayor visits", description: "Written by project-quest for practice.", due_on: "2026-11-29T12:00:00Z" } },
      { name: "updateIssue", input: { id: "I_2", milestoneId: "$milestoneId" } },
      { name: "updateIssue", input: { id: "I_3", milestoneId: "$milestoneId" } },
    ]);
    const visit = { id: "MI_1", number: 1, title: "FICTIF The mayor visits", dueOn: "2026-11-29T12:00:00Z", url: "m", closed: false, openIssues: 0, closedIssues: 0 };
    expect(prepareAttach(team({ issues: [issue(4)], milestones: [visit] }), 4, 1).mutations).toEqual([{ name: "updateIssue", input: { id: "I_4", milestoneId: "MI_1" } }]);
  });
  it("refuses a past or malformed due date, and a title in use", () => {
    const t = team({ issues: [issue(2)], milestones: [{ id: "MI_1", number: 1, title: "FICTIF Visit", dueOn: null, url: "m", closed: false, openIssues: 0, closedIssues: 0 }] });
    for (const due of ["2026-11-16", "29/11/2026", "2026-02-30", ""]) {
      expect(() => prepareMilestone(t, "FICTIF Other", due, [2], TODAY), due).toThrow(GestureError);
    }
    expect(() => prepareMilestone(t, "FICTIF Visit", "2026-11-29", [2], TODAY)).toThrow(/already/);
    expect(() => prepareMilestone(t, "  ", "2026-11-29", [2], TODAY)).toThrow(GestureError);
    expect(() => prepareMilestone(t, "FICTIF Other", "2026-11-29", [], TODAY)).toThrow(GestureError);
    expect(prepareMilestone(t, "FICTIF Other", TODAY, [2], TODAY).mutations).toHaveLength(2);
  });
  it("refuses a title a closed milestone already holds: GitHub keeps titles unique", () => {
    const t = team({ issues: [issue(2)], milestones: [{ id: "MI_1", number: 1, title: "FICTIF Visit", dueOn: null, url: "m", closed: true, openIssues: 0, closedIssues: 0 }] });
    expect(() => prepareMilestone(t, "FICTIF Visit", "2026-11-29", [2], TODAY)).toThrow(/already/);
  });
  it("splits into FICTIF parts, each a sub-issue on the board", () => {
    const p = prepareSplit(team({ issues: [issue(3)] }), 3, ["New paving", " ", "FICTIF New lights"]);
    expect(p.mutations).toEqual([
      { name: "createIssue", input: { repositoryId: "R_team", title: "FICTIF New paving", body: "Part of #3.\n\nWritten by project-quest for practice." } },
      { name: "addProjectV2ItemById", input: { projectId: "PVT_team", contentId: "$issueId" } },
      { name: "addSubIssue", input: { issueId: "I_3", subIssueId: "$issueId" } },
      { name: "createIssue", input: { repositoryId: "R_team", title: "FICTIF New lights", body: "Part of #3.\n\nWritten by project-quest for practice." } },
      { name: "addProjectV2ItemById", input: { projectId: "PVT_team", contentId: "$issueId" } },
      { name: "addSubIssue", input: { issueId: "I_3", subIssueId: "$issueId" } },
    ]);
  });
  it("refuses a split in fewer than two parts", () => {
    expect(() => prepareSplit(team({ issues: [issue(3)] }), 3, ["Only one", "  "])).toThrow(GestureError);
    expect(() => prepareSplit(team({ issues: [issue(3, { closed: true })] }), 3, ["a", "b"])).toThrow(GestureError);
  });
  it("ropes one pallet behind another", () => {
    expect(prepareRope(team({ issues: [issue(2), issue(5)] }), 5, 2).mutations).toEqual([
      { name: "addBlockedBy", input: { issueId: "I_5", blockingIssueId: "I_2" } },
    ]);
  });
  it("refuses a rope to itself or a circle", () => {
    expect(() => prepareRope(team({ issues: [issue(2)] }), 2, 2)).toThrow(GestureError);
    expect(() => prepareRope(team({ issues: [issue(2), issue(5, { blockedBy: [2] })] }), 5, 2)).toThrow(/already/);
    expect(() => prepareRope(team({ issues: [issue(2, { blockedBy: [5] }), issue(5)] }), 5, 2)).toThrow(GestureError);
  });
});

describe("the Project director's gestures", () => {
  const TODAY = "2026-11-17";
  const zones = (limit: string) => ZONES.map((name, i) => ({ id: `z${i}`, name, description: name === "In progress" ? limit : `${name} here` }));
  const site = (o: Partial<PracticeSnapshot> = {}, limit = "Being laid. Limit: 2.") =>
    team({ board: { ...team().board!, statusOptionIds: zones(limit) }, ...o });
  const visit = { id: "MI_1", number: 1, title: "FICTIF Visit", dueOn: "2026-12-01T00:00:00Z", url: "m", closed: false, openIssues: 0, closedIssues: 2 };

  it("posts the evening bulletin", () => {
    expect(prepareBulletin(site(), "AT_RISK", " FICTIF Sprint 1: 2 of 3 points. ").mutations).toEqual([
      { name: "createProjectV2StatusUpdate", input: { projectId: "PVT_team", status: "AT_RISK", body: "FICTIF Sprint 1: 2 of 3 points." } },
    ]);
  });
  it("refuses a bulletin without words or with an unknown status", () => {
    expect(() => prepareBulletin(site(), "ON_TRACK", "  ")).toThrow(GestureError);
    expect(() => prepareBulletin(site(), "SUNNY", "words")).toThrow(GestureError);
  });
  it("writes the limit and keeps every option's id", () => {
    const p = prepareWipLimit(site({}, "Being laid"), 3);
    const options = p.mutations[0].input.singleSelectOptions as { id: string; name: string; description: string; color: string }[];
    expect(p.mutations[0]).toMatchObject({ name: "updateProjectV2Field", input: { fieldId: "F_status" } });
    expect(options.map((o) => o.id)).toEqual(["z0", "z1", "z2", "z3", "z4"]);
    expect(options.find((o) => o.name === "In progress")?.description).toBe("Being laid. Limit: 3.");
    expect(options.find((o) => o.name === "Backlog")?.description).toBe("Backlog here");
    expect(options.every((o) => o.color)).toBe(true);
    for (const bad of [0, 11, 2.5]) expect(() => prepareWipLimit(site(), bad), String(bad)).toThrow(GestureError);
  });
  it("the team's day pushes \"Being laid\" two over its limit", () => {
    const t = site({ issues: [issue(1, { status: "In progress" }), issue(2), issue(3, { subIssues: [7, 8] }), issue(4, { closed: true }), issue(5), issue(6), issue(7)] });
    const p = prepareTeamDay(t);
    expect(p.mutations).toEqual([2, 5, 6].map((n) => ({ name: "updateProjectV2ItemFieldValue", input: {
      projectId: "PVT_team", itemId: `PVTI_${n}`, fieldId: "F_status", value: { singleSelectOptionId: "z2" },
    } })));
    expect(() => prepareTeamDay(site({ issues: [issue(1), issue(2)] }))).toThrow(/open jobs/);
    expect(() => prepareTeamDay(site({ issues: [issue(1)] }, "Being laid"))).toThrow(/limit/);
    expect(() => prepareTeamDay(site({ issues: [1, 2, 3, 4].map((n) => issue(n, { status: "In progress" })) }))).toThrow(GestureError);
  });
  it("finishes a job: closed as completed, laid in Done", () => {
    expect(prepareFinish(site({ issues: [issue(2)] }), 2).mutations).toEqual([
      { name: "closeIssue", input: { issueId: "I_2", stateReason: "COMPLETED" } },
      { name: "updateProjectV2ItemFieldValue", input: { projectId: "PVT_team", itemId: "PVTI_2", fieldId: "F_status", value: { singleSelectOptionId: "z4" } } },
    ]);
    expect(() => prepareFinish(site({ issues: [issue(2, { closed: true })] }), 2)).toThrow(GestureError);
  });
  it("refuses to close a visit with jobs still open", () => {
    const t = site({ milestones: [{ ...visit, openIssues: 1 }], issues: [issue(2, { milestone: 1 }), issue(4, { milestone: 1, closed: true })] });
    expect(() => prepareCloseVisit(t, 1)).toThrow(/#2/);
    expect(prepareCloseVisit(site({ milestones: [visit] }), 1).mutations).toEqual([{ name: "updateMilestone", input: { number: 1, state: "closed" } }]);
    expect(() => prepareCloseVisit(site({ milestones: [{ ...visit, closedIssues: 0 }] }), 1)).toThrow(GestureError);
  });
  it("moves the visit to a later day only", () => {
    const t = site({ milestones: [visit] });
    expect(prepareMoveVisit(t, 1, "2026-12-08", TODAY).mutations).toEqual([{ name: "updateMilestone", input: { number: 1, due_on: "2026-12-08T12:00:00Z" } }]);
    for (const due of ["2026-12-01", "2026-11-30", "2026-11-16", "8/12/2026"]) expect(() => prepareMoveVisit(t, 1, due, TODAY), due).toThrow(GestureError);
  });
});
