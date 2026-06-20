"use client";

/**
 * The teach-to-fish tier (§6). This is the equity backstop — it serves students
 * with no login and no cached match: a blank plan template they can fill in, a
 * rolling 12-month planner, plus a short "how to research any career" guide.
 *
 * Everything the student types is held in state and flows into the printable /
 * PDF export, so a download is *their* plan with their answers — not an empty
 * template. The month planner is generated from today's date in the active
 * locale, giving one slot per month for the next year.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { buildPlanPrintHtml, printHtmlDocument } from "@/lib/timelineExport";

const PREFIX = "static.planItYourself";

/** Labels for the next `count` months from today, in the given locale. */
function nextMonthLabels(locale: string, count: number): string[] {
  const fmt = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    month: "long",
    year: "numeric",
  });
  const now = new Date();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(fmt.format(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return labels;
}

export default function PlanItYourselfPage() {
  const { t, tList, locale } = useI18n();
  const templateSteps = tList(`${PREFIX}.templateSteps`);
  const guideSteps = tList(`${PREFIX}.guideSteps`);
  const months = useMemo(() => nextMonthLabels(locale, 12), [locale]);

  // What the student has typed. Template answers are keyed by step index;
  // monthly notes by the month label.
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [monthly, setMonthly] = useState<Record<string, string>>({});

  // Printable, fill-in version of this page — now carrying the entered values.
  // Empty fields still render as blank lines so a printout works on paper too.
  const handlePrint = () => {
    const html = buildPlanPrintHtml(
      t(`${PREFIX}.title`),
      t(`${PREFIX}.intro`),
      [
        {
          heading: t(`${PREFIX}.templateTitle`),
          intro: t(`${PREFIX}.templateIntro`),
          fields: templateSteps.map((label, i) => ({
            label,
            value: answers[i] ?? "",
          })),
        },
        {
          heading: t(`${PREFIX}.monthlyTitle`),
          intro: t(`${PREFIX}.monthlyIntro`),
          fields: months.map((month) => ({
            label: month,
            value: monthly[month] ?? "",
          })),
        },
        {
          heading: t(`${PREFIX}.guideTitle`),
          items: guideSteps,
        },
      ],
      t("download.generatedBy"),
    );
    printHtmlDocument(html);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">{t(`${PREFIX}.title`)}</h1>
      <p className="mt-3 text-lg text-slate-600">{t(`${PREFIX}.intro`)}</p>

      <div className="mt-4">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-sky-300 bg-white px-4 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50"
        >
          <span aria-hidden>🖨️</span>
          {t("download.print")}
        </button>
        <p className="mt-2 text-xs text-slate-500">{t(`${PREFIX}.downloadNote`)}</p>
      </div>

      {/* Fill-it-in plan (values flow into the printout) */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          {t(`${PREFIX}.templateTitle`)}
        </h2>
        <p className="mt-1 text-slate-600">{t(`${PREFIX}.templateIntro`)}</p>
        <ol className="mt-4 space-y-4">
          {templateSteps.map((label, i) => (
            <li key={label}>
              <label className="block text-sm font-medium text-slate-700">
                {i + 1}. {label}
              </label>
              <input
                type="text"
                value={answers[i] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [i]: e.target.value }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </li>
          ))}
        </ol>
      </section>

      {/* Rolling 12-month planner */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          {t(`${PREFIX}.monthlyTitle`)}
        </h2>
        <p className="mt-1 text-slate-600">{t(`${PREFIX}.monthlyIntro`)}</p>
        <ol className="mt-4 space-y-3">
          {months.map((month) => (
            <li key={month} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-32 shrink-0 text-sm font-semibold text-slate-700">
                {month}
              </span>
              <input
                type="text"
                value={monthly[month] ?? ""}
                onChange={(e) =>
                  setMonthly((m) => ({ ...m, [month]: e.target.value }))
                }
                placeholder={t(`${PREFIX}.monthlyPlaceholder`)}
                className="min-h-11 w-full flex-1 rounded-lg border border-slate-300 px-3 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </li>
          ))}
        </ol>
      </section>

      {/* DIY research guide */}
      <section className="mt-8 rounded-2xl bg-sky-50 p-5">
        <h2 className="text-xl font-bold text-slate-900">{t(`${PREFIX}.guideTitle`)}</h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-slate-700">
          {guideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
