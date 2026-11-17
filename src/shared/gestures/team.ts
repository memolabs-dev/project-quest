// The lead's gestures on their team site (lead's path spec). Each prepare builds exactly what the confirmation shows;
// the server rebuilds it from a fresh read before sending. Ids a mutation only learns from the one before it are shown
// as "$repositoryId", "$projectId", "$statusFieldId" or "$issueId" and filled in when sent.
import { PARCELS, SIZES, ZONES, parcelBody, parcelOf } from "../levels/parcels.ts";
import type { PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import type { PracticeMutation } from "./practice.ts";

export type TeamKind = "team-found" | "parcels" | "label" | "duplicate" | "checklist" | "size";
/** The inputs the player gave: what the server rebuilds the gesture from. */
export type TeamArgs = { visibility?: "PUBLIC" | "PRIVATE"; issueNumber?: number; label?: string; original?: number; items?: string[]; size?: string };
export interface PreparedTeam { kind: TeamKind; repo: string; args: TeamArgs; mutations: PracticeMutation[] }

const ZONE_LOOK: Record<(typeof ZONES)[number], { color: string; description: string }> = {
  Backlog: { color: "GRAY", description: "The stock: everything that came in" },
  Ready: { color: "BLUE", description: "Ready to lay: checked by the inspection" },
  "In progress": { color: "YELLOW", description: "Being laid" },
  "In review": { color: "PURPLE", description: "The inspection" },
  Done: { color: "GREEN", description: "Laid" },
};
const SIZE_LOOK = ["GRAY", "BLUE", "GREEN", "YELLOW", "RED"];

const issueOf = (team: PracticeSnapshot, number: number) => {
  const i = team.issues.find((x) => x.number === number);
  if (!i) throw new GestureError(`Issue #${number} is not on your team site`);
  return i;
};

export function prepareFoundTeam(
  viewer: { login: string; id: string }, existing: PracticeSnapshot | null, name: string, visibility: "PUBLIC" | "PRIVATE",
): PreparedTeam {
  if (existing && existing.repo.nameWithOwner.toLowerCase() !== `${viewer.login}/${name}`.toLowerCase()) {
    throw new GestureError(`${viewer.login}/${name} now leads to ${existing.repo.nameWithOwner}: the game founds only in your own account`);
  }
  const board = existing?.board ?? null;
  const mutations: PracticeMutation[] = [];
  if (!existing) {
    mutations.push({ name: "createRepository", input: { name, visibility, hasIssuesEnabled: true, description: "My team site (project-quest)" } });
  }
  if (!board) {
    mutations.push({ name: "createProjectV2", input: { ownerId: viewer.id, title: name, repositoryId: existing?.repo.id ?? "$repositoryId" } });
  }
  if (JSON.stringify(board?.statusOptions ?? []) !== JSON.stringify(ZONES)) {
    // Rewriting the options clears every item whose option is not kept (by id): never drop a column in use.
    const dropped = (board?.statusOptions ?? []).filter((o) => !(ZONES as readonly string[]).includes(o));
    const inUse = dropped.filter((o) => (existing?.issues ?? []).some((i) => i.status === o));
    if (inUse.length > 0) {
      throw new GestureError(`Some issues are still in ${inUse.join(", ")}: move them to one of the five zones first, or they would lose their column`);
    }
    const ids = new Map((board?.statusOptionIds ?? []).map((o) => [o.name, o.id]));
    mutations.push({ name: "updateProjectV2Field", input: {
      fieldId: board?.statusFieldId || "$statusFieldId",
      singleSelectOptions: ZONES.map((z) => ({ ...(ids.has(z) ? { id: ids.get(z) } : {}), name: z, ...ZONE_LOOK[z] })),
    } });
  }
  if (!board?.fields?.some((f) => f.name === "Size")) {
    mutations.push({ name: "createProjectV2Field", input: {
      projectId: board?.id ?? "$projectId", name: "Size", dataType: "SINGLE_SELECT",
      singleSelectOptions: SIZES.map((s, i) => ({ name: s, color: SIZE_LOOK[i], description: `Size ${s}` })),
    } });
  }
  if (mutations.length === 0) throw new GestureError("Your team site is already founded");
  return { kind: "team-found", repo: `${viewer.login}/${name}`, args: { visibility }, mutations };
}

/** A batch that stopped half-way is completed: only the missing parcels are written, only the loose ones put on the board. */
export function prepareParcels(team: PracticeSnapshot): PreparedTeam {
  const board = team.board;
  if (!board) throw new GestureError("Found your team site first: it has no board yet");
  const arrived = new Map(team.issues.flatMap((i) => { const p = parcelOf(i.body); return p ? [[p.key, i] as const] : []; }));
  const loose = [...arrived.values()].filter((i) => !i.itemId).map((i): PracticeMutation => (
    { name: "addProjectV2ItemById", input: { projectId: board.id, contentId: i.id } }
  ));
  const missing = PARCELS.filter((p) => !arrived.has(p.key)).flatMap((p): PracticeMutation[] => [
    { name: "createIssue", input: { repositoryId: team.repo.id, title: p.title, body: parcelBody(p) } },
    { name: "addProjectV2ItemById", input: { projectId: board.id, contentId: "$issueId" } },
  ]);
  const mutations = [...loose, ...missing];
  if (mutations.length === 0) throw new GestureError("The mayor's parcels have already arrived");
  return { kind: "parcels", repo: team.repo.nameWithOwner, args: {}, mutations };
}

export function prepareLabel(team: PracticeSnapshot, issueNumber: number, label: string): PreparedTeam {
  const i = issueOf(team, issueNumber);
  const l = (team.labels ?? []).find((x) => x.name === label);
  if (!l) throw new GestureError(`Your team site has no label "${label}"`);
  return {
    kind: "label", repo: team.repo.nameWithOwner, args: { issueNumber, label },
    mutations: [{ name: "addLabelsToLabelable", input: { labelableId: i.id, labelIds: [l.id] } }],
  };
}

export function prepareCloseDuplicate(team: PracticeSnapshot, issueNumber: number, originalNumber: number): PreparedTeam {
  if (issueNumber === originalNumber) throw new GestureError("An issue cannot be a duplicate of itself");
  const i = issueOf(team, issueNumber);
  const original = issueOf(team, originalNumber);
  if (i.closed) throw new GestureError(`Issue #${issueNumber} is already closed`);
  return {
    kind: "duplicate", repo: team.repo.nameWithOwner, args: { issueNumber, original: originalNumber },
    mutations: [{ name: "closeIssue", input: { issueId: i.id, stateReason: "DUPLICATE", duplicateIssueId: original.id } }],
  };
}

export function prepareChecklist(team: PracticeSnapshot, issueNumber: number, items: string[]): PreparedTeam {
  const i = issueOf(team, issueNumber);
  const lines = items.map((x) => x.trim()).filter(Boolean);
  if (lines.length === 0) throw new GestureError("A Definition of Ready needs at least one line");
  const body = `${(i.body ?? "").trimEnd()}\n\n## Definition of Ready\n${lines.map((x) => `- [ ] ${x}`).join("\n")}`;
  return {
    kind: "checklist", repo: team.repo.nameWithOwner, args: { issueNumber, items },
    mutations: [{ name: "updateIssue", input: { id: i.id, body } }],
  };
}

export function prepareSize(team: PracticeSnapshot, issueNumber: number, size: string): PreparedTeam {
  const i = issueOf(team, issueNumber);
  const field = team.board?.fields?.find((f) => f.name === "Size");
  const option = field?.options?.find((o) => o.name === size);
  if (!team.board || !field || !option) throw new GestureError(`Your board has no size "${size}"`);
  if (!i.itemId) throw new GestureError(`Issue #${issueNumber} is not on your board`);
  return {
    kind: "size", repo: team.repo.nameWithOwner, args: { issueNumber, size },
    mutations: [{ name: "updateProjectV2ItemFieldValue", input: {
      projectId: team.board.id, itemId: i.itemId, fieldId: field.id, value: { singleSelectOptionId: option.id },
    } }],
  };
}

/** The server's own copy of a lead's gesture, from the player's inputs and a fresh read of the team site. */
export function rebuildTeam(
  kind: TeamKind, args: TeamArgs, viewer: { login: string; id: string }, name: string, team: PracticeSnapshot | null,
): PreparedTeam {
  if (kind === "team-found") return prepareFoundTeam(viewer, team, name, args.visibility ?? "PRIVATE");
  if (!team) throw new GestureError("Found your team site first");
  const n = args.issueNumber ?? NaN;
  switch (kind) {
    case "parcels": return prepareParcels(team);
    case "label": return prepareLabel(team, n, args.label ?? "");
    case "duplicate": return prepareCloseDuplicate(team, n, args.original ?? NaN);
    case "checklist": return prepareChecklist(team, n, args.items ?? []);
    case "size": return prepareSize(team, n, args.size ?? "");
  }
}
