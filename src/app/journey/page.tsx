"use client";

/**
 * Journey view (spec §journey-view): renders a Journey object as an ordered
 * timeline of steps plus filterable college/exam cards, with a cost-bucket
 * filter (free / low / mid / high) and verify-first tagging.
 *
 * For now it renders the hard-coded sample journey so the whole UI is viewable
 * offline. Swapping in a real, generated journey later is a one-line change:
 * fetch it and pass it to <JourneyView journey={...} />.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { sampleJourney } from "@/lib/sampleJourney";
import type { CostBand, Journey, JourneyStep } from "@/lib/types";
import {
  ConfidenceBadge,
  CostBadge,
  FeasibilityBadge,
  VerifyTag,
} from "@/components/journey/badges";
import { CollegeCard, ExamCard } from "@/components/journey/cards";

/** Cost filter value: a specific bucket or "all". */
type CostFilter = CostBand | "all";
/** Which card types to show. */
type CardFilter = "all" | "colleges" | "exams";

const COST_OPTIONS: { value: CostFilter; labelKey: string }[] = [
  { value: "all", labelKey: "journey.filters.allCosts" },
  { value: "free", labelKey: "journey.filters.free" },
  { value: "low", labelKey: "journey.filters.low" },
  { value: "mid", labelKey: "journey.filters.mid" },
  { value: "high", labelKey: "journey.filters.high" },
];

const CARD_OPTIONS: { value: CardFilter; labelKey: string }[] = [
  { value: "all", labelKey: "journey.filters.showAll" },
  { value: "colleges", labelKey: "journey.filters.showColleges" },
  { value: "exams", labelKey: "journey.filters.showExams" },
];

export default function JourneyPage() {
  // Hard-coded sample for now; later this comes from /api/generate or the cache.
  return <JourneyView journey={sampleJourney} />;
}

function JourneyView({ journey }: { journey: Journey }) {
  const { t } = useI18n();
  const [cost, setCost] = useState<CostFilter>("all");
  const [cards, setCards] = useState<CardFilter>("all");

  const costMatches = (band: CostBand) => cost === "all" || band === cost;

  // Pre-compute, per route, the exams/colleges that survive the active filters,
  // and whether the route should appear at all.
  const filteredRoutes = useMemo(() => {
    return journey.routes
      .map((route) => {
        const exams =
          cards === "colleges" ? [] : route.exams.filter((e) => costMatches(e.costBand));
        const colleges =
          cards === "exams" ? [] : route.colleges.filter((c) => costMatches(c.costBand));
        // Keep the route if it (or any surviving card) matches the cost filter.
        const visible =
          costMatches(route.costBand) || exams.length > 0 || colleges.length > 0;
        return { route, exams, colleges, visible };
      })
      .filter((r) => r.visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.routes, cost, cards]);

  const visibleResources = journey.prepResources.filter((r) => costMatches(r.costBand));
  const nothingMatches = filteredRoutes.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* ---- Header ---- */}
      <header>
        <p className="text-sm font-medium text-orange-700">{t("journey.forCareer")}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-stone-900">
          {journey.meta.career}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ConfidenceBadge level={journey.meta.confidence} />
          <span className="text-xs text-stone-400">
            {t("journey.generatedAt", { date: journey.meta.generatedAt })}
          </span>
        </div>
      </header>

      {/* ---- Overview ---- */}
      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">{t("journey.overview")}</h2>
        <p className="mt-2 text-stone-700">{journey.overview.summary}</p>

        <h3 className="mt-4 text-sm font-semibold text-stone-500">
          {t("journey.dayInLife")}
        </h3>
        <p className="text-stone-700">{journey.overview.dayInLife}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-stone-500">{t("journey.pay")}</h3>
            <p className="text-stone-800">
              {t("journey.payEntry")}: {journey.overview.payRange.entry}
              <br />
              {t("journey.payExperienced")}: {journey.overview.payRange.experienced}
            </p>
            <p className="mt-1 text-xs text-stone-400">{journey.overview.payRange.note}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-500">
              {t("journey.demandOutlook")}
            </h3>
            <p className="text-stone-800">{journey.overview.demandOutlook}</p>
          </div>
        </div>

        {journey.overview.requirements.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-stone-500">
              {t("journey.requirements")}
            </h3>
            <ul className="mt-1 list-inside list-disc text-stone-700">
              {journey.overview.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---- Filter bar (sticky under the header on scroll) ---- */}
      <div className="sticky top-[57px] z-10 -mx-4 mt-8 border-y border-stone-200 bg-orange-50/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {t("journey.filters.costHeading")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COST_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              active={cost === o.value}
              onClick={() => setCost(o.value)}
            >
              {t(o.labelKey)}
            </FilterChip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CARD_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              active={cards === o.value}
              onClick={() => setCards(o.value)}
            >
              {t(o.labelKey)}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ---- Routes ---- */}
      <section className="mt-6">
        <h2 className="text-xl font-bold text-stone-900">{t("journey.routes")}</h2>

        {nothingMatches && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-800">
            {t("journey.filters.noneMatch")}
          </p>
        )}

        <div className="mt-4 space-y-6">
          {filteredRoutes.map(({ route, exams, colleges }) => (
            <article
              key={route.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-lg font-bold text-stone-900">{route.name}</h3>
                <CostBadge band={route.costBand} />
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {t("journey.bestFor")}: {route.bestFor}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <FeasibilityBadge level={route.feasibility} />
                <span className="text-xs text-stone-500">
                  {t("journey.duration")}: {route.duration}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{route.feasibilityReason}</p>

              {/* Ordered timeline of steps */}
              <Timeline steps={route.steps} />

              {/* Exam cards */}
              {exams.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                    {t("journey.exams")}
                  </h4>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {exams.map((e) => (
                      <ExamCard key={e.name} exam={e} />
                    ))}
                  </div>
                </div>
              )}

              {/* College cards */}
              {colleges.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                    {t("journey.colleges")}
                  </h4>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {colleges.map((c) => (
                      <CollegeCard key={c.name} college={c} />
                    ))}
                  </div>
                </div>
              )}

              {/* Missed-deadline fallback */}
              {route.missedDeadlineFallback.applies && (
                <div className="mt-5 rounded-xl bg-stone-50 p-4">
                  <h4 className="text-sm font-bold text-stone-700">
                    {t("journey.fallbackTitle")}
                  </h4>
                  <ul className="mt-1 list-inside list-disc text-sm text-stone-700">
                    {route.missedDeadlineFallback.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ---- Prep resources (also cost-filtered) ---- */}
      {visibleResources.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-stone-900">
            {t("journey.prepResources")}
          </h2>
          <ul className="mt-3 space-y-2">
            {visibleResources.map((r) => (
              <li
                key={r.title}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-orange-700 underline"
                  >
                    {r.title}
                  </a>
                  <p className="text-xs text-stone-500">
                    {r.type} · {t("journey.resourceLanguage")}: {r.language}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CostBadge band={r.costBand} />
                  {!r.verified && <VerifyTag />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Grounding sources ---- */}
      {journey.groundingSources.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold text-stone-700">{t("journey.sources")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {journey.groundingSources.map((s) => (
              <li key={s.claim + s.url} className="text-stone-600">
                {s.claim} —{" "}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-700 underline"
                >
                  {t("common.officialSite")} ↗
                </a>{" "}
                <span className="text-xs text-stone-400">
                  ({t("journey.sourceFetched", { date: s.fetchedAt })})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Disclaimers ---- */}
      {journey.disclaimers.length > 0 && (
        <section className="mt-8 rounded-2xl bg-yellow-50 p-5">
          <h2 className="text-sm font-bold text-yellow-900">{t("journey.disclaimers")}</h2>
          <ul className="mt-1 list-inside list-disc text-sm text-yellow-900">
            {journey.disclaimers.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A reusable filter chip with a clear active state and large tap target. */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
        active
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

/** Ordered, numbered timeline of a route's steps. */
function Timeline({ steps }: { steps: JourneyStep[] }) {
  const { t } = useI18n();
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {t("journey.timeline")}
      </h4>
      <ol className="mt-2">
        {ordered.map((step, i) => (
          <li key={step.order} className="flex gap-3">
            {/* Number + connecting line */}
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                {step.order}
              </span>
              {i < ordered.length - 1 && (
                <span aria-hidden className="my-1 w-px flex-1 bg-stone-200" />
              )}
            </div>
            <div className="pb-5">
              <p className="font-semibold text-stone-900">{step.title}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-orange-700">
                {step.type} · {step.timing}
              </p>
              <p className="mt-1 text-sm text-stone-600">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
