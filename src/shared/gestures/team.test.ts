import { describe, expect, it } from "vitest";
import { PARCELS, SIZES, ZONES, parcelBody } from "../levels/parcels.ts";
import type { PracticeIssue, PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import {
  prepareChecklist, prepareCloseDuplicate, prepareFoundTeam, prepareLabel, prepareParcels, prepareSize,
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
  it("refuses the parcels twice", () => {
    expect(() => prepareParcels(team({ issues: [issue(1, { body: parcelBody(PARCELS[0]) })] }))).toThrow(GestureError);
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
