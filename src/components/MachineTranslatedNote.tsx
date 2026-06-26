"use client";

/**
 * A small honesty note shown at the top of static content pages when the active
 * locale is machine-translated and not yet human-verified (Marathi, Gujarati).
 * It mirrors the "AI-generated" banner a runtime-generated journey carries, so
 * the safety content on these pages (scam rules, disclaimers) is held to the
 * same honesty: the reader is told a machine wrote the translation and to check
 * the official source for anything that matters. Renders nothing for verified
 * locales (English, Hindi). Dropped from print like other chrome.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";
import { isMachineTranslated } from "@/lib/i18n/config";

export default function MachineTranslatedNote() {
  const { t, locale } = useI18n();
  if (!isMachineTranslated(locale)) return null;

  return (
    <p
      role="note"
      className="mb-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden"
    >
      <span aria-hidden className="select-none">🌐</span>
      <span>{t("common.machineTranslatedNote")}</span>
    </p>
  );
}
