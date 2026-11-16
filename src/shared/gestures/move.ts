// The "push a pallet to another zone" gesture. prepareMove builds exactly what will be sent to GitHub;
// the confirmation screen shows this object, and the server rebuilds it before sending (it never trusts the client's copy).
import type { BoardSnapshot } from "../site.ts";

export interface PreparedMove {
  kind: "move";
  itemId: string;
  issueNumber: number;
  issueTitle: string;
  /** The current column; null when the item has no status yet. */
  from: string | null;
  to: string;
  fieldId: string;
  optionId: string;
  expectedUpdatedAt: string;
  mutation: { name: "updateProjectV2ItemFieldValue"; input: Record<string, unknown> };
}

export class GestureError extends Error {}

/** `zones`, when given, limits the targets to the columns the game's config knows. */
export function prepareMove(board: BoardSnapshot, itemId: string, toZone: string, zones?: readonly string[]): PreparedMove {
  const item = board.items.find((i) => i.itemId === itemId);
  if (!item) throw new GestureError(`Item ${itemId} is not on the board`);
  if (item.state === "CLOSED") throw new GestureError(`Issue #${item.number} is closed: reopen it before moving it`);
  if (zones && !zones.includes(toZone)) throw new GestureError(`"${toZone}" is not one of the site's zones`);
  const option = board.statusOptions.find((o) => o.name === toZone);
  if (!option) throw new GestureError(`The board has no column "${toZone}"`);
  if (item.status === toZone) throw new GestureError(`Issue #${item.number} is already in "${toZone}"`);
  return {
    kind: "move", itemId, issueNumber: item.number, issueTitle: item.title, from: item.status, to: toZone,
    fieldId: board.statusFieldId, optionId: option.id, expectedUpdatedAt: item.updatedAt,
    mutation: {
      name: "updateProjectV2ItemFieldValue",
      input: { projectId: board.projectId, itemId, fieldId: board.statusFieldId, value: { singleSelectOptionId: option.id } },
    },
  };
}
