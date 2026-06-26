"use client";

/**
 * Shared safety message for the free-text career field, shown both inline at the
 * question (client heuristic) and on the summary (server LLM gate). Two kinds:
 *
 *   - "blocked"  → a NEUTRAL nudge for off-topic / disallowed input. Never
 *                  accusatory: we just ask for a career, we don't name what was
 *                  wrong.
 *   - "distress" → a calm, supportive message with India mental-health helplines
 *                  (Tele-MANAS / KIRAN) as tappable tel: links. Never a blank
 *                  rejection.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";

export type SafetyKind = "blocked" | "distress";

export default function SafetyNotice({ kind }: { kind: SafetyKind }) {
  const { t } = useI18n();

  if (kind === "blocked") {
    return (
      <p
        role="alert"
        className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700"
      >
        {t("intake.safety.blocked")}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"
    >
      <p className="font-semibold">{t("intake.safety.distressTitle")}</p>
      <p className="mt-1">{t("intake.safety.distressBody")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a
          href="tel:14416"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sky-300 bg-white px-4 font-semibold text-sky-800 hover:bg-sky-100"
        >
          📞 {t("intake.safety.helplineTeleManas")}
        </a>
        <a
          href="tel:18005990019"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sky-300 bg-white px-4 font-semibold text-sky-800 hover:bg-sky-100"
        >
          📞 {t("intake.safety.helplineKiran")}
        </a>
      </div>
    </div>
  );
}
