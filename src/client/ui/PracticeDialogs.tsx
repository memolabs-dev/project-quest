// The practice site's three gestures: found it, write an issue, take one. Each dialog asks, then shows exactly
// what will be sent to GitHub, then sends only on the player's click. On the demo site nothing can be sent.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { PreparedPractice } from "../../shared/api.ts";
import type { PreparedAsk } from "../../shared/gestures/real.ts";
import { BULLETIN_STATUSES, type PreparedTeam, type TeamArgs, type TeamKind } from "../../shared/gestures/team.ts";
import { PARCELS, SIZES } from "../../shared/levels/parcels.ts";
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
function summarize(p: PreparedPractice | PreparedAsk | PreparedTeam, t: TFunction): string {
  switch (p.kind) {
    case "team-found": case "parcels": case "label": case "duplicate": case "checklist": case "size":
    case "sprint-field": case "load": case "unload": case "milestone": case "attach": case "split": case "rope":
    case "bulletin": case "wip-limit": case "team-day": case "finish": case "close-visit": case "move-visit":
      return t(`team.summary.${p.kind}`, {
        repo: p.repo, ...p.args, items: (p.args.items ?? []).length,
        count: p.kind === "milestone" ? (p.args.issues ?? []).length : p.kind === "split" ? p.mutations.length / 3
          : p.kind === "team-day" ? p.mutations.length : p.mutations.length / 2,
      });
    case "ask": return t("practice.summary.ask", { number: p.issueNumber, repo: p.repo, comment: p.comment });
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
    case "mayor": return t("practice.summary.mayor", { branch: p.branch, repo: p.repo });
  }
}

/** The second step, shared by the gestures: what leaves for GitHub, then Send or Back. */
function Preview({ prepared, note, onBack }: { prepared: PreparedPractice | PreparedAsk | PreparedTeam; note?: string; onBack(): void }) {
  const { t } = useTranslation();
  const canWrite = useQuest((s) => s.levels?.canWrite ?? false);
  const closePractice = useQuest((s) => s.openPractice);
  const closeTeam = useQuest((s) => s.openTeam);
  const close = (v: null) => { closePractice(v); closeTeam(v); };
  const refresh = useQuest((s) => s.refresh);
  const setLevels = useQuest((s) => s.setLevels);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setState("sending");
    setError(null);
    try {
      const r = prepared.kind === "ask" ? await api.applyAsk(prepared)
        : "args" in prepared ? await api.applyTeam(prepared) : await api.applyPractice(prepared);
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
      {prepared.kind === "edit" && <pre className="file-text" tabIndex={0} aria-label={prepared.path}>{prepared.content}</pre>}
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
function useTwoSteps<P extends PreparedPractice | PreparedAsk | PreparedTeam>() {
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

/** The trowel: the README's whole new text and a message; the confirmation shows both before anything is sent. */
function EditDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const practice = useQuest((s) => s.levels?.practice);
  const [content, setContent] = useState(practice?.readme ?? `# ${practice?.name ?? ""}\n`);
  const [message, setMessage] = useState("");
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareEdit>>>();
  const issue = practice?.issue ?? null;
  return (
    <Dialog title={t("practice.edit.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          {issue === null && <p className="error" role="alert">{t("practice.blockedIssue")}</p>}
          {practice && practice.readme === null && <p className="practice-note">{t("practice.edit.foundation")}</p>}
          <label className="field">{t("practice.edit.contentLabel")}<textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} /></label>
          <label className="field">{t("practice.edit.messageLabel")}<input value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" disabled={issue === null || !message.trim()} onClick={() => void step.run(() => api.prepareEdit(issue!, content, message))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function PullDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const issue = useQuest((s) => s.levels?.practice.issue ?? null);
  // The Team leader opens the pull request from the branch pushed from their machine.
  const branch = useQuest((s) => (s.levels?.current === "a14-fix-from-machine" ? s.levels.practice.workBranch ?? undefined : undefined));
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const step = useTwoSteps<Awaited<ReturnType<typeof api.preparePull>>>();
  return (
    <Dialog title={t("practice.pull.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          <label className="field">{t("practice.pull.titleLabel")}<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field">{t("practice.pull.whyLabel")}<textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></label>
          {issue !== null ? <p className="practice-note">{t("practice.pull.closes", { number: issue })}</p>
            : <p className="error" role="alert">{t("practice.blockedIssue")}</p>}
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" disabled={issue === null || !title.trim()} onClick={() => void step.run(() => api.preparePull(issue!, title, why, branch))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function MergeDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const pull = useQuest((s) => s.levels?.practice.pull ?? null);
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareMerge>>>();
  return (
    <Dialog title={t("practice.merge.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          {pull !== null ? <p>{t("practice.merge.body", { number: pull })}</p> : <p className="error" role="alert">{t("practice.blockedPull")}</p>}
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" disabled={pull === null} onClick={() => void step.run(() => api.prepareMerge(pull!))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function MayorDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareMayor>>>();
  return (
    <Dialog title={t("practice.mayor.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          <p>{t("practice.mayor.body")}</p>
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" onClick={() => void step.run(() => api.prepareMayor())}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

/** Level 16: one comment on the real project's issue, in the player's words. Nobody is assigned. */
function AskDialog() {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openPractice);
  const issue = useQuest((s) => s.askIssue);
  const title = useQuest((s) => s.site?.pallets.find((p) => p.number === s.askIssue)?.title ?? "");
  const [comment, setComment] = useState(t("practice.ask.comment"));
  const step = useTwoSteps<Awaited<ReturnType<typeof api.prepareAsk>>>();
  return (
    <Dialog title={t("practice.ask.title")}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          <p className="move">#{issue} {title}</p>
          <p>{t("practice.ask.body")}</p>
          <label className="field">{t("practice.ask.commentLabel")}<textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" disabled={issue === null || !comment.trim()} onClick={() => void step.run(() => api.prepareAsk(issue!, comment))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

const DIALOGS = { ask: AskDialog, mayor: MayorDialog, found: FoundDialog, write: WriteDialog, take: TakeDialog, edit: EditDialog, pull: PullDialog, merge: MergeDialog };

const NO_LABELS: string[] = [];

/** The lead's gestures on the team site: one small form each, then the exact request. */
const NO_MILESTONES: { number: number; title: string; dueOn: string | null; openIssues: number }[] = [];
/** A visit moved a week later by default: a day the player can change. */
const weekAfter = (dueOn: string | null) =>
  new Date(Date.parse(`${(dueOn ?? new Date().toISOString()).slice(0, 10)}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
/** The mayor's visit, two weeks ahead by default: a day the player can change. */
const inTwoWeeks = () => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

function TeamDialog({ kind, issue }: { kind: TeamKind; issue?: number }) {
  const { t } = useTranslation();
  const close = useQuest((s) => s.openTeam);
  // Select stable references from the store, then derive: a selector that builds a new list loops forever.
  const teamLabels = useQuest((s) => s.levels?.team.labels);
  const teamMilestones = useQuest((s) => s.levels?.team.milestones);
  const pallets = useQuest((s) => s.site?.pallets);
  const labels = teamLabels ?? NO_LABELS;
  const milestones = teamMilestones ?? NO_MILESTONES;
  const open = (pallets ?? []).filter((p) => !p.closed);
  const others = open.filter((p) => p.number !== issue);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [label, setLabel] = useState(labels[0] ?? "");
  const [original, setOriginal] = useState<number | null>(others[0]?.number ?? null);
  const [items, setItems] = useState("");
  const [size, setSize] = useState<string>(SIZES[1]);
  const [title, setTitle] = useState(() => t("team.milestone.default"));
  const [dueOn, setDueOn] = useState(inTwoWeeks);
  const [chosen, setChosen] = useState<number[]>([]);
  const [milestone, setMilestone] = useState<number | null>(milestones[0]?.number ?? null);
  const radio = useQuest((s) => s.levels?.team.radio ?? "");
  const [status, setStatus] = useState<string>("ON_TRACK");
  const [body, setBody] = useState(radio);
  const [limit, setLimit] = useState(3);
  const [later, setLater] = useState(() => weekAfter(milestones[0]?.dueOn ?? null));
  const step = useTwoSteps<PreparedTeam>();
  const args: TeamArgs = kind === "team-found" ? { visibility }
    : kind === "label" ? { issueNumber: issue, label }
      : kind === "duplicate" ? { issueNumber: issue, original: original ?? undefined }
        : kind === "checklist" ? { issueNumber: issue, items: items.split("\n") }
          : kind === "size" ? { issueNumber: issue, size }
            : kind === "load" || kind === "unload" ? { issueNumber: issue }
              : kind === "milestone" ? { title, dueOn, issues: chosen }
                : kind === "attach" ? { issueNumber: issue, milestone: milestone ?? undefined }
                  : kind === "split" ? { issueNumber: issue, titles: items.split("\n") }
                    : kind === "rope" ? { issueNumber: issue, blocking: original ?? undefined }
                      : kind === "bulletin" ? { status, body }
                        : kind === "wip-limit" ? { limit }
                          : kind === "finish" ? { issueNumber: issue }
                            : kind === "close-visit" ? { milestone: milestone ?? undefined }
                              : kind === "move-visit" ? { milestone: milestone ?? undefined, dueOn: later } : {};
  return (
    <Dialog title={t(`team.${kind}.title`, { number: issue })}>
      {step.prepared ? <Preview prepared={step.prepared} onBack={step.back} /> : (
        <>
          <p>{t(`team.${kind}.body`, { number: issue })}</p>
          {kind === "team-found" && (
            <fieldset className="choice">
              <legend>{t("practice.found.visibility")}</legend>
              <label><input type="radio" name="tvis" checked={visibility === "PRIVATE"} onChange={() => setVisibility("PRIVATE")} /> {t("practice.found.private")}</label>
              <label><input type="radio" name="tvis" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")} /> {t("practice.found.public")}</label>
            </fieldset>
          )}
          {kind === "parcels" && <ul className="parcel-list">{PARCELS.map((p) => <li key={p.key}>{p.title}</li>)}</ul>}
          {kind === "label" && (
            <label className="field">{t("team.label.field")}
              <select value={label} onChange={(e) => setLabel(e.target.value)}>{labels.map((l) => <option key={l} value={l}>{l}</option>)}</select>
            </label>
          )}
          {kind === "duplicate" && (
            <label className="field">{t("team.duplicate.field")}
              <select value={original ?? ""} onChange={(e) => setOriginal(Number(e.target.value))}>
                {others.map((p) => <option key={p.number} value={p.number}>#{p.number} {p.title}</option>)}
              </select>
            </label>
          )}
          {kind === "checklist" && (
            <label className="field">{t("team.checklist.field")}<textarea rows={4} value={items} onChange={(e) => setItems(e.target.value)} /></label>
          )}
          {kind === "size" && (
            <label className="field">{t("team.size.field")}
              <select value={size} onChange={(e) => setSize(e.target.value)}>{SIZES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </label>
          )}
          {kind === "milestone" && <>
            <label className="field">{t("team.milestone.field")}<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="field">{t("team.milestone.due")}<input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></label>
            <fieldset className="choice">
              <legend>{t("team.milestone.jobs")}</legend>
              {open.map((p) => (
                <label key={p.number}>
                  <input type="checkbox" checked={chosen.includes(p.number)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, p.number] : c.filter((n) => n !== p.number)))} /> #{p.number} {p.title}
                </label>
              ))}
            </fieldset>
          </>}
          {kind === "attach" && (
            <label className="field">{t("team.attach.field")}
              <select value={milestone ?? ""} onChange={(e) => setMilestone(Number(e.target.value))}>
                {milestones.map((m) => <option key={m.number} value={m.number}>{m.title}</option>)}
              </select>
            </label>
          )}
          {kind === "bulletin" && <>
            <fieldset className="choice">
              <legend>{t("team.bulletin.status")}</legend>
              {BULLETIN_STATUSES.map((s) => (
                <label key={s}><input type="radio" name="bstatus" checked={status === s} onChange={() => setStatus(s)} /> {t(`team.bulletin.statuses.${s}`)}</label>
              ))}
            </fieldset>
            <label className="field">{t("team.bulletin.field")}<textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          </>}
          {kind === "wip-limit" && (
            <label className="field">{t("team.wip-limit.field")}
              <input type="number" min={1} max={10} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            </label>
          )}
          {(kind === "close-visit" || kind === "move-visit") && (
            <label className="field">{t("team.attach.field")}
              <select value={milestone ?? ""} onChange={(e) => setMilestone(Number(e.target.value))}>
                {milestones.map((m) => <option key={m.number} value={m.number}>{m.title} ({m.dueOn?.slice(0, 10) ?? "?"})</option>)}
              </select>
            </label>
          )}
          {kind === "move-visit" && (
            <label className="field">{t("team.move-visit.field")}<input type="date" value={later} onChange={(e) => setLater(e.target.value)} /></label>
          )}
          {kind === "split" && (
            <label className="field">{t("team.split.field")}<textarea rows={4} value={items} onChange={(e) => setItems(e.target.value)} /></label>
          )}
          {kind === "rope" && (
            <label className="field">{t("team.rope.field")}
              <select value={original ?? ""} onChange={(e) => setOriginal(Number(e.target.value))}>
                {others.map((p) => <option key={p.number} value={p.number}>#{p.number} {p.title}</option>)}
              </select>
            </label>
          )}
          {step.error && <p className="error" role="alert">{step.error}</p>}
          <div className="actions">
            <button type="button" className="primary" onClick={() => void step.run(() => api.prepareTeam(kind, args))}>{t("practice.prepare")}</button>
            <button type="button" onClick={() => close(null)}>{t("confirm.cancel")}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function PracticeDialogs() {
  const d = useQuest((s) => s.practiceDialog);
  const team = useQuest((s) => s.teamDialog);
  if (team) return <TeamDialog key={`${team.kind}-${team.issue ?? ""}`} kind={team.kind} issue={team.issue} />;
  const Open = d ? DIALOGS[d] : null;
  return Open ? <Open /> : null;
}
