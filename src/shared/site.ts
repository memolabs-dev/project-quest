// From a Projects board to a building site: zones, buildings, pallets, workers. Pure functions.
import type { QuestConfig } from "./config.ts";

export interface BoardItem {
  itemId: string;
  issueId: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  status: string | null;
  size: string | null;
  parent: number | null;
  isEpic: boolean;
  labels: string[];
  assignees: { login: string; avatarUrl: string }[];
  updatedAt: string;
}

export interface BoardSnapshot {
  fetchedAt: string;
  projectId: string;
  statusFieldId: string;
  statusOptions: { id: string; name: string }[];
  items: BoardItem[];
}

export interface Zone { name: string; index: number }
export interface Building { epicNumber: number | null; title: string; floorsDone: number; floorsTotal: number }
export interface Pallet {
  number: number;
  itemId: string;
  title: string;
  url: string;
  zone: string;
  /** Closed issues stand in the last zone and cannot be moved until reopened. */
  closed: boolean;
  building: number | null;
  isBug: boolean;
  trade: string | null;
  size: string | null;
}
export interface Worker { login: string; avatarUrl: string; carrying: number[] }
export interface Site { zones: Zone[]; buildings: Building[]; pallets: Pallet[]; workers: Worker[] }

export class SiteError extends Error {}

export function buildSite(board: BoardSnapshot, config: QuestConfig): Site {
  const zones = config.zones.map((name, index) => ({ name, index }));
  const lastZone = config.zones[config.zones.length - 1];
  const byNumber = new Map(board.items.map((i) => [i.number, i]));
  const epicOf = (i: BoardItem): BoardItem | null => {
    let cur: BoardItem | undefined = i;
    for (let guard = 0; cur?.parent != null && guard < 20; guard++) {
      cur = byNumber.get(cur.parent);
      if (cur?.isEpic) return cur;
    }
    return null;
  };

  const tasks = board.items.filter((i) => !i.isEpic);
  const pallets: Pallet[] = tasks.map((i) => {
    const zone = i.state === "CLOSED" ? lastZone : i.status ?? config.zones[0];
    if (!config.zones.includes(zone)) {
      throw new SiteError(`Issue #${i.number} is in the board column "${zone}", which quest.config.json does not list in "zones"`);
    }
    const trade = i.labels.map((l) => config.labels.trades[l]).find(Boolean) ?? null;
    return {
      number: i.number, itemId: i.itemId, title: i.title, url: i.url, zone, closed: i.state === "CLOSED", building: epicOf(i)?.number ?? null,
      isBug: i.labels.some((l) => config.labels.bug.includes(l)), trade, size: i.size,
    };
  });

  const buildings: Building[] = [];
  const floorsOf = (epic: number | null) => {
    const own = pallets.filter((p) => p.building === epic);
    return { floorsDone: own.filter((p) => p.zone === lastZone).length, floorsTotal: own.length };
  };
  for (const e of board.items.filter((i) => i.isEpic)) buildings.push({ epicNumber: e.number, title: e.title, ...floorsOf(e.number) });
  if (pallets.some((p) => p.building === null)) buildings.push({ epicNumber: null, title: "", ...floorsOf(null) });

  const workers = new Map<string, Worker>();
  for (const i of tasks) for (const a of i.assignees) {
    const w = workers.get(a.login) ?? { login: a.login, avatarUrl: a.avatarUrl, carrying: [] };
    w.carrying.push(i.number);
    workers.set(a.login, w);
  }
  return { zones, buildings, pallets, workers: [...workers.values()] };
}
