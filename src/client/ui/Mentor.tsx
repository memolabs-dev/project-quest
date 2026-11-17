// Mémé Truelle's bubble: the current level's lesson and goal, one action, "check again", and a cheer when
// GitHub confirms a level. She can be folded away so the site stays in full view.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commandsFor, safeBranch } from "../commands.ts";
import { api } from "../api.ts";
import { SIZE_POINTS } from "../../shared/levels/lead.ts";
import { boardCatchingUp, capacityEditable, limitEditable, mentorAction, noOpenVisit, needsPath, newStamps, noGoodFirst, speakerOf } from "../levels.ts";
import { useQuest } from "../store.ts";

const CHEER_MS = 4000;
const NO_PALLETS: { goodFirst: boolean; closed: boolean }[] = [];

/** The commands to type on the player's machine, one Copy button each. The game never runs them. */
function Commands({ level }: { level: string }) {
  const { t } = useTranslation();
  const practice = useQuest((s) => s.levels?.practice);
  const repo = useQuest((s) => (s.levels ? `${s.levels.login}/${s.levels.practice.name}` : ""));
  const [copied, setCopied] = useState<number | null>(null);
  if (!practice) return null;
  const branch = practice.workBranch && safeBranch(practice.workBranch) ? practice.workBranch : `work-${practice.issue ?? 1}`;
  const lines = commandsFor(level, { nameWithOwner: repo, defaultBranch: practice.defaultBranch ?? "main" }, branch);
  if (lines.length === 0) return null;
  const copy = async (i: number, line: string) => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(i);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };
  return (
    <div className="mentor-commands">
      <p>{t("mentor.commands")}</p>
      <ol>
        {lines.map((line, i) => line.startsWith("#") ? (
          <li key={i} className="command-step">{line.slice(2)}</li>
        ) : (
          <li key={i}>
            <code>{line}</code>
            <button type="button" aria-label={`${t("mentor.copy")}: ${line}`} onClick={() => void copy(i, line)}>
              {copied === i ? t("mentor.copied") : t("mentor.copy")}
            </button>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{copied !== null ? t("mentor.copied") : ""}</p>
    </div>
  );
}

/** The sprint's capacity: the game's rule, said as such, with the points each size counts. */
function Capacity({ initial }: { initial: number | null }) {
  const { t } = useTranslation();
  const setLevels = useQuest((s) => s.setLevels);
  const [points, setPoints] = useState(initial ?? 8);
  const [error, setError] = useState(false);
  const save = async () => {
    try {
      setLevels(await api.setCapacity(points));
    } catch {
      setError(true);
    }
  };
  return (
    <div className="mentor-capacity">
      <p>{t("mentor.sprint.rule", { points: Object.entries(SIZE_POINTS).map(([s, n]) => `${s} ${n}`).join(", ") })}</p>
      <label className="field">{t("mentor.sprint.capacity")}
        <input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
      </label>
      {error && <p className="error" role="alert">{t("mentor.sprint.refused")}</p>}
      <button type="button" className="primary" onClick={() => void save()}>{t("mentor.sprint.save")}</button>
    </div>
  );
}

export function Mentor() {
  const { t } = useTranslation();
  const levels = useQuest((s) => s.levels);
  const before = useQuest((s) => s.levelsBefore);
  const kind = useQuest((s) => s.siteKind);
  const pallets = useQuest((s) => s.site?.pallets ?? NO_PALLETS);
  const refreshLevels = useQuest((s) => s.refreshLevels);
  const openPractice = useQuest((s) => s.openPractice);
  const openTeam = useQuest((s) => s.openTeam);
  const setLevels = useQuest((s) => s.setLevels);
  const [folded, setFolded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const [notYet, setNotYet] = useState(false);
  const [changing, setChanging] = useState(false);

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
  const speaker = current ? speakerOf(current) : "meme";
  const choose = async (path: "volunteer" | "lead") => {
    try {
      setLevels(await api.choosePath(path));
    } catch {
      // The choice can be made again; nothing was lost.
    }
  };

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
        <span className="mentor-face" aria-hidden="true">{t(`speakers.${speaker}`).charAt(0)}</span>
        <b>{t(`speakers.${speaker}`)}</b>
        <button type="button" className="mentor-fold" aria-label={t("mentor.fold")} onClick={() => setFolded(true)}>×</button>
      </div>
      {needsPath(levels) ? (
        <>
          <p>{t("mentor.hello")}</p>
          <p className="mentor-goal">{t("mentor.choose.question")}</p>
          <div className="mentor-actions">
            <button type="button" className="primary" onClick={() => void choose("volunteer")}>{t("mentor.choose.volunteer")}</button>
            <button type="button" className="primary" onClick={() => void choose("lead")}>{t("mentor.choose.lead")}</button>
          </div>
        </>
      ) : cheer ? (
        <p className="mentor-cheer">
          <span className="stamp" aria-hidden="true">✓</span> {t("mentor.stamped", { skill: t(`levels.${cheer}.skill`) })} {t(`levels.${cheer}.done`)}
        </p>
      ) : current === null ? (
        <p>{t(`mentor.rankDone.${levels.rank ?? "apprentice"}`)}</p>
      ) : (
        <>
          {levels.stamps.length === 0 && <p>{t("mentor.hello")}</p>}
          <p>{t(`levels.${current}.lesson`)}</p>
          <p className="mentor-goal">{t(`levels.${current}.goal`)}</p>
          {kind === "main" && noGoodFirst(levels, pallets) && <p className="mentor-notyet">{t("mentor.noGoodFirst")}</p>}
          {boardCatchingUp(levels, kind, pallets.length) && <p className="mentor-notyet">{t("mentor.boardCatchingUp")}</p>}
          {current === "a10-answer-review" && (
            <p className="mentor-inspector"><b>{t("inspector.name")}</b><br />{t("inspector.remark")}</p>
          )}
          {current === "l5-sprint" && levels.team.sprint.current && levels.team.sprint.capacity !== null && (
            <p className="mentor-load">
              {t("mentor.sprint.load", { sprint: levels.team.sprint.current, points: levels.team.sprint.points, capacity: levels.team.sprint.capacity })}
              {levels.team.sprint.points > levels.team.sprint.capacity && <> {t("mentor.sprint.over")}</>}
              {levels.team.sprint.unsized.length > 0 && <> {t("mentor.sprint.unsized", { numbers: levels.team.sprint.unsized.map((n) => `#${n}`).join(", ") })}</>}
            </p>
          )}
          {notYet && <p className="mentor-notyet">{t("mentor.notYet")}</p>}
        </>
      )}
      {action === "commands" && current && <Commands level={current} />}
      {!needsPath(levels) && <div className="mentor-actions">
        {action === "to-tutorial" && <a className="primary" href="?demo=1">{t("mentor.toTutorial")}</a>}
        {action === "to-practice" && <a className="primary" href="?site=practice">{t("mentor.toPractice")}</a>}
        {action === "to-main" && <a className="primary" href="./">{t("mentor.toMain")}</a>}
        {action === "to-team" && <a className="primary" href="?site=team">{t("mentor.toTeam")}</a>}
        {(action === "found-team" || action === "parcels" || action === "sprint-field" || action === "milestone"
          || action === "bulletin" || action === "wip-limit" || action === "team-day") && (
          <button type="button" className="primary" onClick={() => openTeam({ kind: action === "found-team" ? "team-found" : action })}>
            {t(`team.${action}.open`)}
          </button>
        )}
        {action === "visit" && <>
          <button type="button" className="primary" onClick={() => openTeam({ kind: "close-visit" })}>{t("team.close-visit.open")}</button>
          <button type="button" onClick={() => openTeam({ kind: "move-visit" })}>{t("team.move-visit.open")}</button>
        </>}
        {limitEditable(levels) && (
          <button type="button" onClick={() => openTeam({ kind: "wip-limit" })}>{t("mentor.changeLimit")}</button>
        )}
        {noOpenVisit(levels) && <p className="mentor-notyet">{t("mentor.noVisit")}</p>}
        {current === "l2-sort-parcels" && levels.team.duplicateWrong && <p className="mentor-notyet">{t("mentor.duplicateReason")}</p>}
        {current === "l10-wip" && levels.team.wip.limit !== null && (
          <p className="mentor-load">{t("mentor.wip", { count: levels.team.wip.count, limit: levels.team.wip.limit })}</p>
        )}
        {action === "capacity" && <Capacity initial={null} />}
        {action !== "capacity" && capacityEditable(levels) && (changing
          ? <Capacity initial={levels.team.sprint.capacity} />
          : <button type="button" onClick={() => setChanging(true)}>{t("mentor.sprint.change")}</button>)}
        {action !== null && action !== "to-tutorial" && action !== "to-practice" && action !== "to-main" && action !== "to-team"
          && action !== "found-team" && action !== "parcels" && action !== "sprint-field" && action !== "milestone" && action !== "capacity"
          && action !== "bulletin" && action !== "wip-limit" && action !== "team-day" && action !== "visit"
          && action !== "move" && action !== "commands" && (
          <button type="button" className="primary" onClick={() => openPractice(action)}>{t(`practice.${action}.open`)}</button>
        )}
        {current !== null && (
          <button type="button" disabled={checking} onClick={() => void check()}>{t("mentor.checkAgain")}</button>
        )}
      </div>}
    </aside>
  );
}
