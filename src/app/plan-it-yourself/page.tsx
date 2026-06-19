"use client";

/**
 * The teach-to-fish tier (§6). This is the equity backstop — it serves students
 * with no login and no cached match: a blank plan template they can fill in,
 * plus a short "how to research any career on your own" guide.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";
import { buildPlanPrintHtml, printHtmlDocument } from "@/lib/timelineExport";

const PREFIX = "static.planItYourself";

export default function PlanItYourselfPage() {
  const { t, tList } = useI18n();
  const templateSteps = tList(`${PREFIX}.templateSteps`);
  const guideSteps = tList(`${PREFIX}.guideSteps`);

  // Printable, fill-in-on-paper version of this page. There are no dated steps
  // here (it's a blank template), so unlike the journey view there's no .ics —
  // just a clean print / Save-as-PDF of the plan and the research guide.
  const handlePrint = () => {
    const html = buildPlanPrintHtml(
      t(`${PREFIX}.title`),
      t(`${PREFIX}.intro`),
      [
        {
          heading: t(`${PREFIX}.templateTitle`),
          intro: t(`${PREFIX}.templateIntro`),
          blanks: templateSteps,
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
      </div>

      {/* Blank, fill-it-in plan */}
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
              {/* A real blank line to write on — works on paper too if printed. */}
              <input
                type="text"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
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
