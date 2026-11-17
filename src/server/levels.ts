// Where the viewer stands in the levels: the server observes (tutorial events, the practice site on GitHub),
// the levels' checks decide, and each passing level is stamped with its proof. Never another player's progress.
import type { LevelsView } from "../shared/api.ts";
import { levelsOf } from "../shared/levels/index.ts";
import { inProgress, sprintFieldOf, sprintLoad, wipLimit } from "../shared/levels/lead.ts";
import { PARCELS, parcelOf } from "../shared/levels/parcels.ts";
import { currentLevel, rankReached, unlocks } from "../shared/levels/progress.ts";
import type { Observed, Path, PracticeSnapshot, RealSnapshot } from "../shared/levels/types.ts";
import type { Deps } from "./deps.ts";

export const practiceNameOf = async (deps: Deps, login: string) => (await deps.progress.practiceRepo(login)) ?? deps.practiceName;

export const todayOf = (deps: Deps) => deps.today?.() ?? new Date().toISOString().slice(0, 10);

export async function observe(deps: Deps, login: string): Promise<Observed> {
  // The real project is read only while the last level is being played: no extra query before, nor after.
  const stamps = await deps.progress.stamps(login);
  const since = stamps.find((s) => s.levelId === "a15-clean-up")?.stampedAt ?? null;
  const ready = since !== null && !stamps.some((s) => s.levelId === "a16-ask-good-first");
  // The team site is read only for a player on the lead's path.
  const lead = (await deps.progress.path(login)) === "lead";
  const [events, practice, real, team, capacity] = await Promise.all([
    deps.progress.events(login),
    practiceNameOf(deps, login).then((name) => deps.readPractice(login, name)),
    ready ? deps.readGoodFirst() : Promise.resolve(null),
    lead ? deps.readPractice(login, deps.teamName) : Promise.resolve(null),
    lead ? deps.progress.capacity(login) : Promise.resolve(null),
  ]);
  return { viewer: login, events, practice, real, realSince: since, team, capacity, today: todayOf(deps) };
}

const PATHS: Path[] = ["volunteer", "lead"];

/** Runs the checks in order, stamps every newly passing level, stops at the first that does not pass. */
export async function checkLevels(deps: Deps, login: string, seen?: Observed): Promise<LevelsView> {
  const o = seen ?? (await observe(deps, login));
  // The team's day happened and GitHub now shows Being laid over its limit: remember it was seen (level 10).
  const limit = wipLimit(o.team);
  if (o.events.includes("team-day") && !o.events.includes("wip-over") && limit !== null && inProgress(o.team) > limit) {
    await deps.progress.addEvent(login, "wip-over");
    o.events = [...o.events, "wip-over"];
  }
  const stamped = new Set((await deps.progress.stamps(login)).map((s) => s.levelId));
  // Each path runs on its own: a level not passed on one never holds back the other.
  for (const path of PATHS) {
    for (const level of levelsOf(path)) {
      if (stamped.has(level.id)) continue;
      const c = level.check(o);
      if (!c.done || !c.proof) break;
      await deps.progress.stamp(login, level.id, c.proof);
      stamped.add(level.id);
    }
  }
  return view(deps, login, o.practice, o.real ?? null, o.team ?? null);
}

async function view(
  deps: Deps, login: string, practice: PracticeSnapshot | null, real: RealSnapshot | null, team: PracticeSnapshot | null,
): Promise<LevelsView> {
  const stamps = await deps.progress.stamps(login);
  const done = new Set(stamps.map((s) => s.levelId));
  const path = await deps.progress.path(login);
  const shown = levelsOf(path ?? "volunteer");
  const load = sprintLoad(team, todayOf(deps));
  const capacity = path === "lead" ? await deps.progress.capacity(login) : null;
  const bulletin = team?.board?.statusUpdates?.[0] ?? null;
  return {
    login,
    canWrite: deps.mode === "live",
    stamps,
    path,
    current: currentLevel(shown, done)?.id ?? null,
    rank: rankReached(shown, done),
    ranks: { volunteer: rankReached(levelsOf("volunteer"), done), lead: rankReached(levelsOf("lead"), done) },
    unlocks: unlocks(done),
    practice: { name: await practiceNameOf(deps, login), exists: practice !== null, ...forGestures(practice, login) },
    real: real ? { issues: real.issues.length } : null,
    team: {
      exists: team?.board != null,
      // All six there and on the board: a batch stopped half-way keeps the mentor's button.
      parcels: new Set((team?.issues ?? []).filter((i) => i.itemId).map((i) => parcelOf(i.body)?.key).filter(Boolean)).size === PARCELS.length,
      labels: (team?.labels ?? []).map((l) => l.name),
      sprint: {
        field: sprintFieldOf(team) !== undefined,
        current: load.iteration?.title ?? null,
        points: load.points,
        capacity,
        loaded: load.pallets.map((i) => i.number).sort((a, b) => a - b),
        unsized: load.unsized,
      },
      milestones: (team?.milestones ?? []).filter((m) => !m.closed)
        .map((m) => ({ number: m.number, title: m.title, dueOn: m.dueOn, openIssues: m.openIssues, closedIssues: m.closedIssues })),
      wip: { limit: wipLimit(team), count: inProgress(team) },
      bulletin: bulletin ? { status: bulletin.status, body: bulletin.body } : null,
      teamDay: (await deps.progress.events(login)).includes("team-day"),
      visitJobs: (team?.issues ?? [])
        .filter((i) => !i.closed && i.milestone != null && (team?.milestones ?? []).some((m) => m.number === i.milestone && !m.closed))
        .map((i) => i.number).sort((a, b) => a - b),
      name: deps.teamName,
      duplicateWrong: (team?.issues ?? []).some((i) => parcelOf(i.body)?.duplicateOf && i.closed && i.stateReason !== "DUPLICATE"),
    },
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
  const inMain = new Set(practice?.mainHistory ?? []);
  // The same rule as level 12: a branch pushed from a machine, beyond main; the newest such branch.
  const headDate = (b: { history: { committedDate: string }[] }) => b.history[0]?.committedDate ?? "";
  const work = practice?.branches
    .filter((b) => b.name !== main?.name && !/^practice-\d+$/.test(b.name) && !b.viaWeb && b.oid !== main?.oid && !inMain.has(b.oid))
    .sort((a, b) => headDate(b).localeCompare(headDate(a)))[0];
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
