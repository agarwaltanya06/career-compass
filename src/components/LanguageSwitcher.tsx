"use client";

/**
 * Language dropdown for the header. Reads the locale list from i18n config and
 * only renders options that are `enabled`.
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
        className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-800 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
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
