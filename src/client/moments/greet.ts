// The worker's answer to a warm gesture or a talk: only once GitHub accepted it, never for taking a sign back. Pure.
import type { PreparedTalk } from "../../shared/gestures/talk.ts";
import type { PreparedWarm, WarmEmoji } from "../../shared/gestures/warm.ts";

/** `pallet` is null for a visitor (no pallet); `login` is set when the person is named (a talk); `emoji` null for a talk. */
export interface Greet { pallet: number | null; login: string | null; emoji: WarmEmoji | null; kind: "cheered" | "thanked" | "talked"; at: number }

export function greetAfter(result: { ok: boolean }, prepared: PreparedWarm, at: number): Greet | null {
  if (!result.ok || prepared.kind === "uncheer") return null;
  return { pallet: prepared.issueNumber, login: null, emoji: prepared.content, kind: prepared.kind === "cheer" ? "cheered" : "thanked", at };
}

/** An accepted answer or welcome waves back at the person; `pallet` is the one they stand by, null for a visitor. */
export function greetAfterTalk(result: { ok: boolean }, prepared: PreparedTalk, pallet: number | null, at: number): Greet | null {
  if (!result.ok) return null;
  return { pallet, login: prepared.to, emoji: null, kind: "talked", at };
}

/** Whether this worker answers the greet: a talk is for one person, by login; a warm gesture, for the pallet's workers. */
export function greets(greet: Greet | null, spot: { login: string; pallet: number | null }): boolean {
  if (!greet) return false;
  return greet.kind === "talked" ? greet.login === spot.login : greet.pallet === spot.pallet;
}
