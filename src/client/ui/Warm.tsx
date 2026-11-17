// The warm gestures over the site (people of the site spec, sections 4 and 5): the four signs, above a worker or on a
// card, and the confirmation that shows exactly what will be sent. Positive signs only; nothing is counted.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WARM_EMOJIS } from "../../shared/gestures/warm.ts";
import { ApiFailure, api } from "../api.ts";
import { useQuest } from "../store.ts";
import { greetAfter } from "../moments/greet.ts";
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
  const greetWith = useQuest((s) => s.greetWith);
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
      const greet = greetAfter(r, warm, 0);
      if (greet) {
        // The moment follows the fact: GitHub accepted it. The worker answers, the foreman raises a hand.
        announce({ kind: greet.kind, pallet: greet.pallet });
        greetWith({ pallet: greet.pallet, emoji: greet.emoji, kind: greet.kind });
      }
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

/** The offer after a pallet is laid: thank, or not now. One at a time, each offered once. */
export function ThankOffer() {
  const { t } = useTranslation();
  const next = useQuest((s) => s.toThank[0] ?? null);
  const site = useQuest((s) => s.site);
  const busy = useQuest((s) => s.openCard !== null || s.warm !== null || s.thanking !== null);
  const dismiss = useQuest((s) => s.dismissThank);
  const openThank = useQuest((s) => s.openThank);
  const warmSite = useQuest((s) => s.siteKind === "main" || s.siteKind === "demo");
  const pallet = next === null ? null : site?.pallets.find((p) => p.number === next);
  if (!pallet || busy || !warmSite) return null;
  const logins = site!.workers.filter((w) => w.carrying.includes(pallet.number)).map((w) => w.login);
  return (
    <section className="thank-offer" aria-label={t("warm.thank")}>
      {/* Who it goes to: the workers who carried the pallet, or the team. */}
      <p><b>{logins.length ? t("warm.thankWho", { logins: logins.join(", ") }) : t("warm.thankTeam")}</b> <span dir="auto">#{pallet.number} {pallet.title}</span></p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => openThank(pallet.number)}>{t("warm.thank")}</button>
        <button type="button" onClick={() => dismiss(pallet.number)}>{t("warm.notNow")}</button>
      </div>
    </section>
  );
}

/** The thank-you: 🎉 or ❤️, and the player's own words if they wish; then the confirmation shows what leaves. */
export function ThankDialog() {
  const { t } = useTranslation();
  const number = useQuest((s) => s.thanking);
  const pallet = useQuest((s) => s.site?.pallets.find((p) => p.number === s.thanking) ?? null);
  const openThank = useQuest((s) => s.openThank);
  const prepare = useWarmGesture();
  const [sign, setSign] = useState<"HOORAY" | "HEART">("HOORAY");
  const [words, setWords] = useState("");
  if (number === null || !pallet) return null;
  const go = async () => {
    await prepare("thank", { issueNumber: number, content: sign, words: words.trim() ? words : null });
    openThank(null);
    setWords("");
  };
  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="thank-title">
      <h2 id="thank-title">{t("warm.thankFor", { number })}</h2>
      <p className="issue" dir="auto">{pallet.title}</p>
      <fieldset className="choice">
        <legend>{t("warm.thankSign")}</legend>
        {(["HOORAY", "HEART"] as const).map((e) => (
          <label key={e}>
            <input type="radio" name="thank-sign" checked={sign === e} onChange={() => setSign(e)} />
            {GLYPH[e]} {t(`warm.signs.${e}`)}
          </label>
        ))}
      </fieldset>
      <label className="field">{t("warm.words")}
        <textarea rows={3} value={words} onChange={(e) => setWords(e.target.value)} placeholder={t("warm.wordsHint")} />
      </label>
      <p className="hint">{t("warm.noMention")}</p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => void go()}>{t("warm.show")}</button>
        <button type="button" onClick={() => openThank(null)}>{t("confirm.cancel")}</button>
      </div>
    </div>
  );
}
