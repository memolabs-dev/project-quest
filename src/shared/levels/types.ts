// A level is data: its rank, where it plays, and a pure check over what the server observed.
// Its words live in the locales under levels.<id>.skill, .goal and .lesson.

export type Rank = "apprentice" | "journeyman" | "team-leader" | "real-project";

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
  board: { id: string; number: number; url: string; columns: string[] } | null;
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
  issues: { id: string; number: number; title: string; url: string; assignees: string[]; comments: { author: string; url: string }[] }[];
}

export interface Observed {
  viewer: string;
  events: TutorialEvent[];
  practice: PracticeSnapshot | null;
  /** Read only once the Team leader rank is done. */
  real?: RealSnapshot | null;
}

/** A level passed, with its proof. */
export interface Stamp { levelId: string; stampedAt: string; proof: string }

/** proof: a GitHub address showing the skill, or "tutorial" for the fictitious site. */
export interface Check { done: boolean; proof: string | null }

export interface Level {
  id: string;
  rank: Rank;
  where: "tutorial" | "practice";
  check(o: Observed): Check;
}
