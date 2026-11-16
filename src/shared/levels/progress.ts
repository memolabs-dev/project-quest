// Where a player stands: the next level, the rank reached, what is unlocked. Pure, from the set of stamped levels.
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

export function unlocks(stamped: ReadonlySet<string>): { helmet: boolean; skillBook: boolean; ownSite: boolean } {
  const started = stamped.has("a1-walk");
  return { helmet: started, skillBook: started, ownSite: stamped.has("a4-found-site") };
}
