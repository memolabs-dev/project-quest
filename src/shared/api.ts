// The shapes the API sends and the game reads. Shared so both sides agree at compile time.
import type { PreparedMove } from "./gestures/move.ts";
import type { PreparedPractice } from "./gestures/practice.ts";
import type { unlocks } from "./levels/progress.ts";
import type { Path, Rank, Stamp } from "./levels/types.ts";
import type { Site } from "./site.ts";

export interface SiteResponse {
  site: Site;
  viewer: { login: string; avatarUrl: string };
  mode: "live" | "demo";
  demoReason: "asked" | "no-github-access" | null;
}

/** A public repository, visited read-only (#16). */
export interface RepoInfo { nameWithOwner: string; url: string; stars: number }
export interface VisitResponse { site: Site; repo: RepoInfo }

export type ApplyResponse =
  /** site is null when the move landed on GitHub but the site could not be rebuilt; the game reloads it. */
  | { ok: true; site: Site | null }
  | { ok: false; reason: "stale"; current: { status: string | null; updatedAt: string; change: "moved" | "changed" | "gone" } }
  | { ok: false; reason: "github"; message: string };

export interface LoggedActionView {
  id: number;
  playerLogin: string;
  gesture: string;
  target: string;
  result: "applied" | "stale" | "failed";
  createdAt: string;
}

export type ApiError =
  | { error: "github-auth" | "github-scope"; hint: string }
  | { error: "board" | "gesture" | "server" | "practice-missing" | "not-public" | "busy"; message: string };

/** Where the player stands in the levels. Only ever the viewer's own. */
export interface LevelsView {
  /** The player these levels belong to. */
  login: string;
  /** False on the demo site: gestures are shown, never sent. */
  canWrite: boolean;
  stamps: Stamp[];
  /** The path the player chose; null before choosing (the volunteer's path is shown then). */
  path: Path | null;
  /** The next level of the shown path, null when all its levels are stamped. */
  current: string | null;
  /** The rank reached on the shown path. */
  rank: Rank | null;
  ranks: Record<Path, Rank | null>;
  unlocks: ReturnType<typeof unlocks>;
  practice: {
    name: string;
    exists: boolean;
    /** README.md on the default branch, for the trowel. */
    readme: string | null;
    /** The viewer's open issue on their practice site (the lowest), for the Journeyman's gestures. */
    issue: number | null;
    /** The viewer's open pull request that closes an issue. */
    pull: number | null;
    /** The lowest open issue nobody has taken yet. */
    unassigned: number | null;
    defaultBranch: string | null;
    /** The viewer's newest branch pushed from their machine (neither the default nor practice-N). */
    workBranch: string | null;
    /** Main moved after the work branch's first commit from the machine (the mayor's change landed). */
    mainMoved: boolean;
    /** The viewer's latest pull request from a work branch was closed without merging (null otherwise). */
    closedPull: number | null;
  };
  /** The real project's good first issues, once read (after the Team leader rank). */
  real: { issues: number } | null;
  /** The lead's team site: founded, the mayor's parcels arrived, its labels (for sorting). */
  team: {
    exists: boolean; parcels: boolean; labels: string[];
    /** This week's sprint: its title, its open pallets' points against the declared capacity, those without a size. */
    sprint: { field: boolean; current: string | null; points: number; capacity: number | null; loaded: number[]; unsized: number[] };
    /** The open milestones: the mayor's visits. */
    milestones: { number: number; title: string; dueOn: string | null; openIssues: number; closedIssues: number }[];
    /** "Being laid" against the limit written on GitHub. */
    wip: { limit: number | null; count: number };
    /** The newest evening bulletin on the board. */
    bulletin: { status: string | null; body: string } | null;
    /** The fictitious team's day has been played (a game event: GitHub cannot show it afterwards). */
    teamDay: boolean;
    /** The open jobs under an open visit: those "Lay it: done" is offered on. */
    visitJobs: number[];
    /** The mayor's duplicate parcel is closed, but not as a duplicate (level 2 then waits). */
    duplicateWrong: boolean;
    /** The team site's repository name (QUEST_TEAM_REPO, my-first-team by default). */
    name: string;
  };
}

/** A warm gesture's answer: the site with the player's signs ticked, and the levels (a stamp may have fallen). */
export type WarmApplyResponse =
  | { ok: true; site: Site | null; levels: LevelsView | null }
  | { ok: false; reason: "github"; message: string; applied: string[] };

/** A talk's answer: the comment's address (the site is read again by the client, it carries the people). */
export type TalkApplyResponse =
  /** No site: the client reads the site again, with its people (an answer's site would come without them). */
  | { ok: true; site: null; levels: LevelsView | null; url: string }
  | { ok: false; reason: "github"; message: string; applied: string[] };

export type PracticeApplyResponse =
  /** levels is null when GitHub accepted the gesture but the levels could not be read again right after. */
  | { ok: true; levels: LevelsView | null }
  | { ok: false; reason: "github"; message: string; applied: string[] };

export type { PreparedMove, PreparedPractice };
