// The settings panel, beside the language: sound and its volume, the miniature effect, motion.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Settings as SettingsModel } from "../settings.ts";
import { useQuest } from "../store.ts";

const MOTIONS: SettingsModel["motion"][] = ["system", "reduce", "full"];

export function Settings() {
  const { t } = useTranslation();
  const settings = useQuest((s) => s.settings);
  const set = useQuest((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  return (
    <div className="settings">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t("settings.title")}</button>
      {open && (
        <section className="settings-panel" aria-label={t("settings.title")}>
          <label className="field-inline">
            <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} /> {t("settings.sound")}
          </label>
          <label className="field">{t("settings.volume")}
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} disabled={!settings.sound}
              onChange={(e) => set({ volume: Number(e.target.value) })} />
          </label>
          <label className="field-inline">
            <input type="checkbox" checked={settings.miniature} onChange={(e) => set({ miniature: e.target.checked })} /> {t("settings.miniature")}
          </label>
          <fieldset className="choice">
            <legend>{t("settings.motion")}</legend>
            {MOTIONS.map((m) => (
              <label key={m}>
                <input type="radio" name="motion" checked={settings.motion === m} onChange={() => set({ motion: m })} /> {t(`settings.motions.${m}`)}
              </label>
            ))}
          </fieldset>
        </section>
      )}
    </div>
  );
}
