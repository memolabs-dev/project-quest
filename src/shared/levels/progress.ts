// Where a player stands: the next level, the rank reached, what is unlocked. Pure, from the set of stamped levels.
import { APPRENTICE } from "./apprentice.ts";
import { JOURNEYMAN } from "./journeyman.ts";
import type { Level, Rank } from "./types.ts";

export function currentLevel(levels: Level[], stamped: ReadonlySet<string>): Level | null {
  return levels.find((l) => !stamped.has(l.id)) ?? null;
}

/** The highest rank whose levels are all stamped. */
export function rankReached(levels: Level[], stamped: ReadonlySet<string>): Rank | null {
  let reached: Rank | null = null;
  for (const rank of new Set(levels.map((l) => l.rank))) {
    if (!levels.filter((l) => l.rank === rank).every((l) => stamped.has(l.id))) break;
    reached = rank;
  }
  return reached;
}


export function unlocks(stamped: ReadonlySet<string>) {
  const started = stamped.has("a1-walk");
  return {
    helmet: started,
    skillBook: started,
    ownSite: stamped.has("a4-found-site"),
    /** File editing in the game, the Journeyman's tool: earned with the Apprentice rank. */
    trowel: APPRENTICE.every((l) => stamped.has(l.id)),
    firstBuilding: stamped.has("a11-merge"),
    /** git on the player's machine, the Team leader's tool: earned with the Journeyman rank. */
    van: [...APPRENTICE, ...JOURNEYMAN].every((l) => stamped.has(l.id)),
    realProjects: stamped.has("a15-clean-up"),
  };
}
