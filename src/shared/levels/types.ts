// A level is data: its rank, where it plays, and a pure check over what the server observed.
// Its words live in the locales under levels.<id>.skill, .goal and .lesson.

export type Rank = "apprentice" | "journeyman" | "team-leader" | "real-project" | "site-foreman" | "site-manager" | "project-director";

/** Two paths: lending a hand on a project, or running one. */
export type Path = "volunteer" | "lead";

/** What the tutorial on the fictitious site reports; nothing there is sent to GitHub. */
export const TUTORIAL_EVENTS = ["walked", "card-opened", "card-read", "pallet-moved"] as const;
export type TutorialEvent = (typeof TUTORIAL_EVENTS)[number];

export interface PracticeIssue {
  id: string;
  number: number;
  url: string;
  author: string;
  assignees: string[];
  comments: { author: string; url: string }[];
  /** The issue's column on the practice board, null when it has none. */
  status: string | null;
  closed: boolean;
  labels?: string[];
  body?: string;
  /** Why it was closed: COMPLETED, NOT_PLANNED or DUPLICATE. */
  stateReason?: string | null;
  duplicateOf?: number | null;
  /** Its item on the practice board, and its Size there. */
  itemId?: string | null;
  size?: string | null;
  /** The iteration it is loaded on, on the board's Sprint field. */
  iteration?: string | null;
  /** The number of its milestone. */
  milestone?: number | null;
  subIssues?: number[];
  /** The issues it waits for. */
  blockedBy?: number[];
}

/** One week of an iteration field. */
export interface Iteration { id: string; title: string; startDate: string; duration: number }

/** A milestone of the repository: the mayor's visit. */
export interface Milestone {
  id: string; number: number; title: string; dueOn: string | null; url: string; closed: boolean;
  /** Its issues still open, and those closed: the visit is ready when none is open. */
  openIssues: number; closedIssues: number;
}

/** A board's status update: the evening bulletin. */
export interface StatusUpdate { status: string | null; body: string; createdAt: string }

/** A field of a board; single selects carry their options. */
export interface BoardField {
  id: string; name: string; dataType: string; options?: { id: string; name: string }[];
  /** An iteration field's iterations, past ones included, oldest first. */
  iterations?: Iteration[];
}

export interface PracticePull {
  id: string;
  number: number;
  url: string;
  author: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  headRefName: string;
  headRefOid: string;
  /** Issues of the practice repository this pull request closes when merged ("Closes #N"). */
  closes: number[];
  /** Issues of other repositories it would close too ("Closes owner/repo#N"): the game never merges it then. */
  closesElsewhere: string[];
  /** viaWeb: committed through GitHub (web or API), not pushed from a machine. */
  commits: { oid: string; url: string; committedDate: string; viaWeb: boolean }[];
}

/** One commit of a branch's recent history. */
export interface BranchCommit { oid: string; committedDate: string; viaWeb: boolean }

/** The player's practice repository as read on GitHub. */
export interface PracticeSnapshot {
  repo: { id: string; nameWithOwner: string; url: string };
  board: {
    id: string; number: number; url: string; columns: string[];
    statusFieldId?: string;
    /** The Status options, in order (the same as columns). */
    statusOptions?: string[];
    /** The same options with their ids: kept when the options are rewritten, so items keep their column. */
    statusOptionIds?: { id: string; name: string; description?: string }[];
    fields?: BoardField[];
    /** Newest first. */
    statusUpdates?: StatusUpdate[];
  } | null;
  /** The repository's labels, with their ids (for labelling). */
  labels?: { id: string; name: string }[];
  milestones?: Milestone[];
  issues: PracticeIssue[];
  /** Null while the repository has no commit at all. */
  defaultBranch: { name: string; oid: string; committedDate: string } | null;
  /** README.md on the default branch. */
  readme: string | null;
  /** Branches other than the default, with their head commit's author. */
  branches: {
    name: string; oid: string; author: string; url: string; readme: string | null;
    /** The head was committed through GitHub (web or API), not pushed from a machine. */
    viaWeb: boolean;
    /** Newest first, up to 30. */
    history: BranchCommit[];
  }[];
  /** Oids of the default branch's recent history (newest first, up to 50): what is not the player's own. */
  mainHistory: string[];
  /** PLAN.md on the default branch: the mayor's plan. */
  plan: string | null;
  /** Newest first. */
  pulls: PracticePull[];
}

/** The real project's open issues marked for newcomers, with their comments. */
export interface RealSnapshot {
  repo: string;
  issues: { id: string; number: number; title: string; url: string; assignees: string[]; comments: { author: string; url: string; createdAt: string }[] }[];
}

export interface Observed {
  viewer: string;
  events: TutorialEvent[];
  practice: PracticeSnapshot | null;
  /** Read only once the Team leader rank is done. */
  real?: RealSnapshot | null;
  /** The lead's team site, as read on GitHub. */
  team?: PracticeSnapshot | null;
  /** The points the lead declared their sprint can carry: the game's rule, not GitHub's. */
  capacity?: number | null;
  /** Today on the server, YYYY-MM-DD (UTC): which sprint is the current one. */
  today?: string;
  /** When the last level began (the Team leader rank's last stamp): older comments never count. */
  realSince?: string | null;
}

/** A level passed, with its proof. */
export interface Stamp { levelId: string; stampedAt: string; proof: string }

/** proof: a GitHub address showing the skill, or "tutorial" for the fictitious site. */
export interface Check { done: boolean; proof: string | null }

export interface Level {
  id: string;
  rank: Rank;
  path: Path;
  where: "tutorial" | "practice" | "real";
  check(o: Observed): Check;
}
