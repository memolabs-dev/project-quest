// Where the viewer stands in the levels: the server observes (tutorial events, the practice site on GitHub),
// the levels' checks decide, and each passing level is stamped with its proof. Never another player's progress.
import type { LevelsView } from "../shared/api.ts";
import { APPRENTICE } from "../shared/levels/apprentice.ts";
import { currentLevel, rankReached, unlocks } from "../shared/levels/progress.ts";
import type { Observed, PracticeSnapshot } from "../shared/levels/types.ts";
import type { Deps } from "./deps.ts";

export const practiceNameOf = async (deps: Deps, login: string) => (await deps.progress.practiceRepo(login)) ?? deps.practiceName;

export async function observe(deps: Deps, login: string): Promise<Observed> {
  const [events, practice] = await Promise.all([
    deps.progress.events(login),
    practiceNameOf(deps, login).then((name) => deps.readPractice(login, name)),
  ]);
  return { viewer: login, events, practice };
}

/** Runs the checks in order, stamps every newly passing level, stops at the first that does not pass. */
export async function checkLevels(deps: Deps, login: string, seen?: Observed): Promise<LevelsView> {
  const o = seen ?? (await observe(deps, login));
  const stamped = new Set((await deps.progress.stamps(login)).map((s) => s.levelId));
  for (const level of APPRENTICE) {
    if (stamped.has(level.id)) continue;
    const c = level.check(o);
    if (!c.done || !c.proof) break;
    await deps.progress.stamp(login, level.id, c.proof);
    stamped.add(level.id);
  }
  return view(deps, login, o.practice);
}

async function view(deps: Deps, login: string, practice: PracticeSnapshot | null): Promise<LevelsView> {
  const stamps = await deps.progress.stamps(login);
  const done = new Set(stamps.map((s) => s.levelId));
  return {
    stamps,
    current: currentLevel(APPRENTICE, done)?.id ?? null,
    rank: rankReached(APPRENTICE, done),
    unlocks: unlocks(done),
    practice: { name: await practiceNameOf(deps, login), exists: practice !== null },
  };
}
