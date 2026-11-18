// Answering someone who waits and welcoming a newcomer (welcome and answer spec, section 5): the dialog with a draft in
// the player's own language, then the confirmation that shows exactly what will be sent. One comment, nothing else.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PreparedTalk, TalkKind } from "../../shared/gestures/talk.ts";
import { ApiFailure, api } from "../api.ts";
import { useQuest } from "../store.ts";
import { answerDraft, welcomeDraft } from "../talk.ts";
import { Modal } from "./Modal.tsx";

/** What the dialog is about: the person, what they wrote or their pull request, and the draft to start from. */
interface Subject { kind: TalkKind; number: number; login: string; draft: string; said: string; title: string | null; url: string | null }

export function TalkDialog() {
  const { t } = useTranslation();
  const talk = useQuest((s) => s.talk);
  const people = useQuest((s) => s.site?.people);
  const openTalk = useQuest((s) => s.openTalk);
  const w = talk?.kind === "answer" ? people?.waiting.find((x) => x.pallet === talk.number) : undefined;
  const n = talk?.kind === "welcome" ? people?.newcomers.find((x) => x.pr.number === talk.number) : undefined;
  // The sign went away while the dialog was open (the team answered, the pull request was welcomed): nothing to say any more.
  const gone = talk !== null && !w && !n;
  useEffect(() => { if (gone) openTalk(null); }, [gone, openTalk]);
  const say = (key: string, o?: Record<string, unknown>) => t(key, o ?? {});
  const subject: Subject | null = !talk ? null
    : w ? { kind: "answer", number: talk.number, login: w.login, draft: answerDraft(w.excerpt, say), said: w.excerpt, title: null, url: null }
    : n ? { kind: "welcome", number: talk.number, login: n.login, draft: welcomeDraft(n.login, n.contributingUrl, say), said: "", title: n.pr.title, url: n.pr.url }
    : null;
  if (!subject) return null;
  return <TalkForm key={`${subject.kind}:${subject.number}`} subject={subject} />;
}

function TalkForm({ subject }: { subject: Subject }) {
  const { t } = useTranslation();
  const confirming = useQuest((s) => s.talkPrepared !== null);
  const pallet = useQuest((s) => s.site?.pallets.find((p) => p.number === subject.number));
  const openTalk = useQuest((s) => s.openTalk);
  const setPrepared = useQuest((s) => s.setTalkPrepared);
  const say = useQuest((s) => s.say);
  const [words, setWords] = useState(subject.draft);
  const area = useRef<HTMLTextAreaElement>(null);
  // The answer starts under the quote: the caret goes to the end of the draft.
  useEffect(() => { area.current?.setSelectionRange(subject.draft.length, subject.draft.length); }, [subject.draft]);
  // While the confirmation shows what leaves, the words wait here, kept: Cancel there comes back to them.
  if (confirming) return null;

  const go = async () => {
    // A quote alone is not an answer.
    if (subject.kind === "answer" && words.trim() === subject.draft.trim()) {
      say(t("talk.writeFirst"));
      return;
    }
    try {
      setPrepared(await api.prepareTalk(subject.kind, subject.number, words));
    } catch (e) {
      say(e instanceof ApiFailure ? e.message : t("errors.generic"));
    }
  };

  return (
    <Modal labelledBy="talk-title" focus="textarea" onEscape={() => openTalk(null)}>
      <h2 id="talk-title">{subject.kind === "answer"
        ? t("talk.answerTitle", { login: subject.login, number: subject.number }) : t("talk.welcomeTitle", { login: subject.login })}</h2>
      {subject.kind === "answer" ? (
        <>
          {pallet && <p className="issue" dir="auto">{pallet.title}</p>}
          <p className="payload-label">{t("talk.wrote", { login: subject.login })}</p>
          <blockquote className="warm-words" dir="auto">{subject.said}</blockquote>
        </>
      ) : (
        <>
          <p className="payload-label">{t("talk.theirPull")}</p>
          <p className="issue" dir="auto">#{subject.number} {subject.title}</p>
          {subject.url && <p><a href={subject.url} target="_blank" rel="noreferrer">{subject.url}</a></p>}
        </>
      )}
      <label className="field">{t("talk.words")}
        <textarea ref={area} rows={7} value={words} onChange={(e) => setWords(e.target.value)} />
      </label>
      <p className="hint">{t("warm.noMention")}</p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => void go()}>{t("warm.show")}</button>
        <button type="button" onClick={() => openTalk(null)}>{t("confirm.cancel")}</button>
      </div>
    </Modal>
  );
}

/** The confirmation of a talk: who it is for, where it goes, the exact words, who they notify, and the exact request. */
export function ConfirmTalk() {
  const { t } = useTranslation();
  const prepared = useQuest((s) => s.talkPrepared);
  const setPrepared = useQuest((s) => s.setTalkPrepared);
  const openTalk = useQuest((s) => s.openTalk);
  const refresh = useQuest((s) => s.refresh);
  const setLevels = useQuest((s) => s.setLevels);
  const announce = useQuest((s) => s.announce);
  const say = useQuest((s) => s.say);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const sendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (prepared) sendRef.current?.focus(); }, [prepared]);
  if (!prepared) return null;

  const send = async (p: PreparedTalk) => {
    // One send at a time: a second click while the first is on its way does nothing.
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const r = await api.applyTalk(p);
      if (r.ok) {
        if (r.levels) setLevels(r.levels);
        setPrepared(null);
        openTalk(null);
        // The answer's site is built without the people: a full read brings them (and the bubble is gone).
        await refresh();
        say(t(`talk.done.${p.kind}`, { login: p.to }));
      } else {
        announce({ kind: "refused", pallet: p.kind === "answer" ? p.target.number : undefined });
        say(t("confirm.github", { message: r.message }));
        setPrepared(null);
      }
    } catch (e) {
      // Refused by the server (not a lead, the team spoke meanwhile): its message says why, and the site is read again.
      say(e instanceof ApiFailure ? e.message : t("errors.generic"));
      setPrepared(null);
      openTalk(null);
      void refresh();
    } finally {
      setSending(false);
      busy.current = false;
    }
  };

  return (
    // Cancel goes back to the words (kept).
    <Modal labelledBy="talk-confirm-title" busy={busy} onEscape={() => setPrepared(null)}>
      <h2 id="talk-confirm-title">{t("confirm.title")}</h2>
      <p className="move">{t(`talk.what.${prepared.kind}`, { number: prepared.target.number, login: prepared.to })}</p>
      <p className="issue" dir="auto"><a href={prepared.target.url} target="_blank" rel="noreferrer">{prepared.target.title}</a></p>
      <blockquote className="warm-words" dir="auto">{prepared.words}</blockquote>
      {prepared.mentions.length > 0 && (
        <p className="warning" role="note">{t("warm.mentions", { logins: prepared.mentions.map((m) => `@${m}`).join(", ") })}</p>
      )}
      <p className="payload-label">{t("confirm.payload")}</p>
      <pre className="payload">{JSON.stringify(prepared.mutations, null, 2)}</pre>
      <div className="actions">
        <button ref={sendRef} type="button" className="primary" disabled={sending} onClick={() => void send(prepared)}>
          {sending ? t("confirm.sending") : t("confirm.send")}
        </button>
        <button type="button" disabled={sending} onClick={() => setPrepared(null)}>{t("confirm.cancel")}</button>
      </div>
    </Modal>
  );
}
