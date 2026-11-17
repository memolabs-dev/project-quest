// The player's settings: sound, the miniature effect, motion. Kept in the browser; the game works without it
// (a private window or blocked storage only forgets them).

export interface Settings {
  sound: boolean;
  /** 0 to 1. */
  volume: number;
  miniature: boolean;
  /** "system" follows the operating system's reduced-motion setting. */
  motion: "system" | "reduce" | "full";
}

export const DEFAULT_SETTINGS: Settings = { sound: true, volume: 0.7, miniature: true, motion: "system" };

const KEY = "project-quest.settings";

const storageOrNull = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Each stored value is kept only when it is valid; anything else falls back to its default. */
export function loadSettings(storage: Storage | null = storageOrNull()): Settings {
  let raw: Partial<Record<keyof Settings, unknown>> = {};
  try {
    raw = JSON.parse(storage?.getItem(KEY) ?? "{}") as typeof raw;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  const d = DEFAULT_SETTINGS;
  return {
    sound: typeof raw.sound === "boolean" ? raw.sound : d.sound,
    volume: typeof raw.volume === "number" && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : d.volume,
    miniature: typeof raw.miniature === "boolean" ? raw.miniature : d.miniature,
    motion: raw.motion === "system" || raw.motion === "reduce" || raw.motion === "full" ? raw.motion : d.motion,
  };
}

export function saveSettings(settings: Settings, storage: Storage | null = storageOrNull()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Blocked storage: the settings hold for this visit only.
  }
}

/** Whether motion is reduced: the player's choice, or the system's when they follow it. */
export const reduced = (s: Settings, systemReduce: boolean) => (s.motion === "system" ? systemReduce : s.motion === "reduce");
