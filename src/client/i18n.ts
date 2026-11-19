// English and French from day one. The browser language decides, the player can switch.
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "../locales/en/common.json";
import fr from "../locales/fr/common.json";
import { zoneKey } from "./zones.ts";

export function initI18n(): void {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { en: { common: en }, fr: { common: fr } },
      defaultNS: "common",
      fallbackLng: "en",
      supportedLngs: ["en", "fr"],
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
    });
}

/** A zone's display name, whatever the column's case, falling back to the board's own name for columns the locales do not know. */
export const zoneLabel = (zone: string) => i18n.t(`zones.${zoneKey(zone, Object.keys(en.zones))}`, { defaultValue: zone });
