// The worker's answer to a warm gesture: only once GitHub accepted it, never for taking a sign back. Pure.
import type { PreparedWarm, WarmEmoji } from "../../shared/gestures/warm.ts";

export interface Greet { pallet: number; emoji: WarmEmoji; kind: "cheered" | "thanked"; at: number }

export function greetAfter(result: { ok: boolean }, prepared: PreparedWarm, at: number): Greet | null {
  if (!result.ok || prepared.kind === "uncheer") return null;
  return { pallet: prepared.issueNumber, emoji: prepared.content, kind: prepared.kind === "cheer" ? "cheered" : "thanked", at };
}
