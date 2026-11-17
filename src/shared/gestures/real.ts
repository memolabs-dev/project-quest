// On the real project the player only asks: one comment on an open issue marked for newcomers. The game never
// assigns, labels or closes anything there; a maintainer decides.
import type { RealSnapshot } from "../levels/types.ts";
import { GestureError } from "./move.ts";
import type { PracticeMutation } from "./practice.ts";

export interface PreparedAsk { kind: "ask"; repo: string; issueNumber: number; title: string; comment: string; mutations: PracticeMutation[] }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function prepareAsk(real: RealSnapshot, viewer: string, issueNumber: number, comment: string): PreparedAsk {
  const issue = real.issues.find((i) => i.number === issueNumber);
  if (!issue) throw new GestureError(`Issue #${issueNumber} is not an open good first issue of ${real.repo}`);
  if (issue.assignees.some((a) => !same(a, viewer))) {
    throw new GestureError(`Issue #${issueNumber} is already someone's: nobody is taken from`);
  }
  const body = comment.trim();
  if (!body) throw new GestureError("Say it in a comment: it cannot be empty");
  return {
    kind: "ask", repo: real.repo, issueNumber, title: issue.title, comment: body,
    mutations: [{ name: "addComment", input: { subjectId: issue.id, body } }],
  };
}
