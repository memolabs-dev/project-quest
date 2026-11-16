// The skill book: one stamp per level, with its date and its proof on GitHub; the next ones in outline,
// so what comes next is always in sight. Only the player's own: nothing here compares people.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LEVELS } from "../../shared/levels/index.ts";
import type { Rank } from "../../shared/levels/types.ts";
import { useQuest } from "../store.ts";

/** One page per rank, in the order they are reached. */
const RANKS = [...new Set(LEVELS.map((l) => l.rank))] as Rank[];

export function SkillBook() {
  const { t, i18n } = useTranslation();
  const levels = useQuest((s) => s.levels);
  const [open, setOpen] = useState(false);
  if (!levels?.unlocks.skillBook) return null;
  const stamps = new Map(levels.stamps.map((s) => [s.levelId, s]));
  return (
    <div className="skillbook">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t("skills.title")}</button>
      {open && (
        <section className="skill-panel" aria-label={t("skills.title")}>
          {RANKS.map((rank) => (
            <section key={rank} className="skill-page">
              <h2>{t(`skills.rank.${rank}`)}</h2>
              <ol>
                {LEVELS.filter((l) => l.rank === rank).map((l) => {
                  const s = stamps.get(l.id);
                  return (
                    <li key={l.id} className={s ? "earned" : "outline"}>
                      <span className="stamp" aria-hidden="true">{s ? "✓" : ""}</span>
                      <span className="skill-text">
                        <b>{t(`levels.${l.id}.skill`)}</b>
                        {s ? (
                          <small>
                            <time dateTime={s.stampedAt}>{new Date(s.stampedAt).toLocaleDateString(i18n.resolvedLanguage)}</time>
                            {" · "}
                            {s.proof.startsWith("https://") ? <a href={s.proof} target="_blank" rel="noreferrer">{t("skills.proof")}</a> : t("skills.tutorial")}
                          </small>
                        ) : <small>{t("skills.notYet")}</small>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </section>
      )}
    </div>
  );
}
