import { Suspense, lazy, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ACTION_CODE, CHEER_CODE } from "./client/keys.ts";
import { useReducedMotion } from "./client/scene/motion.ts";
import { useQuest } from "./client/store.ts";
import { Hud } from "./client/ui/Hud.tsx";
import { Overlays } from "./client/ui/Overlays.tsx";
import "./client/ui/ui.css";

const SiteCanvas = lazy(() => import("./client/scene/Site.tsx").then((m) => ({ default: m.SiteCanvas })));

export default function App() {
  const { t } = useTranslation();
  const load = useQuest((s) => s.load);
  const site = useQuest((s) => s.site);
  const refresh = useQuest((s) => s.refresh);
  const refreshLevels = useQuest((s) => s.refreshLevels);

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
      if (e.code === ACTION_CODE && s.nearPallet !== null && s.openCard === null) s.open(s.nearPallet);
      // R opens the warm signs above the worker within reach (the configured site and the demo only).
      if (e.code === CHEER_CODE && s.nearWorker && s.openCard === null && s.warm === null && (s.siteKind === "main" || s.siteKind === "demo")) {
        s.openPicker(s.picker?.login === s.nearWorker.login ? null : { ...s.nearWorker });
      }
      if (e.code === "Escape" && s.picker !== null) s.openPicker(null);
      if (e.code === "Escape" && s.openCard !== null) s.open(null);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      {load.status === "loading" && <div className="loading" role="status">{t("site.loading")}</div>}
      {site && (
        <Suspense fallback={<div className="loading" role="status">{t("site.loading")}</div>}>
          <SiteCanvas site={site} />
        </Suspense>
      )}
      <Hud />
      <Overlays />
    </div>
  );
}
