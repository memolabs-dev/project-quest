// The two talking gestures on the client (welcome and answer spec, sections 2, 3 and 5): the drafts the player starts
// from, and who can be talked to where. The game writes no substance: a quote, a thank-you, never an answer.
import type { TalkKind } from "../shared/gestures/talk.ts";
import { quietMentions } from "../shared/gestures/warm.ts";
import { excerptOf, type People } from "../shared/people.ts";

type Say = (key: string, o?: Record<string, unknown>) => string;

/**
 * Who can be talked to: the answer's number is the issue, the welcome's number is the pull request. `pallet` is where
 * they stand: the issue they wait on, the one their pull request closes, or null for a visitor at the office.
 */
export interface TalkTarget { kind: TalkKind; number: number; login: string; pallet: number | null }

/**
 * The first words of what the person wrote, every line quoted, then an empty line for the player's own answer.
 * A mention in the quote is written as code: quoting someone never notifies the people they named.
 */
export function answerDraft(excerpt: string, _say?: Say): string {
  return `${quietMentions(excerptOf(excerpt)).split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
}

/** A warm thank-you for a first contribution, with the contributing guide when the repository has one. No @mention. */
export function welcomeDraft(login: string, contributingUrl: string | null, say: Say): string {
  const hello = say("talk.welcomeDraft", { login });
  return contributingUrl ? `${hello}\n\n${say("talk.welcomeGuide", { url: contributingUrl })}` : hello;
}

/** What the player can say at a pallet: the answer first, then the welcome of the pull request that will close it. */
export function talkAt(people: People | undefined, pallet: number): TalkTarget[] {
  if (!people) return [];
  return [
    ...people.waiting.filter((w) => w.pallet === pallet).map((w) => ({ kind: "answer" as const, number: w.pallet, login: w.login, pallet })),
    ...people.newcomers.filter((n) => n.pallet === pallet).map((n) => ({ kind: "welcome" as const, number: n.pr.number, login: n.login, pallet })),
  ];
}

/**
 * What E (or a tap on the prompt) opens: the card of the pallet where someone waits or arrived, whose first button is
 * the talk; the welcome itself only for a visitor, who has no card; else the nearest pallet's card.
 */
export function actionAt(nearPallet: number | null, talk: TalkTarget | null): { card: number } | { talk: TalkTarget } | null {
  if (talk) return talk.pallet === null ? { talk } : { card: talk.pallet };
  return nearPallet === null ? null : { card: nearPallet };
}

/** The prompt's words near someone: the pallet and who is there ("#12 · maria waits for an answer"), or the visitor. */
export function talkPrompt(talk: TalkTarget, touch: boolean): { key: string; values: { number: number; login: string } } {
  const key = talk.pallet === null ? "talk.nearVisitor" : talk.kind === "answer" ? "talk.nearAnswer" : "talk.nearWelcome";
  return { key: touch ? `${key}Touch` : key, values: { number: talk.pallet ?? talk.number, login: talk.login } };
}

/** How long someone has waited, in whole days (a sign shows only after a day, so never less than one). */
export const waitedDays = (since: string, now: number) => Math.max(1, Math.floor((now - Date.parse(since)) / 86_400_000));

export const sameTarget = (a: TalkTarget | null, b: TalkTarget | null) =>
  a?.kind === b?.kind && a?.number === b?.number && a?.login === b?.login && a?.pallet === b?.pallet;
