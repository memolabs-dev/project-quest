// The lead's gestures on their team site (lead's path spec). Each prepare builds exactly what the confirmation shows;
// the server rebuilds it from a fresh read before sending. Ids a mutation only learns from the one before it are shown
// as "$repositoryId", "$projectId", "$statusFieldId" or "$issueId" and filled in when sent.
import { PARCELS, SIZES, ZONES, parcelBody, parcelOf } from "../levels/parcels.ts";
import type { PracticeSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import type { PracticeMutation } from "./practice.ts";

export type TeamKind = "team-found" | "parcels" | "label" | "duplicate" | "checklist" | "size";
export interface PreparedTeam { kind: TeamKind; repo: string; summary: Record<string, string | number>; mutations: PracticeMutation[] }

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
    mutations.push({ name: "updateProjectV2Field", input: {
      fieldId: board?.statusFieldId ?? "$statusFieldId",
      singleSelectOptions: ZONES.map((z) => ({ name: z, ...ZONE_LOOK[z] })),
    } });
  }
  if (!board?.fields?.some((f) => f.name === "Size")) {
    mutations.push({ name: "createProjectV2Field", input: {
      projectId: board?.id ?? "$projectId", name: "Size", dataType: "SINGLE_SELECT",
      singleSelectOptions: SIZES.map((s, i) => ({ name: s, color: SIZE_LOOK[i], description: `Size ${s}` })),
    } });
  }
  if (mutations.length === 0) throw new GestureError("Your team site is already founded");
  return { kind: "team-found", repo: `${viewer.login}/${name}`, summary: { name, visibility }, mutations };
}

export function prepareParcels(team: PracticeSnapshot): PreparedTeam {
  if (!team.board) throw new GestureError("Found your team site first: it has no board yet");
  if (team.issues.some((i) => parcelOf(i.body))) throw new GestureError("The mayor's parcels have already arrived");
  const mutations = PARCELS.flatMap((p): PracticeMutation[] => [
    { name: "createIssue", input: { repositoryId: team.repo.id, title: p.title, body: parcelBody(p) } },
    { name: "addProjectV2ItemById", input: { projectId: team.board!.id, contentId: "$issueId" } },
  ]);
  return { kind: "parcels", repo: team.repo.nameWithOwner, summary: { count: PARCELS.length }, mutations };
}

export function prepareLabel(team: PracticeSnapshot, issueNumber: number, label: string): PreparedTeam {
  const i = issueOf(team, issueNumber);
  const l = (team.labels ?? []).find((x) => x.name === label);
  if (!l) throw new GestureError(`Your team site has no label "${label}"`);
  return {
    kind: "label", repo: team.repo.nameWithOwner, summary: { number: issueNumber, label },
    mutations: [{ name: "addLabelsToLabelable", input: { labelableId: i.id, labelIds: [l.id] } }],
  };
}

export function prepareCloseDuplicate(team: PracticeSnapshot, issueNumber: number, originalNumber: number): PreparedTeam {
  if (issueNumber === originalNumber) throw new GestureError("An issue cannot be a duplicate of itself");
  const i = issueOf(team, issueNumber);
  const original = issueOf(team, originalNumber);
  if (i.closed) throw new GestureError(`Issue #${issueNumber} is already closed`);
  return {
    kind: "duplicate", repo: team.repo.nameWithOwner, summary: { number: issueNumber, original: originalNumber },
    mutations: [{ name: "closeIssue", input: { issueId: i.id, stateReason: "DUPLICATE", duplicateIssueId: original.id } }],
  };
}

export function prepareChecklist(team: PracticeSnapshot, issueNumber: number, items: string[]): PreparedTeam {
  const i = issueOf(team, issueNumber);
  const lines = items.map((x) => x.trim()).filter(Boolean);
  if (lines.length === 0) throw new GestureError("A Definition of Ready needs at least one line");
  const body = `${(i.body ?? "").trimEnd()}\n\n## Definition of Ready\n${lines.map((x) => `- [ ] ${x}`).join("\n")}`;
  return {
    kind: "checklist", repo: team.repo.nameWithOwner, summary: { number: issueNumber, lines: lines.length },
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
    kind: "size", repo: team.repo.nameWithOwner, summary: { number: issueNumber, size },
    mutations: [{ name: "updateProjectV2ItemFieldValue", input: {
      projectId: team.board.id, itemId: i.itemId, fieldId: field.id, value: { singleSelectOptionId: option.id },
    } }],
  };
}
