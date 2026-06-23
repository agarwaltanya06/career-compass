"use client";

/**
 * Interview Prep (§6). A fully static, mobile-friendly read built from
 * interview-prep.md. The 3-step answer method is the key takeaway, so it sits in
 * a highlighted card under the intro, with the worked example called out in its
 * own box. Section headings come from the message files via i18n so the page can
 * be translated to Hindi later; the longer body lives in lib/interviewPrepContent.
 * No API calls.
 */

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ExternalLink from "@/components/ExternalLink";
import {
  QUESTIONS,
  TIP_GROUPS,
  PRACTICE_LINKS,
} from "@/lib/interviewPrepContent";

const PREFIX = "static.interviewPrep";

/** Render a string, bolding any "(parenthetical)" tags — used by the example. */
function boldParens(text: string): ReactNode[] {
  return text.split(/(\([^)]*\))/g).map((part, i) =>
    part.startsWith("(") && part.endsWith(")") ? (
      <strong key={i} className="font-bold text-amber-800">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function InterviewPrepPage() {
  const { t, tList } = useI18n();
  const steps = tList(`${PREFIX}.method.steps`);
  const stepHints = tList(`${PREFIX}.method.stepHints`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-stone-900">{t(`${PREFIX}.title`)}</h1>
      <p className="mt-3 text-lg text-stone-600">{t(`${PREFIX}.intro`)}</p>

      {/* Key takeaway — the 3-step method, kept prominent near the top. */}
      <section className="mt-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">{t(`${PREFIX}.method.heading`)}</h2>
        <p className="mt-2 text-stone-700">{t(`${PREFIX}.method.intro`)}</p>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white"
              >
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="font-bold text-stone-900">{step}</p>
                {stepHints[i] && <p className="text-sm text-stone-600">{stepHints[i]}</p>}
              </div>
            </li>
          ))}
        </ol>

        {/* Worked example — visually distinct white card with a left rule. */}
        <figure className="mt-4 rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm">
          <figcaption className="text-sm text-stone-700">
            <span className="font-bold text-amber-800">{t(`${PREFIX}.method.exampleLabel`)}</span>{" "}
            — <em className="text-stone-600">{t(`${PREFIX}.method.exampleQ`)}</em>
          </figcaption>
          <blockquote className="mt-2 text-stone-800">
            “{boldParens(t(`${PREFIX}.method.example`))}”
          </blockquote>
        </figure>
      </section>

      {/* Common questions — a flat, scannable list. */}
      <h2 className="mt-12 text-2xl font-bold text-stone-900">
        {t(`${PREFIX}.questions.heading`)}
      </h2>
      <div className="mt-5 space-y-3">
        {QUESTIONS.map((qa) => (
          <div key={qa.q} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="font-bold text-stone-900">{qa.q}</p>
            <p className="mt-1 text-stone-700">{qa.a}</p>
            {qa.eg && <p className="mt-1 text-sm italic text-stone-500">“{qa.eg}”</p>}
            {qa.note && <p className="mt-1 text-sm text-stone-600">{qa.note}</p>}
          </div>
        ))}
      </div>

      {/* Before / during / after. */}
      <h2 className="mt-12 text-2xl font-bold text-stone-900">{t(`${PREFIX}.tips.heading`)}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {TIP_GROUPS.map((group) => (
          <section
            key={group.id}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
              {t(`${PREFIX}.tips.${group.id}`)}
            </h3>
            <ul className="mt-2 space-y-2">
              {group.tips.map((tip) => (
                <li key={tip} className="flex gap-2 text-sm text-stone-700">
                  <span aria-hidden className="select-none text-amber-500">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Free practice resources — external links, new tab. */}
      <h2 className="mt-12 text-2xl font-bold text-stone-900">
        {t(`${PREFIX}.resources.heading`)}
      </h2>
      <ul className="mt-4 space-y-2">
        {PRACTICE_LINKS.map((link) => (
          <li key={link.url} className="flex gap-2 text-stone-700">
            <span aria-hidden className="select-none text-amber-500">↗</span>
            <ExternalLink href={link.url}>{link.label}</ExternalLink>
          </li>
        ))}
      </ul>

      {/* Closing reassurance. */}
      <section className="mt-12 rounded-2xl border border-orange-200 bg-orange-50 p-5">
        <span className="font-bold text-orange-800">{t(`${PREFIX}.remember.heading`)}</span>{" "}
        <span className="text-stone-700">{t(`${PREFIX}.remember.body`)}</span>
      </section>
    </div>
  );
}
