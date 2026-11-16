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

/** The player's practice repository as read on GitHub. */
export interface PracticeSnapshot {
  repo: { id: string; nameWithOwner: string; url: string };
  board: { id: string; number: number; url: string; columns: string[] } | null;
  issues: PracticeIssue[];
}

export interface Observed {
  viewer: string;
  events: TutorialEvent[];
  practice: PracticeSnapshot | null;
}

/** proof: a GitHub address showing the skill, or "tutorial" for the fictitious site. */
export interface Check { done: boolean; proof: string | null }

export interface Level {
  id: string;
  rank: Rank;
  where: "tutorial" | "practice";
  check(o: Observed): Check;
}
