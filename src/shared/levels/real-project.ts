// The last step: a real project. The player asks for a newcomer's issue; a maintainer decides. Nobody is assigned by the game.
import type { Check, Level } from "./types.ts";

const NOT_YET: Check = { done: false, proof: null };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const REAL_PROJECT: Level[] = [{
  id: "a16-ask-good-first",
  rank: "real-project",
  where: "practice",
  check: (o) => {
    for (const issue of o.real?.issues ?? []) {
      const asked = issue.comments.find((c) => same(c.author, o.viewer));
      if (asked) return { done: true, proof: asked.url };
    }
    return NOT_YET;
  },
}];
