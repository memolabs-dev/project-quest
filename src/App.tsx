import { Suspense, lazy, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ACTION_CODE } from "./client/keys.ts";
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

  // E opens the pallet in front of the player
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useQuest.getState();
      if (e.code === ACTION_CODE && s.nearPallet !== null && s.openCard === null) s.open(s.nearPallet);
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
