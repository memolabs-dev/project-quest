import { describe, expect, it } from "vitest";
import type { QuestConfig } from "./config.ts";
import { SiteError, buildSite, type BoardItem, type BoardSnapshot } from "./site.ts";

const config: QuestConfig = {
  owner: "fictif-org",
  repo: "fictif-repo",
  projectNumber: 1,
  fields: { status: "Status", iteration: "Sprint", size: "Size" },
  zones: ["Backlog", "Ready", "In progress", "In review", "Done"],
  labels: { bug: ["bug"], trades: { back: "mason", front: "painter" }, goodFirst: ["good first issue"] },
};

let n = 0;
const item = (extra: Partial<BoardItem> = {}): BoardItem => {
  n += 1;
  return {
    itemId: `PVTI_${n}`, issueId: `I_${n}`, number: n, title: `FICTIF ${n}`, url: `https://example.org/${n}`,
    state: "OPEN", status: "Backlog", size: null, parent: null, isEpic: false, labels: [], assignees: [],
    updatedAt: "2026-11-16T10:00:00Z", ...extra,
  };
};
const board = (items: BoardItem[]): BoardSnapshot => ({
  fetchedAt: "2026-11-16T12:00:00Z", projectId: "PVT_1", statusFieldId: "PVTSSF_1",
  statusOptions: config.zones.map((name, i) => ({ id: `opt${i}`, name })), items,
});

describe("buildSite", () => {
  it("marks a pallet for newcomers from the configured good first labels", () => {
    const site = buildSite(board([item({ labels: ["good first issue"] }), item({ number: 2, labels: ["bug"] })]), config);
    expect(site.pallets.map((p) => p.goodFirst)).toEqual([true, false]);
  });

  it("groups pallets by zone in config order", () => {
    const site = buildSite(board([item({ status: "Ready" }), item({ status: "Backlog" })]), config);
    expect(site.zones.map((z) => z.name)).toEqual(config.zones);
    expect(site.pallets.map((p) => p.zone).sort()).toEqual(["Backlog", "Ready"]);
  });

  it("puts a closed issue in the last zone even if the board says otherwise, and marks it closed", () => {
    const site = buildSite(board([item({ state: "CLOSED", status: "Ready" })]), config);
    expect(site.pallets[0]).toMatchObject({ zone: "Done", closed: true });
  });

  it("makes an epic a building and its sub-issues its floors", () => {
    const epic = item({ isEpic: true });
    const site = buildSite(board([epic, item({ parent: epic.number, state: "CLOSED" }), item({ parent: epic.number })]), config);
    const building = site.buildings.find((b) => b.epicNumber === epic.number)!;
    expect(building).toMatchObject({ title: epic.title, floorsDone: 1, floorsTotal: 2 });
    expect(site.pallets.some((p) => p.number === epic.number)).toBe(false);
  });

  it("a duplicate or a parcel not planned is no floor, done or to do", () => {
    const epic = item({ isEpic: true });
    const site = buildSite(board([
      epic,
      item({ parent: epic.number, state: "CLOSED", stateReason: "COMPLETED" }),
      item({ parent: epic.number, state: "CLOSED", stateReason: "DUPLICATE" }),
      item({ parent: epic.number, state: "CLOSED", stateReason: "NOT_PLANNED" }),
      item({ parent: epic.number }),
    ]), config);
    expect(site.buildings.find((b) => b.epicNumber === epic.number)).toMatchObject({ floorsDone: 1, floorsTotal: 2 });
    expect(site.pallets.filter((p) => p.discarded).map((p) => p.number)).toHaveLength(2);
  });

  it("puts issues without a parent epic in the unassigned building", () => {
    const loose = item();
    const site = buildSite(board([loose]), config);
    const unassigned = site.buildings.find((b) => b.epicNumber === null)!;
    expect(unassigned.floorsTotal).toBe(1);
    expect(site.pallets[0].building).toBeNull();
  });

  it("gives an empty but valid site for an empty board", () => {
    const site = buildSite(board([]), config);
    expect(site).toEqual({ zones: config.zones.map((name, index) => ({ name, index })), buildings: [], pallets: [], workers: [] });
  });

  it("refuses an unknown status option, naming it", () => {
    expect(() => buildSite(board([item({ status: "Triage" })]), config)).toThrow(SiteError);
    expect(() => buildSite(board([item({ status: "Triage" })]), config)).toThrow(/Triage/);
  });

  it("marks bugs and trades from labels", () => {
    const site = buildSite(board([item({ labels: ["bug", "back"] })]), config);
    expect(site.pallets[0]).toMatchObject({ isBug: true, trade: "mason" });
  });

  it("keeps the issue's GitHub address on the pallet", () => {
    const i = item();
    expect(buildSite(board([i]), config).pallets[0].url).toBe(i.url);
  });

  it("gives workers the pallets assigned to them", () => {
    const a = item({ assignees: [{ login: "fictif-user-1", avatarUrl: "https://example.org/a.png" }] });
    const site = buildSite(board([a]), config);
    expect(site.workers).toEqual([{ login: "fictif-user-1", avatarUrl: "https://example.org/a.png", carrying: [a.number] }]);
  });
});
