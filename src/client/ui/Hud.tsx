// Always on screen: demo banner, controls hint, the "press E" prompt.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACTION_CODE, MOVE_CODES, keyLetters } from "../keys.ts";
import { useQuest } from "../store.ts";

export function Hud() {
  const { t } = useTranslation();
  const mode = useQuest((s) => s.mode);
  const demoReason = useQuest((s) => s.demoReason);
  const near = useQuest((s) => s.nearPallet);
  const card = useQuest((s) => s.openCard);
  const [letters, setLetters] = useState({ move: "WASD", action: "E" });
  useEffect(() => {
    void keyLetters([...MOVE_CODES, ACTION_CODE]).then(([w, a, s, d, e]) => setLetters({ move: `${w}${a}${s}${d}`, action: e }));
  }, []);
  return (
    <>
      {mode === "demo" && (
        <div className="banner" role="note">{demoReason === "no-github-access" ? <>{t("demo.noAccess")} <code>gh auth login</code></> : t("demo.banner")}</div>
      )}
      {near !== null && card === null && <div className="prompt">{t("site.near", { number: near, action: letters.action })}</div>}
      <div className="controls">{t("site.controls", { keys: letters.move, action: letters.action })}</div>
    </>
  );
}
