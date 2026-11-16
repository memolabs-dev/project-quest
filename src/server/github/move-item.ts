// Applies a prepared move: re-checks the item on GitHub first, sends nothing if someone moved it meanwhile.
import type { QuestConfig } from "../../shared/config.ts";
import type { PreparedMove } from "../../shared/gestures/move.ts";
import type { BoardSnapshot } from "../../shared/site.ts";
import type { Gql } from "./client.ts";
import { readBoard } from "./read-board.ts";

export type ApplyResult =
  /** board is null when the write succeeded but the board could not be re-read right after. */
  | { ok: true; board: BoardSnapshot | null }
  | { ok: false; reason: "stale"; current: { status: string | null; updatedAt: string } }
  | { ok: false; reason: "github"; message: string };

const ITEM_STATE = /* GraphQL */ `
  query ItemState($id: ID!, $statusField: String!) {
    node(id: $id) {
      ... on ProjectV2Item {
        id
        updatedAt
        status: fieldValueByName(name: $statusField) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      }
    }
  }
`;

const MOVE = /* GraphQL */ `
  mutation Move($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
    updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
      projectV2Item { id }
    }
  }
`;

const githubMessage = (e: unknown) => {
  const errors = (e as { errors?: { message: string }[] }).errors;
  return errors?.[0]?.message ?? (e instanceof Error ? e.message : String(e));
};

export async function applyMove(gql: Gql, config: QuestConfig, prepared: PreparedMove): Promise<ApplyResult> {
  const state = await gql<{ node: { updatedAt: string; status: { name: string } | null } | null }>(ITEM_STATE, {
    id: prepared.itemId, statusField: config.fields.status,
  });
  const current = { status: state.node?.status?.name ?? null, updatedAt: state.node?.updatedAt ?? "" };
  if (current.status !== prepared.from || current.updatedAt !== prepared.expectedUpdatedAt) {
    return { ok: false, reason: "stale", current };
  }
  try {
    await gql(MOVE, prepared.mutation.input);
  } catch (e) {
    return { ok: false, reason: "github", message: githubMessage(e) };
  }
  try {
    return { ok: true, board: await readBoard(gql, config) };
  } catch {
    return { ok: true, board: null };
  }
}
