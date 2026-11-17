// The practice site's three gestures: found it, write an issue, take one. Each dialog asks, then shows exactly
// what will be sent to GitHub, then sends only on the player's click. On the demo site nothing can be sent.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { PreparedPractice } from "../../shared/api.ts";
import { ApiFailure, api } from "../api.ts";
import { useQuest } from "../store.ts";

function Dialog({ title, children }: { title: string; children: ReactNode }) {
  const close = useQuest((s) => s.openPractice);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(null); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div ref={ref} className="confirm practice" role="dialog" aria-modal="true" aria-labelledby="practice-title">
      <h2 id="practice-title">{title}</h2>
      {children}
    </div>
  );
}

/** What a gesture will do, in one plain sentence, above the exact request. */
function summarize(p: PreparedPractice, t: TFunction): string {
  switch (p.kind) {
    case "found":
      return t(p.reuse ? "practice.summary.foundReuse" : "practice.summary.found", {
        owner: p.owner, name: p.name, visibility: t(`practice.summary.${p.visibility === "PUBLIC" ? "public" : "private"}`),
      });
    case "issue": return t("practice.summary.issue", { title: p.title, repo: p.repo });
    case "take": return t("practice.summary.take", { number: p.issueNumber, repo: p.repo, comment: p.comment });
    case "edit":
      return [p.foundation ? t("practice.summary.foundation", { repo: p.repo }) : "", t("practice.summary.edit", { path: p.path, branch: p.branch, message: p.message })]
        .filter(Boolean).join(" ");
    case "pull": return t("practice.summary.pull", { branch: p.branch, title: p.title, number: p.issueNumber });
    case "merge": return t("practice.summary.merge", { number: p.pullNumber, repo: p.repo });
  }
}

/** The second step, shared by the gestures: what leaves for GitHub, then Send or Back. */
function Preview({ prepared, note, onBack }: { prepared: PreparedPractice; note?: string; onBack(): void }) {
  const { t } = useTranslation();
  const canWrite = useQuest((s) => s.levels?.canWrite ?? false);
  const close = useQuest((s) => s.openPractice);
  const refresh = useQuest((s) => s.refresh);
  const setLevels = useQuest((s) => s.setLevels);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setState("sending");
    setError(null);
    try {
      const r = await api.applyPractice(prepared);
      if (r.ok) {
        setLevels(r.levels);
        close(null);
        await refresh();
      } else {
        setError([t("confirm.github", { message: r.message }), r.applied.length ? t("practice.applied", { list: r.applied.join(", ") }) : ""].join(" "));
      }
    } catch (e) {
      setError(e instanceof ApiFailure ? ("hint" in e.body ? `${e.message} (${e.body.hint})` : e.message) : t("errors.generic"));
    } finally {
      setState("idle");
    }
  };

  const summary = summarize(prepared, t);
  return (
    <>
      <p className="move">{summary}</p>
      {note && <p className="practice-note">{note}</p>}
      <p className="payload-label">{t("confirm.payload")}</p>
      <pre className="payload">{JSON.stringify(prepared.mutations, null, 2)}</pre>
      {!canWrite && <p className="practice-note">{t("mentor.connectGithub")}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        {canWrite && (
          <button type="button" className="primary" disabled={state === "sending"} onClick={() => void send()}>
            {state === "sending" ? t("confirm.sending") : t("confirm.send")}
          </button>
        )}
        <button type="button" onClick={onBack}>{t("practice.back")}</button>
      </div>
    </>
  );
}

/** Asks, then shows the prepared gesture; `prepare` throws an ApiFailure the dialog explains. */
function useTwoSteps<P extends PreparedPractice>() {
  const { t } = useTranslation();
  const [prepared, setPrepared] = useState<P | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (prepare: () => Promise<P>) => {
    setError(null);
    try {
      setPrepared(await prepare());
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : t("errors.generic"));
    }
  };
  return { prepared, back: () => setPrepared(null), error, run };
}

function FoundDialog() {
  const { t } = useTranslation();
  const name = useQuest((s) => s.levels?.practice.name ?? "");
  const close = useQuest((s) => s.openPractice);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareFound>>>();
  return (
    <Dialog title={t("practice.found.title")}>
      {step.prepared ? (
        <Preview prepared={step.prepared} note={step.prepared.reuse ? t("practice.found.reuse", { name }) : undefined} onBack={step.back} />
      ) : (
        <>
          <p>{t("practice.found.body", { name })}</p>
          <fieldset className="choice">
            <legend>{t("practice.found.visibility")}</legend>
            <label><input type="radio" name="visibility" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")} /> {t("practice.found.public")}</label>
            <label><input type="radio" name="visibility" checked={visibility === "PRIVATE"} onChange={() => setVisibility("PRIVATE")} /> {t("practice.found.private")}</label>
          </fieldset>
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" onClick={() => void step.run(() => api.prepareFound(visibility))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function WriteDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareIssue>>>();
  return (
    <Dialog title={t("practice.write.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          <label className="field">{t("practice.write.titleLabel")}<input value={title} maxLength={256} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field">{t("practice.write.bodyLabel")}<textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" disabled={!title.trim()} onClick={() => void step.run(() => api.prepareIssue(title, body))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function TakeDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const site = useQuest((s) => s.site);
  const open = (site?.pallets ?? []).filter((p) => !p.closed);
  const [issue, setIssue] = useState<number | null>(open[0]?.number ?? null);
  const [comment, setComment] = useState(t("practice.take.comment"));
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareTake>>>();
  return (
    <Dialog title={t("practice.take.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : open.length === 0 ? (
        <>
          <p>{t("practice.take.none")}</p>
          <div className="actions"><button type="button" onClick={() => close(null)}>{t("card.close")}</button></div>
        </>
      ) : (
        <>
          <label className="field">{t("practice.take.issueLabel")}
            <select value={issue ?? ""} onChange={(e) => setIssue(Number(e.target.value))}>
              {open.map((p) => <option key={p.number} value={p.number}>#{p.number} {p.title}</option>)}
            </select>
          </label>
          <label className="field">{t("practice.take.commentLabel")}<textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" disabled={issue === null || !comment.trim()} onClick={() => void step.run(() => api.prepareTake(issue!, comment))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function PracticeDialogs() {
  const d = useQuest((s) => s.practiceDialog);
  if (d === "found") return <FoundDialog />;
  if (d === "write") return <WriteDialog />;
  if (d === "take") return <TakeDialog />;
  return null;
}
