"use client";

/**
 * Language dropdown for the header. Reads the locale list from i18n config and
 * only renders options that are `enabled`. Hindi stays in the list but its
 * <option> is commented out until messages/hi.json is filled (see below), so
 * English is the only selectable choice for now.
 */

import { locales, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("lang.label")}</span>
      <select
        aria-label={t("lang.label")}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        // Large tap target + readable on mobile.
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
      >
        {/*
          English is enabled and selectable today.

          TODO: enable once messages/hi.json is filled — uncomment the Hindi
          <option> below (and flip `enabled: true` for 'hi' in
          src/lib/i18n/config.ts) to let users actually pick Hindi.

          <option value="hi">हिंदी (Hindi)</option>
        */}
        {locales
          .filter((l) => l.enabled)
          .map((l: { code: Locale; labelKey: string }) => (
            <option key={l.code} value={l.code}>
              {t(l.labelKey)}
            </option>
          ))}
      </select>
    </label>
  );
}
