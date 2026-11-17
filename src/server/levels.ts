// Where the viewer stands in the levels: the server observes (tutorial events, the practice site on GitHub),
// the levels' checks decide, and each passing level is stamped with its proof. Never another player's progress.
import type { LevelsView } from "../shared/api.ts";
import { LEVELS } from "../shared/levels/index.ts";
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
  for (const level of LEVELS) {
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
    login,
    canWrite: deps.mode === "live",
    stamps,
    current: currentLevel(LEVELS, done)?.id ?? null,
    rank: rankReached(LEVELS, done),
    unlocks: unlocks(done),
    practice: { name: await practiceNameOf(deps, login), exists: practice !== null, ...forGestures(practice, login) },
  };
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** What the Journeyman's dialogs need from the practice site. */
function forGestures(practice: PracticeSnapshot | null, login: string) {
  const issue = practice?.issues
    .filter((i) => !i.closed && i.assignees.some((a) => same(a, login)))
    .sort((a, b) => a.number - b.number)[0];
  const pull = practice?.pulls.find((p) => p.state === "OPEN" && same(p.author, login) && p.closes.length > 0);
  // The trowel starts from the file as it stands on the issue's branch, so the inspector's fix keeps the first edit.
  const branch = issue ? practice?.branches.find((b) => b.name === `practice-${issue.number}`) : undefined;
  const unassigned = practice?.issues.filter((i) => !i.closed && i.assignees.length === 0).sort((a, b) => a.number - b.number)[0];
  const main = practice?.defaultBranch ?? null;
  const work = practice?.branches.find((b) =>
    b.name !== main?.name && !/^practice-\d+$/.test(b.name) && !b.viaWeb && same(b.author, login));
  const inMain = new Set(practice?.mainHistory ?? []);
  const firstOwn = work?.history.filter((h) => !h.viaWeb && !inMain.has(h.oid)).map((h) => h.committedDate).sort()[0];
  return {
    readme: branch?.readme ?? practice?.readme ?? null,
    issue: issue?.number ?? null,
    pull: pull?.number ?? null,
    unassigned: unassigned?.number ?? null,
    defaultBranch: main?.name ?? null,
    workBranch: work?.name ?? null,
    mainMoved: Boolean(main && firstOwn && main.committedDate > firstOwn),
  };
}
