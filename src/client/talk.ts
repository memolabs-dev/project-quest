// The two talking gestures on the client (welcome and answer spec, sections 2, 3 and 5): the drafts the player starts
// from, and who can be talked to where. The game writes no substance: a quote, a thank-you, never an answer.
import type { TalkKind } from "../shared/gestures/talk.ts";
import { quietMentions } from "../shared/gestures/warm.ts";
import { excerptOf, type People } from "../shared/people.ts";

type Say = (key: string, o?: Record<string, unknown>) => string;

/** Who can be talked to: the answer's number is the issue, the welcome's number is the pull request. */
export interface TalkTarget { kind: TalkKind; number: number; login: string }

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
    ...people.waiting.filter((w) => w.pallet === pallet).map((w) => ({ kind: "answer" as const, number: w.pallet, login: w.login })),
    ...people.newcomers.filter((n) => n.pallet === pallet).map((n) => ({ kind: "welcome" as const, number: n.pr.number, login: n.login })),
  ];
}

/** How long someone has waited, in whole days (a sign shows only after a day, so never less than one). */
export const waitedDays = (since: string, now: number) => Math.max(1, Math.floor((now - Date.parse(since)) / 86_400_000));

export const sameTarget = (a: TalkTarget | null, b: TalkTarget | null) => a?.kind === b?.kind && a?.number === b?.number && a?.login === b?.login;
