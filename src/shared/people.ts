// Who waits for an answer, who makes a first pull request: read from the board and from GitHub's own
// markers (authorAssociation), never guessed. Pure functions (welcome and answer spec, sections 2 and 3).
import type { BoardItem, BoardSnapshot } from "./site.ts";

/** GitHub's authorAssociation of the people who answer in the project's name. */
export const TEAM = ["OWNER", "MEMBER", "COLLABORATOR"] as const;
/** The 24 hours someone waits before the sign shows: a constant, not a setting. */
export const WAIT_MS = 86_400_000;
/** The associations GitHub gives to a first contribution. */
export const NEWCOMER = ["FIRST_TIMER", "FIRST_TIME_CONTRIBUTOR"] as const;

export interface LastComment { author: string | null; association: string; createdAt: string; excerpt: string }
export interface Waiting { pallet: number; login: string; since: string; excerpt: string }
export interface Newcomer {
  login: string;
  avatarUrl: string;
  pr: { id: string; number: number; title: string; url: string };
  /** The first issue the pull request closes that is a pallet of the board; set by `peopleOf`, null when read. */
  pallet: number | null;
  /** Every issue the pull request closes, as read from GitHub (`peopleOf` picks the pallet among them). */
  closes?: number[];
  contributingUrl: string | null;
}
export interface People { waiting: Waiting[]; newcomers: Newcomer[] }

/** The first 200 characters of a comment, cut on a word. */
export function excerptOf(text: string, max = 200): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.search(/\s\S*$/);
  return (space > 0 ? cut.slice(0, space) : cut).trimEnd();
}

/** Someone waits on this issue when the last word is neither the team's nor the player's, and is a day old. */
export function waitingOn(issue: BoardItem, viewer: string, now: number): Waiting | null {
  const last = issue.lastComment;
  if (issue.state !== "OPEN" || !last) return null;
  const login = last.author;
  if (!login || login.endsWith("[bot]") || login === viewer) return null;
  if ((TEAM as readonly string[]).includes(last.association)) return null;
  const at = Date.parse(last.createdAt);
  if (Number.isNaN(at) || now - at < WAIT_MS) return null;
  return { pallet: issue.number, login, since: last.createdAt, excerpt: last.excerpt };
}

export function peopleOf(board: BoardSnapshot, newcomers: Newcomer[], viewer: string, now: number): People {
  const pallets = new Set(board.items.filter((i) => !i.isEpic).map((i) => i.number));
  const waiting = board.items.flatMap((i) => (i.isEpic ? [] : [waitingOn(i, viewer, now)]).filter((w): w is Waiting => w !== null));
  return {
    waiting,
    newcomers: newcomers.map((n) => ({ ...n, pallet: (n.closes ?? (n.pallet === null ? [] : [n.pallet])).find((k) => pallets.has(k)) ?? null })),
  };
}
