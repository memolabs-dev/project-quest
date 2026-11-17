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

export type ApplyResponse =
  /** site is null when the move landed on GitHub but the site could not be rebuilt; the game reloads it. */
  | { ok: true; site: Site | null }
  | { ok: false; reason: "stale"; current: { status: string | null; updatedAt: string } }
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
  | { error: "board" | "gesture" | "server" | "practice-missing"; message: string };

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
  };
  /** The real project's good first issues, once read (after the Team leader rank). */
  real: { issues: number } | null;
  /** The lead's team site: founded, the mayor's parcels arrived, its labels (for sorting). */
  team: {
    exists: boolean; parcels: boolean; labels: string[];
    /** This week's sprint: its title, its open pallets' points against the declared capacity, those without a size. */
    sprint: { field: boolean; current: string | null; points: number; capacity: number | null; loaded: number[]; unsized: number[] };
    /** The open milestones: the mayor's visits. */
    milestones: { number: number; title: string; dueOn: string | null; openIssues: number }[];
    /** "Being laid" against the limit written on GitHub. */
    wip: { limit: number | null; count: number };
    /** The newest evening bulletin on the board. */
    bulletin: { status: string | null; body: string } | null;
    /** The site radio's draft of tonight's bulletin. */
    radio: string;
    /** The fictitious team's day has been played (a game event: GitHub cannot show it afterwards). */
    teamDay: boolean;
  };
}

export type PracticeApplyResponse =
  | { ok: true; levels: LevelsView }
  | { ok: false; reason: "github"; message: string; applied: string[] };

export type { PreparedMove, PreparedPractice };
