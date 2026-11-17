// The warm gestures over the site (people of the site spec, sections 4 and 5): the four signs, above a worker or on a
// card, and the confirmation that shows exactly what will be sent. Positive signs only; nothing is counted.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WARM_EMOJIS } from "../../shared/gestures/warm.ts";
import { ApiFailure, api } from "../api.ts";
import { useQuest } from "../store.ts";
import { GLYPH, useWarmGesture } from "./warm-gesture.ts";

/** The four signs for one pallet; a sign already given is pressed, and clicking it offers to take it back. */
export function WarmPicker({ pallet, login }: { pallet: number; login: string | null }) {
  const { t } = useTranslation();
  const given = useQuest((s) => s.site?.pallets.find((p) => p.number === pallet)?.myReactions ?? []);
  const prepare = useWarmGesture();
  const first = useRef<HTMLButtonElement>(null);
  // Above a worker the signs open at R: the first one takes the focus, so the keys go on.
  useEffect(() => { if (login) first.current?.focus(); }, [login]);
  return (
    <div className="warm-picker" role="group" aria-label={login ? t("warm.cheerWho", { login }) : t("warm.cheer")}>
      {WARM_EMOJIS.map((e, i) => {
        const pressed = given.includes(e);
        return (
          <button key={e} ref={i === 0 ? first : undefined} type="button" aria-pressed={pressed}
            aria-label={`${GLYPH[e]} ${t(pressed ? "warm.takeBack" : `warm.signs.${e}`)}`}
            onClick={() => void prepare(pressed ? "uncheer" : "cheer", { issueNumber: pallet, content: e })}>
            <span aria-hidden="true">{GLYPH[e]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The confirmation of a warm gesture: the issue, the sign, the words, who they notify, and the exact request. */
export function ConfirmWarm() {
  const { t } = useTranslation();
  const warm = useQuest((s) => s.warm);
  const setWarm = useQuest((s) => s.setWarm);
  const openPicker = useQuest((s) => s.openPicker);
  const setSite = useQuest((s) => s.setSite);
  const setLevels = useQuest((s) => s.setLevels);
  const announce = useQuest((s) => s.announce);
  const say = useQuest((s) => s.say);
  const [sending, setSending] = useState(false);
  const sendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (warm) sendRef.current?.focus(); }, [warm]);
  if (!warm) return null;

  const send = async () => {
    // One send at a time: a second click while the first is on its way does nothing.
    if (sending) return;
    setSending(true);
    try {
      const r = await api.applyWarm(warm);
      if (r.ok) {
        if (r.site) setSite(r.site);
        if (r.levels) setLevels(r.levels);
        say(t(`warm.done.${warm.kind}`, { sign: GLYPH[warm.content] }));
        setWarm(null);
        openPicker(null);
      } else {
        announce({ kind: "refused", pallet: warm.issueNumber });
        say(t("confirm.github", { message: r.message }));
        setWarm(null);
      }
    } catch (e) {
      say(e instanceof ApiFailure ? e.message : t("errors.generic"));
      setWarm(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="warm-title">
      <h2 id="warm-title">{t("confirm.title")}</h2>
      <p className="move">{t(`warm.what.${warm.kind}`, { sign: GLYPH[warm.content], number: warm.issueNumber })}</p>
      <p className="issue">{warm.title}</p>
      {warm.words && <blockquote className="warm-words" dir="auto">{warm.words}</blockquote>}
      {warm.mentions.length > 0 && (
        <p className="warning" role="note">{t("warm.mentions", { logins: warm.mentions.map((m) => `@${m}`).join(", ") })}</p>
      )}
      <p className="payload-label">{t("confirm.payload")}</p>
      <pre className="payload">{JSON.stringify(warm.mutations, null, 2)}</pre>
      <div className="actions">
        <button ref={sendRef} type="button" className="primary" disabled={sending} onClick={() => void send()}>
          {sending ? t("confirm.sending") : t("confirm.send")}
        </button>
        <button type="button" onClick={() => setWarm(null)}>{t("confirm.cancel")}</button>
      </div>
    </div>
  );
}

/** The one notice over the site: a gesture's outcome, cleared after a few seconds. */
export function Notice() {
  const notice = useQuest((s) => s.notice);
  const say = useQuest((s) => s.say);
  useEffect(() => {
    if (!notice) return;
    const clear = setTimeout(() => say(null), 6000);
    return () => clearTimeout(clear);
  }, [notice, say]);
  return <div className="toast" role="status" aria-live="polite">{notice}</div>;
}
