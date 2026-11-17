// The game's one sound player, for the director and the footsteps.
import { useEffect, useRef } from "react";
import { gameSound, type Sound } from "../sound.ts";
import { useQuest } from "../store.ts";

/** The game's one sound player, kept in step with the settings and unlocked by the first key or pointer press. */
export function useGameSound() {
  const settings = useQuest((s) => s.settings);
  const sound = useRef<Sound | null>(null);
  const unlocked = useRef(false);
  useEffect(() => {
    let live = true;
    void gameSound().then((s) => {
      if (!live) return;
      sound.current = s;
      s.setMuted(!settings.sound);
      s.setVolume(settings.volume);
      if (unlocked.current) s.unlock();
    });
    return () => { live = false; };
  }, [settings.sound, settings.volume]);
  useEffect(() => {
    const unlock = () => { unlocked.current = true; sound.current?.unlock(); };
    addEventListener("pointerdown", unlock);
    addEventListener("keydown", unlock);
    return () => { removeEventListener("pointerdown", unlock); removeEventListener("keydown", unlock); };
  }, []);
  return sound;
}
