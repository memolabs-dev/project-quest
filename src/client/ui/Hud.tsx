// Always on screen: demo banner, controls hint, the "press E" prompt.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACTION_CODE, CHEER_CODE, MOVE_CODES, keyLetters } from "../keys.ts";
import { useQuest } from "../store.ts";
import { isTouch } from "../touch.ts";
import { VisitBar } from "./Visit.tsx";

export function Hud() {
  const { t } = useTranslation();
  const mode = useQuest((s) => s.mode);
  const demoReason = useQuest((s) => s.demoReason);
  const near = useQuest((s) => s.nearPallet);
  const card = useQuest((s) => s.openCard);
  const worker = useQuest((s) => (s.siteKind === "main" || s.siteKind === "demo" ? s.nearWorker : null));
  const talk = useQuest((s) => s.nearTalk);
  const openTalk = useQuest((s) => s.openTalk);
  const picking = useQuest((s) => s.picker !== null);
  const visiting = useQuest((s) => s.siteKind === "visit");
  const site = useQuest((s) => s.site !== null);
  const [letters, setLetters] = useState({ move: "WASD", action: "E", cheer: "R" });
  useEffect(() => {
    void keyLetters([...MOVE_CODES, ACTION_CODE, CHEER_CODE]).then(([w, a, s, d, e, r]) => setLetters({ move: `${w}${a}${s}${d}`, action: e, cheer: r }));
  }, []);
  return (
    <>
      {visiting && <VisitBar />}
      {!visiting && mode === "demo" && (
        <div className="banner" role="note">{demoReason === "no-github-access" ? <>{t("demo.noAccess")} <code>gh auth login</code></> : t("demo.banner")}</div>
      )}
      {card === null && (near !== null || talk || (worker && !picking)) && (
        <div className="prompt">
          {talk && (isTouch()
            ? <button type="button" className="prompt-talk" onClick={() => openTalk({ kind: talk.kind, number: talk.number })}>{t(talk.kind === "answer" ? "talk.nearAnswerTouch" : "talk.nearWelcomeTouch", { login: talk.login })}</button>
            : <span>{t(talk.kind === "answer" ? "talk.nearAnswer" : "talk.nearWelcome", { key: letters.action, login: talk.login })}</span>)}
          {!talk && near !== null && <span>{t(isTouch() ? "site.nearTouch" : "site.near", { number: near, action: letters.action })}</span>}
          {worker && !picking && <span>{t("warm.near", { login: worker.login, key: letters.cheer })}</span>}
        </div>
      )}
      {/* No site yet (a visit asking for its repository): nothing to walk, no controls. */}
      {site && <div className="controls">{t("site.controls", { keys: letters.move, action: letters.action })}</div>}
    </>
  );
}
