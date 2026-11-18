// The two gestures of the lead who talks to people (welcome and answer spec, sections 2 and 3): answer someone who waits
// on an issue, welcome someone whose first pull request is open. One comment each, in the player's own words.
// The game never writes the substance, never adds an @mention or an assignment, and never counts anything.
import { waitingOn, type Newcomer } from "../people.ts";
import type { BoardSnapshot } from "../site.ts";
import { GestureError } from "./move.ts";
import type { PracticeMutation } from "./practice.ts";
import { mentionsIn } from "./warm.ts";

export type TalkKind = "answer" | "welcome";
export interface PreparedTalk {
  kind: TalkKind;
  repo: string;
  /** The login the words are for. */
  to: string;
  target: { kind: "issue" | "pull"; number: number; title: string; url: string };
  /** The player's own words, trimmed. */
  words: string;
  /** The logins the words mention: the confirmation says they will be notified. */
  mentions: string[];
  mutations: PracticeMutation[];
}

const wordsOf = (words: string) => {
  const text = words.trim();
  if (!text) throw new GestureError("Your words are empty: write a few before sending");
  return text;
};

export function prepareAnswer(board: BoardSnapshot, repo: string, issueNumber: number, words: string, viewer: string, now: number): PreparedTalk {
  const issue = board.items.find((i) => i.number === issueNumber && !i.isEpic);
  const waiting = issue ? waitingOn(issue, viewer, now) : null;
  if (!issue || !waiting) throw new GestureError(`Nobody waits for an answer on #${issueNumber} any more`);
  const text = wordsOf(words);
  return {
    kind: "answer", repo, to: waiting.login, words: text, mentions: mentionsIn(text),
    target: { kind: "issue", number: issue.number, title: issue.title, url: issue.url },
    mutations: [{ name: "addComment", input: { subjectId: issue.issueId, body: text } }],
  };
}

export function prepareWelcome(newcomers: Newcomer[], repo: string, prNumber: number, words: string): PreparedTalk {
  const n = newcomers.find((x) => x.pr.number === prNumber);
  if (!n) throw new GestureError("This newcomer was already welcomed");
  const text = wordsOf(words);
  return {
    kind: "welcome", repo, to: n.login, words: text, mentions: mentionsIn(text),
    target: { kind: "pull", number: n.pr.number, title: n.pr.title, url: n.pr.url },
    mutations: [{ name: "addComment", input: { subjectId: n.pr.id, body: text } }],
  };
}
