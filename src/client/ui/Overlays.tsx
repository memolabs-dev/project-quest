// Everything over the site: the pallet card, the confirmation, the result, the logbook, the language and errors.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LoggedActionView } from "../../shared/api.ts";
import { ApiFailure, api } from "../api.ts";
import { zoneLabel } from "../i18n.ts";
import { cardGestures } from "../levels.ts";
import { zoneColor } from "../scene/colors.ts";
import { useQuest } from "../store.ts";
import { Mentor } from "./Mentor.tsx";
import { PracticeDialogs } from "./PracticeDialogs.tsx";
import { SkillBook } from "./SkillBook.tsx";

function PalletCard({ number }: { number: number }) {
  const { t } = useTranslation();
  const site = useQuest((s) => s.site);
  const open = useQuest((s) => s.open);
  const setPending = useQuest((s) => s.setPending);
  const sendEvent = useQuest((s) => s.sendEvent);
  const reading = useQuest((s) => s.siteKind === "demo" && s.levels?.current === "a2-read-issue");
  const asking = useQuest((s) => s.siteKind === "main" && s.levels?.current === "a16-ask-good-first");
  const leading = useQuest((s) => (s.siteKind === "team" && s.levels?.path === "lead" ? s.levels : null));
  const openTeam = useQuest((s) => s.openTeam);
  const ask = useQuest((s) => s.ask);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); sendEvent("card-opened"); }, [sendEvent]);
  const pallet = site?.pallets.find((p) => p.number === number);
  if (!site || !pallet) return null;
  const gestures = leading ? cardGestures(leading, pallet.number) : [];
  const workers = site.workers.filter((w) => w.carrying.includes(pallet.number));
  const zoneIndex = site.zones.find((z) => z.name === pallet.zone)?.index ?? 0;
  const titleId = `card-title-${pallet.number}`;

  const push = async (toZone: string) => {
    try {
      setPending(await api.prepareMove(pallet.itemId, toZone));
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : t("errors.generic"));
    }
  };

  return (
    <div className="card" role="dialog" aria-labelledby={titleId} style={{ borderTopColor: zoneColor(zoneIndex) }}>
      <p className="card-num">#{pallet.number}</p>
      <h2 id={titleId}>{pallet.title}</h2>
      <dl>
        <dt>{t("card.zone")}</dt>
        <dd>{zoneLabel(pallet.zone)}</dd>
        <dt>{t("card.with")}</dt>
        <dd className="people">
          {workers.length ? workers.map((w) => (
            <span key={w.login}>{w.avatarUrl && <img src={w.avatarUrl} alt="" width={22} height={22} />}{w.login}</span>
          )) : t("card.nobody")}
        </dd>
      </dl>
      {pallet.isBug && <p className="bug">{t("card.bug")}</p>}
      {pallet.closed ? <p className="move-label">{t("card.closed")}</p> : (
        <>
          <p className="move-label">{t("card.moveTo")}</p>
          <div className="zones">
            {site.zones.filter((z) => z.name !== pallet.zone).map((z) => (
              <button key={z.name} type="button" style={{ borderColor: zoneColor(z.index) }} onClick={() => void push(z.name)}>
                {zoneLabel(z.name)}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {reading && <button type="button" className="got-it" onClick={() => sendEvent("card-read")}>{t("card.gotIt")}</button>}
      {gestures.length > 0 && !pallet.closed && (
        <div className="lead-actions">
          {gestures.map((g) => (
            <button key={g} type="button" className="got-it" onClick={() => openTeam({ kind: g, issue: pallet.number })}>{t(`team.${g}.open`)}</button>
          ))}
        </div>
      )}
      {asking && pallet.goodFirst && !pallet.closed && workers.length === 0 && (
        <button type="button" className="got-it" onClick={() => ask(pallet.number)}>{t("practice.ask.open")}</button>
      )}
      <div className="card-foot">
        <a href={pallet.url} target="_blank" rel="noreferrer">{t("card.openGitHub")}</a>
        <button ref={closeRef} type="button" onClick={() => open(null)}>{t("card.close")}</button>
      </div>
    </div>
  );
}

function ConfirmMove() {
  const { t } = useTranslation();
  const pending = useQuest((s) => s.pending);
  const setPending = useQuest((s) => s.setPending);
  const setSite = useQuest((s) => s.setSite);
  const refresh = useQuest((s) => s.refresh);
  const open = useQuest((s) => s.open);
  const sendEvent = useQuest((s) => s.sendEvent);
  const refreshLevels = useQuest((s) => s.refreshLevels);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (pending) sendRef.current?.focus(); }, [pending]);

  const send = async () => {
    if (!pending) return;
    setState("sending");
    try {
      const r = await api.applyMove(pending);
      if (r.ok) {
        if (r.site) setSite(r.site);
        else await refresh();
        open(null);
        setNotice(t("confirm.done", { to: zoneLabel(pending.to) }));
        sendEvent("pallet-moved");
        if (useQuest.getState().siteKind === "practice" || useQuest.getState().siteKind === "team") void refreshLevels(true);
      } else if (r.reason === "stale") {
        setPending(null);
        await refresh();
        setNotice(t("confirm.stale", { zone: zoneLabel(r.current.status ?? "") }));
      } else {
        setNotice(t("confirm.github", { message: r.message }));
      }
    } catch (e) {
      setNotice(e instanceof ApiFailure ? e.message : t("errors.generic"));
    } finally {
      setState("idle");
    }
  };

  return (
    <>
      {pending && (
        <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <h2 id="confirm-title">{t("confirm.title")}</h2>
          <p className="move">{t("confirm.move", { number: pending.issueNumber, from: pending.from === null ? t("zones.none") : zoneLabel(pending.from), to: zoneLabel(pending.to) })}</p>
          <p className="issue">{pending.issueTitle}</p>
          <p className="payload-label">{t("confirm.payload")}</p>
          <pre className="payload">{JSON.stringify(pending.mutation, null, 2)}</pre>
          <div className="actions">
            <button ref={sendRef} type="button" className="primary" disabled={state === "sending"} onClick={() => void send()}>
              {state === "sending" ? t("confirm.sending") : t("confirm.send")}
            </button>
            <button type="button" onClick={() => setPending(null)}>{t("confirm.cancel")}</button>
          </div>
        </div>
      )}
      <div className="toast" role="status" aria-live="polite">{notice}</div>
    </>
  );
}

function Logbook() {
  const { t } = useTranslation();
  const [openLog, setOpenLog] = useState(false);
  const [rows, setRows] = useState<LoggedActionView[]>([]);
  const site = useQuest((s) => s.site);
  useEffect(() => { if (openLog) void api.log().then(setRows).catch(() => setRows([])); }, [openLog, site]);
  return (
    <div className="logbook">
      <button type="button" aria-expanded={openLog} onClick={() => setOpenLog((v) => !v)}>{t("log.title")}</button>
      {openLog && (
        <section aria-label={t("log.title")} className="log-panel">
          {rows.length === 0 ? <p>{t("log.empty")}</p> : (
            <ol>
              {rows.map((r) => (
                <li key={r.id}>
                  <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleTimeString()}</time> {r.target} · {t(`log.${r.result}`)}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <label className="lang">
      <span className="sr-only">{t("lang.label")}</span>
      <select aria-label={t("lang.label")} value={i18n.resolvedLanguage} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
        <option value="en">{t("lang.en")}</option>
        <option value="fr">{t("lang.fr")}</option>
      </select>
    </label>
  );
}

function ErrorScreen() {
  const { t } = useTranslation();
  const load = useQuest((s) => s.load);
  if (load.status !== "error") return null;
  const f = load.failure;
  const access = f instanceof ApiFailure && "hint" in f.body ? f.body : null;
  return (
    <div className="error-screen" role="alert">
      {access ? (
        <>
          <h2>{t(access.error === "github-scope" ? "errors.githubScopeTitle" : "errors.githubAuthTitle")}</h2>
          <p>{t("errors.githubAuthBody")}</p>
          <pre>{access.hint}</pre>
        </>
      ) : (
        <p>{f instanceof ApiFailure && f.body.error === "board" ? t("errors.board", { message: f.message }) : t("errors.generic")}</p>
      )}
      <a href="?demo=1">{t("errors.openDemo")}</a>
    </div>
  );
}

export function Overlays() {
  const openCard = useQuest((s) => s.openCard);
  return (
    <>
      <div className="top-right">
        <LanguageSwitch />
        <SkillBook />
        <Logbook />
      </div>
      <Mentor />
      {openCard !== null && <PalletCard key={openCard} number={openCard} />}
      <ConfirmMove />
      <PracticeDialogs />
      <ErrorScreen />
    </>
  );
}
