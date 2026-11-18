// On a touch screen, a joystick to walk the site (#17); a tap on a pallet still opens it.
import { Joystick, useJoystickStore } from "ecctrl/input";
import { useEffect, useState } from "react";
import { useQuest } from "../store.ts";
import { isTouch } from "../touch.ts";

export function TouchControls() {
  const [touch, setTouch] = useState(isTouch);
  useEffect(() => {
    const m = globalThis.matchMedia?.("(pointer: coarse)");
    const on = () => setTouch(m?.matches ?? false);
    m?.addEventListener("change", on);
    return () => m?.removeEventListener("change", on);
  }, []);
  const site = useQuest((s) => s.site !== null);
  // A card or a dialog over the site has the screen: the stick hides and lets go.
  const busy = useQuest((s) => s.openCard !== null || s.warm !== null || s.thanking !== null || s.pending !== null
    || s.practiceDialog !== null || s.teamDialog !== null || (s.siteKind === "visit" && s.visitRepo === null));
  const show = touch && site && !busy;
  useEffect(() => { if (!show) useJoystickStore.getState().resetJoystick(); }, [show]);
  if (!show) return null;
  return (
    <div className="touch-stick">
      <Joystick
        joystickMaxRadius={44}
        joystickWrapperStyle={{ position: "static" }}
        joystickBaseStyle={{ background: "rgba(255, 250, 240, 0.7)", border: "2.5px solid #1c1c1c" }}
        joystickKnobStyle={{ background: "#f08a24", border: "2.5px solid #1c1c1c" }}
      />
    </div>
  );
}
