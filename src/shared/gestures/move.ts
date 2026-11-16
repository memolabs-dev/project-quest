// The "push a pallet to another zone" gesture. prepareMove builds exactly what will be sent to GitHub;
// the confirmation screen shows this object, and the server sends `mutation.input` unchanged.
import type { BoardSnapshot } from "../site.ts";

export interface PreparedMove {
  kind: "move";
  itemId: string;
  issueNumber: number;
  issueTitle: string;
  from: string;
  to: string;
  fieldId: string;
  optionId: string;
  expectedUpdatedAt: string;
  mutation: { name: "updateProjectV2ItemFieldValue"; input: Record<string, unknown> };
}

export class GestureError extends Error {}

export function prepareMove(board: BoardSnapshot, itemId: string, toZone: string): PreparedMove {
  const item = board.items.find((i) => i.itemId === itemId);
  if (!item) throw new GestureError(`Item ${itemId} is not on the board`);
  const option = board.statusOptions.find((o) => o.name === toZone);
  if (!option) throw new GestureError(`The board has no column "${toZone}"`);
  const from = item.status ?? "";
  if (from === toZone) throw new GestureError(`Issue #${item.number} is already in "${toZone}"`);
  return {
    kind: "move", itemId, issueNumber: item.number, issueTitle: item.title, from, to: toZone,
    fieldId: board.statusFieldId, optionId: option.id, expectedUpdatedAt: item.updatedAt,
    mutation: {
      name: "updateProjectV2ItemFieldValue",
      input: { projectId: board.projectId, itemId, fieldId: board.statusFieldId, value: { singleSelectOptionId: option.id } },
    },
  };
}
