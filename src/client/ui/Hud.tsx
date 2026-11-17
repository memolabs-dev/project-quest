// Always on screen: demo banner, controls hint, the "press E" prompt.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACTION_CODE, CHEER_CODE, MOVE_CODES, keyLetters } from "../keys.ts";
import { useQuest } from "../store.ts";

export function Hud() {
  const { t } = useTranslation();
  const mode = useQuest((s) => s.mode);
  const demoReason = useQuest((s) => s.demoReason);
  const near = useQuest((s) => s.nearPallet);
  const card = useQuest((s) => s.openCard);
  const worker = useQuest((s) => (s.siteKind === "main" || s.siteKind === "demo" ? s.nearWorker : null));
  const picking = useQuest((s) => s.picker !== null);
  const [letters, setLetters] = useState({ move: "WASD", action: "E", cheer: "R" });
  useEffect(() => {
    void keyLetters([...MOVE_CODES, ACTION_CODE, CHEER_CODE]).then(([w, a, s, d, e, r]) => setLetters({ move: `${w}${a}${s}${d}`, action: e, cheer: r }));
  }, []);
  return (
    <>
      {mode === "demo" && (
        <div className="banner" role="note">{demoReason === "no-github-access" ? <>{t("demo.noAccess")} <code>gh auth login</code></> : t("demo.banner")}</div>
      )}
      {card === null && (near !== null || (worker && !picking)) && (
        <div className="prompt">
          {near !== null && <span>{t("site.near", { number: near, action: letters.action })}</span>}
          {worker && !picking && <span>{t("warm.near", { login: worker.login, key: letters.cheer })}</span>}
        </div>
      )}
      <div className="controls">{t("site.controls", { keys: letters.move, action: letters.action })}</div>
    </>
  );
}
