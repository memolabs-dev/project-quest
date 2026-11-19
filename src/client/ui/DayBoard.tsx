// The day's board (a day on the site, section 4): the jobs of the day, ticked when their fact is seen on the site,
// each opening its pallet's card or the newcomer's welcome, and "Close the day". It can be folded.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Job, jobWords } from "../day.ts";
import { useQuest } from "../store.ts";

export function DayBoard() {
  const { t } = useTranslation();
  const day = useQuest((s) => s.day);
  const open = useQuest((s) => s.open);
  const openTalk = useQuest((s) => s.openTalk);
  const endDay = useQuest((s) => s.endDay);
  const closed = useQuest((s) => s.closedDay);
  const dismiss = useQuest((s) => s.dismissClosedDay);
  const [folded, setFolded] = useState(false);
  // The evening, where the player stands: the radio's summing up, written on the board.
  if (!day && closed) {
    return (
      <section className="day-board" aria-label={t("day.closedTitle", { n: closed.n })} role="status">
        <div className="day-head"><h2>{t("day.closedTitle", { n: closed.n })}</h2></div>
        {closed.lines.map((l, i) => <p key={i}>{t(`${l.key}_${l.values.variant}`, l.values)}</p>)}
        <button type="button" className="day-close" onClick={dismiss}>{t("day.closedOk")}</button>
      </section>
    );
  }
  if (!day) return null;
  const done = day.done.filter(Boolean).length;
  const go = (j: Job) => (j.kind === "welcome" && j.pallet === null ? openTalk({ kind: "welcome", number: j.pr }) : open(j.pallet));
  return (
    <section className="day-board" aria-label={t("day.title")}>
      <div className="day-head">
        <h2>{t("day.title")}</h2>
        {day.jobs.length > 0 && <span className="day-count">{t("day.count", { done, total: day.jobs.length })}</span>}
        <button type="button" className="day-fold" aria-expanded={!folded} aria-label={t(folded ? "day.unfold" : "day.fold")}
          onClick={() => setFolded((v) => !v)}>{folded ? "▸" : "▾"}</button>
      </div>
      {!folded && (
        <>
          {day.jobs.length === 0 ? <p>{t("day.free")}</p> : (
            <ul>
              {day.jobs.map((j, i) => (
                <li key={`${j.kind}:${j.kind === "welcome" ? j.pr : j.pallet}`} className={day.done[i] ? "done" : undefined}>
                  <span className="day-tick" aria-hidden="true">{day.done[i] ? "✓" : ""}</span>
                  <button type="button" onClick={() => go(j)}>
                    {t(...jobWords(j))}
                    {day.done[i] && <span className="sr-only"> ({t("day.done")})</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="day-close" onClick={endDay}>{t("day.close")}</button>
        </>
      )}
    </section>
  );
}
