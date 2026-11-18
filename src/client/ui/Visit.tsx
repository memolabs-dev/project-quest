// A visit of any public repository, read-only (#16): the repository's name, a photo to share, another visit.
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { CODE_URL, EXAMPLE_REPOS, LANDING_REPO, repoFromInput, visitedRepo } from "../api.ts";
import { photoName } from "../photo.ts";
import { useQuest } from "../store.ts";
import { sitePhoto } from "./photo-draw.ts";

export function VisitForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState(visitedRepo());
  const go = (e: FormEvent) => {
    e.preventDefault();
    const repo = repoFromInput(text);
    // The slash stays readable: the address is meant to be shared.
    if (repo) location.search = `?visit=${encodeURIComponent(repo).replace("%2F", "/")}`;
  };
  return (
    <form className="visit-form" onSubmit={go}>
      <label htmlFor="visit-repo">{t("visit.label")}</label>
      <div>
        <input
          id="visit-repo" value={text} onChange={(e) => setText(e.target.value)} placeholder="owner/name"
          autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus={autoFocus}
        />
        <button type="submit" className="primary">{t("visit.go")}</button>
      </div>
    </form>
  );
}

function PhotoButton({ repo }: { repo: string }) {
  const { t } = useTranslation();
  const say = useQuest((s) => s.say);
  const take = async () => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-testid=site-canvas] canvas");
    if (!canvas) return;
    try {
      const a = document.createElement("a");
      a.href = await sitePhoto(canvas, repo, t("visit.signature"));
      a.download = photoName(repo);
      a.click();
    } catch {
      say(t("visit.photoFailed"));
    }
  };
  return <button type="button" onClick={() => void take()}>{t("visit.photo")}</button>;
}

/** The visit's banner, or, before any repository is named, the question. */
export function VisitBar() {
  const { t, i18n } = useTranslation();
  const repo = useQuest((s) => s.visitRepo);
  const load = useQuest((s) => s.load);
  const [other, setOther] = useState(false);
  if (load.status === "ready" && !repo) {
    return (
      <div className="visit-intro" role="region" aria-labelledby="visit-title">
        <h1 id="visit-title">{t("visit.title")}</h1>
        <p>{t("visit.intro")}</p>
        <VisitForm autoFocus />
        <div className="visit-examples">
          <span>{t("visit.examples")}</span>
          {EXAMPLE_REPOS.map((r) => <a key={r} href={`?visit=${r}`}>{r}</a>)}
        </div>
        <p className="visit-foot">
          {t("visit.behind", { repo: LANDING_REPO })} · <a href={CODE_URL} target="_blank" rel="noreferrer">{t("visit.code")}</a>
        </p>
      </div>
    );
  }
  if (!repo) return null;
  return (
    <div className="banner visit-bar" role="note">
      <p>
        {t("visit.banner")} <a href={repo.url} target="_blank" rel="noreferrer">{repo.nameWithOwner}</a>
        {" "}<span className="stars">★ {repo.stars.toLocaleString(i18n.resolvedLanguage)}</span>
      </p>
      <div className="visit-actions">
        <PhotoButton repo={repo.nameWithOwner} />
        <button type="button" aria-expanded={other} onClick={() => setOther((v) => !v)}>{t("visit.other")}</button>
      </div>
      {other && <VisitForm autoFocus />}
    </div>
  );
}
