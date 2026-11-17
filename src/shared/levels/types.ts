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
  commits: { oid: string; url: string; committedDate: string }[];
}

/** The player's practice repository as read on GitHub. */
export interface PracticeSnapshot {
  repo: { id: string; nameWithOwner: string; url: string };
  board: { id: string; number: number; url: string; columns: string[] } | null;
  issues: PracticeIssue[];
  /** Null while the repository has no commit at all. */
  defaultBranch: { name: string; oid: string } | null;
  /** README.md on the default branch. */
  readme: string | null;
  /** Branches other than the default, with their head commit's author. */
  branches: { name: string; oid: string; author: string; url: string; readme: string | null }[];
  /** Newest first. */
  pulls: PracticePull[];
}

export interface Observed {
  viewer: string;
  events: TutorialEvent[];
  practice: PracticeSnapshot | null;
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
