// The skill book: one stamp per level, with its date and its proof on GitHub; the next ones in outline,
// so what comes next is always in sight. Only the player's own: nothing here compares people.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LEVELS } from "../../shared/levels/index.ts";
import type { Path, Rank } from "../../shared/levels/types.ts";
import { api } from "../api.ts";
import { canFollow } from "../levels.ts";
import { useQuest } from "../store.ts";

/** One page per rank, in the order they are reached, for one path. */
const ranksOf = (path: Path) => [...new Set(LEVELS.filter((l) => l.path === path).map((l) => l.rank))] as Rank[];

export function SkillBook() {
  const { t, i18n } = useTranslation();
  const levels = useQuest((s) => s.levels);
  const setLevels = useQuest((s) => s.setLevels);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Path | null>(null);
  if (!levels || (!levels.unlocks.skillBook && levels.path !== "lead")) return null;
  const path: Path = shown ?? levels.path ?? "volunteer";
  const follow = async (p: Path) => {
    try {
      setLevels(await api.choosePath(p));
    } catch {
      // The choice can be made again.
    }
  };
  const stamps = new Map(levels.stamps.map((s) => [s.levelId, s]));
  return (
    <div className="skillbook">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t("skills.title")}</button>
      {open && (
        <section className="skill-panel" aria-label={t("skills.title")}>
          <div className="skill-paths" role="tablist">
            {(["volunteer", "lead"] as Path[]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={p === path} onClick={() => setShown(p)}>{t(`skills.paths.${p}`)}</button>
            ))}
          </div>
          {canFollow(levels, path) && (
            <button type="button" className="follow-path" onClick={() => void follow(path)}>{t("skills.follow")}</button>
          )}
          {ranksOf(path).map((rank) => (
            <section key={rank} className="skill-page">
              <h2>{t(`skills.rank.${rank}`)}</h2>
              <ol>
                {LEVELS.filter((l) => l.path === path && l.rank === rank).map((l) => {
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
