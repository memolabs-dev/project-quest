// One motion setting for the whole game.
import { useEffect, useState } from "react";
import { reduced } from "../settings.ts";
import { useQuest } from "../store.ts";

/** The player's motion setting; "follow the system" follows it while the game is open, not only at load. */
export function useReducedMotion() {
  const settings = useQuest((s) => s.settings);
  const [systemReduce, setReduce] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const follow = () => setReduce(query.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return reduced(settings, systemReduce);
}
