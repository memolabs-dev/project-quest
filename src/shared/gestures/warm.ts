// The warm gestures (people of the site spec, sections 4 and 5): cheer a worker with a positive reaction on their
// pallet, take it back, thank them when the pallet is laid (a reaction, and the player's own words if they wish).
// Positive emojis only; the game never adds an @mention or an assignment; nothing is ranked or counted.
import type { BoardSnapshot } from "../site.ts";
import { GestureError } from "./move.ts";
import type { PracticeMutation } from "./practice.ts";

export const WARM_EMOJIS = ["HOORAY", "HEART", "ROCKET", "THUMBS_UP"] as const;
export type WarmEmoji = (typeof WARM_EMOJIS)[number];
/** A thank-you is joy or love. */
export const THANK_EMOJIS = ["HOORAY", "HEART"] as const;

export type WarmKind = "cheer" | "uncheer" | "thank";
export interface PreparedWarm {
  kind: WarmKind;
  repo: string;
  issueNumber: number;
  title: string;
  content: WarmEmoji;
  /** The player's own words (a thank-you only), trimmed; null when none. */
  words: string | null;
  /** The logins the player's words mention: the confirmation says they will be notified. */
  mentions: string[];
  mutations: PracticeMutation[];
}

const isWarm = (c: string): c is WarmEmoji => (WARM_EMOJIS as readonly string[]).includes(c);

const issueOf = (board: BoardSnapshot, n: number) => {
  const i = board.items.find((x) => x.number === n && !x.isEpic);
  if (!i) throw new GestureError(`Issue #${n} is not a pallet of the site`);
  return i;
};

const emojiOf = (content: string): WarmEmoji => {
  if (!isWarm(content)) throw new GestureError("Only a warm sign: 🎉, ❤️, 🚀 or 👍");
  return content;
};

/** `@login` at the start or after a space or punctuation, never inside an address. */
const MENTION = /(^|[^\w@.])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/g;
/**
 * Code, where GitHub notifies nobody: a run of backticks up to the same run, within a paragraph (a fenced block too,
 * when it holds no empty line). Anything else is read as words, so a doubt warns rather than stays quiet.
 */
const CODE = /(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?[^`]\1(?!`)/g;

/** The logins the words notify: a mention written as code notifies nobody. */
export const mentionsIn = (words: string) => [...words.replace(CODE, " ").matchAll(MENTION)].map((m) => m[2]);

/** The same text with every mention written as code, so quoting it notifies nobody (its own backticks become quote marks). */
export const quietMentions = (text: string) => text.replace(/`/g, "'").replace(MENTION, (_m, before: string, login: string) => `${before}\`@${login}\``);

export function prepareCheer(board: BoardSnapshot, repo: string, issueNumber: number, content: string): PreparedWarm {
  const issue = issueOf(board, issueNumber);
  const emoji = emojiOf(content);
  if (issue.myReactions?.includes(emoji)) throw new GestureError("You already gave this one: take it back instead");
  return {
    kind: "cheer", repo, issueNumber, title: issue.title, content: emoji, words: null, mentions: [],
    mutations: [{ name: "addReaction", input: { subjectId: issue.issueId, content: emoji } }],
  };
}

export function prepareUncheer(board: BoardSnapshot, repo: string, issueNumber: number, content: string): PreparedWarm {
  const issue = issueOf(board, issueNumber);
  const emoji = emojiOf(content);
  if (!issue.myReactions?.includes(emoji)) throw new GestureError("You have not given this one: nothing to take back");
  return {
    kind: "uncheer", repo, issueNumber, title: issue.title, content: emoji, words: null, mentions: [],
    mutations: [{ name: "removeReaction", input: { subjectId: issue.issueId, content: emoji } }],
  };
}

/** `thanked`: the player already left words on this pallet since it was laid (GitHub is the memory). */
export function prepareThank(
  board: BoardSnapshot, repo: string, issueNumber: number, content: string, words: string | null, thanked: boolean,
): PreparedWarm {
  const issue = issueOf(board, issueNumber);
  if (issue.state !== "CLOSED" || (issue.stateReason ?? "COMPLETED") !== "COMPLETED") {
    throw new GestureError(`Issue #${issueNumber} is not laid yet: a thank-you waits for the work to be done`);
  }
  const emoji = emojiOf(content);
  if (!(THANK_EMOJIS as readonly string[]).includes(emoji)) throw new GestureError("A thank-you is 🎉 or ❤️");
  const text = words === null ? null : words.trim();
  if (text !== null && !text) throw new GestureError("Your words are empty: write a few, or send the sign alone");
  if (text !== null && thanked) throw new GestureError("You already thanked with words on this pallet");
  const mutations: PracticeMutation[] = [];
  if (!issue.myReactions?.includes(emoji)) mutations.push({ name: "addReaction", input: { subjectId: issue.issueId, content: emoji } });
  if (text) mutations.push({ name: "addComment", input: { subjectId: issue.issueId, body: text } });
  if (!mutations.length) throw new GestureError("You already gave this sign: add a few words, or pick the other one");
  return { kind: "thank", repo, issueNumber, title: issue.title, content: emoji, words: text, mentions: text ? mentionsIn(text) : [], mutations };
}
