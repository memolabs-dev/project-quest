// The warm signs' glyphs, and the hook that prepares a warm gesture for the confirmation.
import { useTranslation } from "react-i18next";
import type { WarmEmoji, WarmKind } from "../../shared/gestures/warm.ts";
import { ApiFailure, api } from "../api.ts";
import { useQuest } from "../store.ts";

export const GLYPH: Record<WarmEmoji, string> = { HOORAY: "🎉", HEART: "❤️", ROCKET: "🚀", THUMBS_UP: "👍" };

/** Prepares a warm gesture and hands it to the confirmation; a refusal is said in the notice. */
export function useWarmGesture() {
  const { t } = useTranslation();
  const setWarm = useQuest((s) => s.setWarm);
  const say = useQuest((s) => s.say);
  return async (kind: WarmKind, args: { issueNumber: number; content: WarmEmoji; words?: string | null }) => {
    try {
      setWarm(await api.prepareWarm(kind, args));
    } catch (e) {
      say(e instanceof ApiFailure ? e.message : t("errors.generic"));
    }
  };
}

