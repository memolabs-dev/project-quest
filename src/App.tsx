import { Suspense, lazy, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { visitedRepo } from "./client/api.ts";
import { ACTION_CODE, CHEER_CODE } from "./client/keys.ts";
import { useReducedMotion } from "./client/scene/motion.ts";
import { useQuest } from "./client/store.ts";
import { actionAt } from "./client/talk.ts";
import { Hud } from "./client/ui/Hud.tsx";
import { Overlays } from "./client/ui/Overlays.tsx";
import { TouchControls } from "./client/ui/Touch.tsx";
import { isTouch } from "./client/touch.ts";
import "./client/ui/ui.css";

// The 3D scene (its libraries are most of the download) starts loading with the page, while the site is read:
// waiting for the site first made a visitor wait for both one after the other (#17).
const scene = import("./client/scene/Site.tsx");
const SiteCanvas = lazy(() => scene.then((m) => ({ default: m.SiteCanvas })));

export default function App() {
  const { t } = useTranslation();
  const load = useQuest((s) => s.load);
  const site = useQuest((s) => s.site);
  const refresh = useQuest((s) => s.refresh);
  const refreshLevels = useQuest((s) => s.refreshLevels);
  // A visit says what it waits for: GitHub first, then the scene.
  const visiting = useQuest((s) => s.siteKind === "visit");
  const waiting = visiting && visitedRepo() ? t("visit.loading", { repo: visitedRepo() }) : t("site.loading");

  useEffect(() => { void refresh(); void refreshLevels(); }, [refresh, refreshLevels]);

  // One motion setting for the interface too: its CSS reads data-motion, whatever the system says.
  const reduce = useReducedMotion();
  useEffect(() => { document.documentElement.dataset.motion = reduce ? "reduce" : "full"; }, [reduce]);

  // E opens the pallet in front of the player
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useQuest.getState();
      // A key typed in a field is the player's words, never a gesture.
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      // A dialog over the site has the keys: no card or signs open behind it.
      const dialog = s.warm !== null || s.thanking !== null || s.pending !== null || s.practiceDialog !== null || s.teamDialog !== null
        || s.talk !== null || s.talkPrepared !== null;
      if (dialog) return;
      // E opens the pallet's card (where someone waits, its first button is the talk); a visitor has no card: E welcomes.
      const act = e.code === ACTION_CODE && s.openCard === null ? actionAt(s.nearPallet, s.nearTalk) : null;
      if (act && "talk" in act) {
        // The key opens the dialog and must not be typed into its field.
        e.preventDefault();
        s.openTalk({ kind: act.talk.kind, number: act.talk.number });
        return;
      }
      if (act) s.open(act.card);
      // R opens the warm signs above the worker within reach (the configured site and the demo only).
      if (e.code === CHEER_CODE && s.nearWorker && s.openCard === null && (s.siteKind === "main" || s.siteKind === "demo")) {
        s.openPicker(s.picker?.login === s.nearWorker.login ? null : { ...s.nearWorker });
      }
      if (e.code === "Escape" && s.picker !== null) s.openPicker(null);
      if (e.code === "Escape" && s.openCard !== null) s.open(null);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app" data-touch={isTouch() ? "" : undefined}>
      {load.status === "loading" && <div className="loading" role="status">{waiting}</div>}
      {site && (
        <Suspense fallback={<div className="loading" role="status">{waiting}</div>}>
          <SiteCanvas site={site} />
        </Suspense>
      )}
      <Hud />
      <TouchControls />
      <Overlays />
    </div>
  );
}
