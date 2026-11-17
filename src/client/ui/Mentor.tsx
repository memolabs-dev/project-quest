// Mémé Truelle's bubble: the current level's lesson and goal, one action, "check again", and a cheer when
// GitHub confirms a level. She can be folded away so the site stays in full view.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { mentorAction, newStamps } from "../levels.ts";
import { useQuest } from "../store.ts";

const CHEER_MS = 4000;

export function Mentor() {
  const { t } = useTranslation();
  const levels = useQuest((s) => s.levels);
  const before = useQuest((s) => s.levelsBefore);
  const kind = useQuest((s) => s.siteKind);
  const refreshLevels = useQuest((s) => s.refreshLevels);
  const openPractice = useQuest((s) => s.openPractice);
  const [folded, setFolded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const [notYet, setNotYet] = useState(false);

  // A level just stamped: cheer it for a few seconds, with its "done" line.
  const fresh = levels ? newStamps(before, levels) : [];
  const last = fresh[fresh.length - 1] ?? null;
  useEffect(() => {
    if (!last) return;
    const show = setTimeout(() => setCheer(last), 0);
    return () => clearTimeout(show);
  }, [last]);
  // The cheer's own timer: a later update without a new stamp must not keep it on screen.
  useEffect(() => {
    if (!cheer) return;
    const hide = setTimeout(() => setCheer(null), CHEER_MS);
    return () => clearTimeout(hide);
  }, [cheer]);

  if (!levels) return null;
  const action = mentorAction(levels, kind);
  const current = levels.current;

  const check = async () => {
    setChecking(true);
    const was = levels.stamps.length;
    await refreshLevels(true);
    setChecking(false);
    setNotYet((useQuest.getState().levels?.stamps.length ?? 0) === was);
  };

  if (folded) {
    return <button type="button" className="mentor-tab" onClick={() => setFolded(false)}>{t("mentor.name")}</button>;
  }
  return (
    <aside className="mentor" aria-label={t("mentor.name")} aria-live="polite">
      <div className="mentor-head">
        <span className="mentor-face" aria-hidden="true">M</span>
        <b>{t("mentor.name")}</b>
        <button type="button" className="mentor-fold" aria-label={t("mentor.fold")} onClick={() => setFolded(true)}>×</button>
      </div>
      {cheer ? (
        <p className="mentor-cheer">
          <span className="stamp" aria-hidden="true">✓</span> {t("mentor.stamped", { skill: t(`levels.${cheer}.skill`) })} {t(`levels.${cheer}.done`)}
        </p>
      ) : current === null ? (
        <p>{t("mentor.rankDone")}</p>
      ) : (
        <>
          {levels.stamps.length === 0 && <p>{t("mentor.hello")}</p>}
          <p>{t(`levels.${current}.lesson`)}</p>
          <p className="mentor-goal">{t(`levels.${current}.goal`)}</p>
          {current === "a10-answer-review" && (
            <p className="mentor-inspector"><b>{t("inspector.name")}</b><br />{t("inspector.remark")}</p>
          )}
          {notYet && <p className="mentor-notyet">{t("mentor.notYet")}</p>}
        </>
      )}
      <div className="mentor-actions">
        {action === "to-tutorial" && <a className="primary" href="?demo=1">{t("mentor.toTutorial")}</a>}
        {action === "to-practice" && <a className="primary" href="?site=practice">{t("mentor.toPractice")}</a>}
        {action !== null && action !== "to-tutorial" && action !== "to-practice" && action !== "move" && (
          <button type="button" className="primary" onClick={() => openPractice(action)}>{t(`practice.${action}.open`)}</button>
        )}
        {current !== null && (
          <button type="button" disabled={checking} onClick={() => void check()}>{t("mentor.checkAgain")}</button>
        )}
      </div>
    </aside>
  );
}
