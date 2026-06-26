"use client";

/**
 * Find Jobs & Internships (§6). A fully static, mobile-friendly directory built
 * from find-jobs.md: where to look (with clickable portals), how to apply, and a
 * visually distinct scam-safety box. External links open in a new tab; the two
 * cross-references ("see CV Templates / Interview Prep") stay in-app.
 *
 * Section headings come from the message files via i18n for later Hindi; link
 * lists and body text live in lib/findJobsContent. No API calls.
 */

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { localize } from "@/lib/i18n/localized";
import type { Locale } from "@/lib/i18n/config";
import ExternalLink from "@/components/ExternalLink";
import MachineTranslatedNote from "@/components/MachineTranslatedNote";
import {
  AUDIENCE,
  INTERNSHIP_LINKS,
  GOVERNMENT_LINKS,
  SARKARI_PORTALS,
  SARKARI_EXAMS,
  APPLY_STEPS,
  SCAM_RULES,
  type JobLink,
} from "@/lib/findJobsContent";

const PREFIX = "static.findJobs";

/** A portal as a list row: bold linked name, then its description. */
function LinkRow({ link, locale }: { link: JobLink; locale: Locale }) {
  return (
    <li className="flex gap-2 text-stone-700">
      <span aria-hidden className="select-none text-amber-500">↗</span>
      <span>
        <ExternalLink href={link.url}>{link.name}</ExternalLink>
        {link.desc && <span className="text-stone-600"> — {localize(link.desc, locale)}</span>}
        {link.note && (
          <span className="mt-1 block text-sm font-medium text-amber-800">{localize(link.note, locale)}</span>
        )}
      </span>
    </li>
  );
}

export default function FindJobsPage() {
  const { t, locale } = useI18n();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <MachineTranslatedNote />
      <h1 className="text-3xl font-extrabold text-stone-900">{t(`${PREFIX}.title`)}</h1>
      <p className="mt-3 text-lg text-stone-600">{t(`${PREFIX}.intro`)}</p>

      {/* Which path fits the reader right now. */}
      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-bold text-stone-900">{t(`${PREFIX}.audience.heading`)}</h2>
        <ul className="mt-3 space-y-2">
          {AUDIENCE.map((line) => {
            const lead = localize(line.lead, locale);
            return (
              <li key={lead} className="flex gap-2 text-stone-700">
                <span aria-hidden className="select-none text-amber-500">•</span>
                <span>
                  <strong className="font-semibold text-stone-900">{lead}</strong>
                  {localize(line.rest, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where to look. */}
      <h2 className="mt-12 text-2xl font-bold text-stone-900">{t(`${PREFIX}.where.heading`)}</h2>
      <div className="mt-5 space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
            {t(`${PREFIX}.where.internships`)}
          </h3>
          <ul className="mt-2 space-y-2">
            {INTERNSHIP_LINKS.map((link) => (
              <LinkRow key={link.url} link={link} locale={locale} />
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
            {t(`${PREFIX}.where.government`)}
          </h3>
          <ul className="mt-2 space-y-2">
            {GOVERNMENT_LINKS.map((link) => (
              <LinkRow key={link.url} link={link} locale={locale} />
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
            {t(`${PREFIX}.where.sarkari`)}
          </h3>
          <p className="mt-2 text-stone-700">
            <span className="font-semibold text-stone-900">{t(`${PREFIX}.where.portals`)}: </span>
            {SARKARI_PORTALS.map((link, i) => (
              <span key={link.url}>
                {i > 0 && <span className="text-stone-400"> · </span>}
                <ExternalLink href={link.url}>{link.name}</ExternalLink>
              </span>
            ))}
          </p>
          <p className="mt-1 text-stone-700">
            <span className="font-semibold text-stone-900">{t(`${PREFIX}.where.exams`)}: </span>
            {SARKARI_EXAMS.map((link, i) => (
              <span key={link.url}>
                {i > 0 && <span className="text-stone-400"> · </span>}
                <ExternalLink href={link.url}>{link.name}</ExternalLink>
                {link.desc && <span className="text-stone-500"> ({localize(link.desc, locale)})</span>}
              </span>
            ))}
            <span className="text-stone-400"> · </span>
            <span className="text-stone-700">{t(`${PREFIX}.where.statePsc`)}</span>
          </p>
        </div>
      </div>

      {/* How to apply — numbered steps. */}
      <h2 className="mt-12 text-2xl font-bold text-stone-900">{t(`${PREFIX}.apply.heading`)}</h2>
      <ol className="mt-5 space-y-3">
        {APPLY_STEPS.map((step, i) => {
          const text = localize(step.text, locale);
          return (
            <li key={text} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-stone-800 text-sm font-bold text-white"
              >
                {i + 1}
              </span>
              <span className="pt-0.5 text-stone-700">
                {text}
                {step.see ? (
                  <>
                    {" ("}
                    {t(`${PREFIX}.apply.see`)}{" "}
                    <Link
                      href={step.see.href}
                      className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                    >
                      {localize(step.see.label, locale)}
                    </Link>
                    {")."}
                  </>
                ) : (
                  "."
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Scam-safety — kept clear but warm (amber, shield icon), not alarming. */}
      <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold text-amber-900">
          <span aria-hidden>🛡️</span>
          {t(`${PREFIX}.scams.heading`)}
        </h2>
        <p className="mt-2 text-stone-700">{t(`${PREFIX}.scams.intro`)}</p>
        <ul className="mt-3 space-y-2">
          {SCAM_RULES.map((rule) => {
            const lead = localize(rule.lead, locale);
            return (
              <li key={lead} className="flex gap-2 text-stone-700">
                <span aria-hidden className="select-none text-amber-500">•</span>
                <span>
                  <strong className="font-bold text-stone-900">{lead}</strong>
                  {localize(rule.rest, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Quick start. */}
      <section className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-5">
        <span className="font-bold text-orange-800">{t(`${PREFIX}.quickStart.label`)}: </span>
        <span className="text-stone-700">
          {t(`${PREFIX}.quickStart.p1`)}
          <ExternalLink
            href="https://linkedin.com"
            className="font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-800"
          >
            LinkedIn
          </ExternalLink>
          {t(`${PREFIX}.quickStart.p2`)}
          <ExternalLink
            href="https://internshala.com"
            className="font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-800"
          >
            Internshala
          </ExternalLink>
          {t(`${PREFIX}.quickStart.p3`)}
        </span>
      </section>
    </div>
  );
}
