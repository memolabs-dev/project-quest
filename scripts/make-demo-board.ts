// Builds the demo board: an invented site to play without a GitHub account.
// Run: npx tsx scripts/make-demo-board.ts
import { writeFileSync } from "node:fs";
import type { BoardItem, BoardSnapshot } from "../src/shared/site.ts";

const zones = ["Backlog", "Ready", "In progress", "In review", "Done"];
const worker = { login: "fictif-maria", avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4" };
let n = 0;
const items: BoardItem[] = [];
const add = (title: string, extra: Partial<BoardItem> = {}) => {
  n += 1;
  const it: BoardItem = {
    itemId: `PVTI_demo_${n}`, issueId: `I_demo_${n}`, number: n, title: `FICTIF ${title}`,
    url: `https://github.com/fictif-org/demo-site/issues/${n}`, state: "OPEN", status: "Backlog", size: "S",
    parent: null, isEpic: false, labels: [], assignees: [], updatedAt: "2026-11-16T09:00:00Z", ...extra,
  };
  items.push(it);
  return it;
};

const town = add("Town hall", { isEpic: true, size: null });
const library = add("Library", { isEpic: true, size: null });
const station = add("Train station", { isEpic: true, size: null });

const plan: [BoardItem, string, string, Partial<BoardItem>?][] = [
  [town, "Pour the foundations", "Done", { labels: ["back"], state: "CLOSED" }],
  [town, "Raise the walls", "Done", { labels: ["back"], state: "CLOSED" }],
  [town, "Paint the facade", "In progress", { labels: ["front"], assignees: [worker] }],
  [town, "Hang the clock", "Ready", { labels: ["design"] }],
  [town, "Termites in the attic", "In review", { labels: ["bug", "back"] }],
  [town, "Lay the square's paving", "Backlog", { size: "M" }],
  [library, "Measure the plot", "Done", { labels: ["data"], state: "CLOSED" }],
  [library, "Draw the reading room", "In review", { labels: ["design"] }],
  [library, "Build the shelves", "Ready", { labels: ["back"], size: "M" }],
  [library, "Light the reading room", "Backlog", { labels: ["front"] }],
  [library, "Catalogue every book", "Backlog", { labels: ["data"], size: "L" }],
  [library, "Squeaky door on the first floor", "In progress", { labels: ["bug"], assignees: [worker] }],
  [station, "Survey the tracks", "Done", { labels: ["data"], state: "CLOSED" }],
  [station, "Build the platform", "In progress", { labels: ["back"], size: "L" }],
  [station, "Timetable board", "Ready", { labels: ["front"] }],
  [station, "Waiting room benches", "Backlog", { labels: ["design"] }],
  [station, "Ticket office", "Backlog", { labels: ["back"] }],
];
for (const [epic, title, status, extra] of plan) add(title, { parent: epic.number, status, ...extra });

add("The mayor's small idea: a fountain", { status: "Backlog" });
add(
  "A pallet with a very long name to check that nothing overflows: https://example.org/a-very-long-unbreakable-address-for-a-delivery-note-that-never-ends and العربية too 🏗️",
  { status: "Ready" },
);

const board: BoardSnapshot = {
  fetchedAt: "2026-11-16T12:00:00Z", projectId: "PVT_demo", statusFieldId: "PVTSSF_demo",
  statusOptions: zones.map((name, i) => ({ id: `opt_${i}`, name })), items,
};
writeFileSync(new URL("../src/shared/demo/demo-board.json", import.meta.url), `${JSON.stringify(board, null, 1)}\n`);
console.log(`demo board: ${items.length} items`);
