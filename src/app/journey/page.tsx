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
import type {
  CostBand,
  Journey,
  JourneyStep,
  RouteSkills,
} from "@/lib/types";
import {
  buildTimelineRows,
  computeTargetPeriod,
  type TargetPeriod,
} from "@/lib/timeline";
import {
  ConfidenceBadge,
  CostBadge,
  FeasibilityBadge,
  VerifyTag,
} from "@/components/journey/badges";
import { CollegeCard, ExamCard } from "@/components/journey/cards";
import DownloadTimeline from "@/components/journey/DownloadTimeline";

/** Cost filter value: a specific bucket or "all". */
type CostFilter = CostBand | "all";
/** Which card types to show. */
type CardFilter = "all" | "colleges" | "exams";
/** How to order each route's college list. */
type SortOption = "default" | "feesAsc" | "feesDesc";

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

const SORT_OPTIONS: { value: SortOption; labelKey: string }[] = [
  { value: "default", labelKey: "journey.filters.sortDefault" },
  { value: "feesAsc", labelKey: "journey.filters.sortFeesAsc" },
  { value: "feesDesc", labelKey: "journey.filters.sortFeesDesc" },
];

/** Numeric rank for cost buckets, so exams (which carry only a band, not a fee
 * string) can be ordered by cost the same way colleges are ordered by fees. */
const COST_BAND_RANK: Record<CostBand, number> = {
  free: 0,
  low: 1,
  mid: 2,
  high: 3,
};

/**
 * Pull the *highest* ₹ amount out of a freeform fees string — the upper cap of
 * the estimated cost — so colleges can be sorted deterministically by fees
 * ("₹8,000–20,000 / year" → 20000, "₹6–8 lakh" → 800000). Handles comma
 * grouping and lakh/crore units; returns Infinity when no number is present, so
 * entries with an unknown fee sort to the end (ascending) / treat as unbounded.
 */
function feeUpperBound(approxAnnualFees: string): number {
  const re = /([\d,]+(?:\.\d+)?)\s*(lakhs?|crores?|cr|l)?\b/gi;
  const matches = [...approxAnnualFees.matchAll(re)];
  const multFor = (unit: string | undefined) => {
    const u = (unit ?? "").toLowerCase();
    return u.startsWith("l") ? 1e5 : u.startsWith("c") ? 1e7 : 1;
  };

  let max = -Infinity;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isNaN(n)) continue;
    let mult = multFor(m[2]);
    // Shared-unit range like "₹6–8 lakh": a bare number directly followed by a
    // range separator and a unit-bearing number inherits that unit.
    const next = matches[i + 1];
    if (!m[2] && next?.[2]) {
      const gap = approxAnnualFees.slice(m.index! + m[0].length, next.index!);
      if (/^[\s\-–—/to]*$/i.test(gap)) mult = multFor(next[2]);
    }
    max = Math.max(max, n * mult);
  }
  return max === -Infinity ? Infinity : max;
}

/**
 * Distinct state/city tokens that actually appear in a journey's college
 * locations, so the location filter only ever offers real options. Locations
 * are freeform ("Jaipur, Rajasthan"), so we split on commas and keep the short,
 * place-name-like parts, dropping prose fragments ("with a regional office in…").
 */
function collectLocations(journey: Journey): string[] {
  const set = new Set<string>();
  for (const route of journey.routes) {
    for (const college of route.colleges) {
      for (const part of college.location.split(",")) {
        const token = part.trim();
        if (token && token.split(/\s+/).length <= 3) set.add(token);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export default function JourneyPage() {
  // Hard-coded sample for now; later this comes from /api/generate or the cache.
  return <JourneyView journey={sampleJourney} />;
}

function JourneyView({ journey }: { journey: Journey }) {
  const { t } = useI18n();
  const [cost, setCost] = useState<CostFilter>("all");
  const [cards, setCards] = useState<CardFilter>("all");
  const [location, setLocation] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("default");

  const costMatches = (band: CostBand) => cost === "all" || band === cost;
  const locationMatches = (loc: string) =>
    location === "all" || loc.includes(location);

  // Real state/city options drawn from the colleges in this journey, plus
  // whether there are any colleges at all (gates the colleges-only controls).
  const locationOptions = useMemo(() => collectLocations(journey), [journey]);
  const hasColleges = useMemo(
    () => journey.routes.some((r) => r.colleges.length > 0),
    [journey.routes]
  );
  const hasExams = useMemo(
    () => journey.routes.some((r) => r.exams.length > 0),
    [journey.routes]
  );

  // Generic, deterministic cost sort. `costOf` returns the comparable cost for an
  // item (fee upper-bound for colleges, band rank for exams). Equal costs return
  // 0 so unparseable fees (Infinity) never produce a NaN comparator.
  const sortByCost = <T,>(items: T[], costOf: (item: T) => number): T[] => {
    if (sort === "default") return items;
    const dir = sort === "feesAsc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const ca = costOf(a);
      const cb = costOf(b);
      if (ca === cb) return 0;
      return (ca - cb) * dir;
    });
  };

  // Pre-compute, per route, the exams/colleges that survive the active filters,
  // and whether the route should appear at all.
  const filteredRoutes = useMemo(() => {
    return journey.routes
      .map((route) => {
        const exams =
          cards === "colleges"
            ? []
            : sortByCost(
                route.exams.filter((e) => costMatches(e.costBand)),
                (e) => COST_BAND_RANK[e.costBand]
              );
        const colleges =
          cards === "exams"
            ? []
            : sortByCost(
                route.colleges.filter(
                  (c) => costMatches(c.costBand) && locationMatches(c.location)
                ),
                (c) => feeUpperBound(c.approxAnnualFees)
              );
        // Keep the route if it (or any surviving card) matches the cost filter.
        const visible =
          costMatches(route.costBand) || exams.length > 0 || colleges.length > 0;
        return { route, exams, colleges, visible };
      })
      .filter((r) => r.visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.routes, cost, cards, location, sort]);

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

        {/* Result controls: location (colleges only) + cost sort (colleges and
            exams). The sort stays available whenever there's anything to sort. */}
        {(hasColleges || hasExams) && (
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
            {hasColleges && cards !== "exams" && locationOptions.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {t("journey.filters.locationHeading")}
                </span>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="min-h-10 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700"
                >
                  <option value="all">{t("journey.filters.allLocations")}</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t("journey.filters.sortHeading")}
              </span>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((o) => (
                  <FilterChip
                    key={o.value}
                    active={sort === o.value}
                    onClick={() => setSort(o.value)}
                  >
                    {t(o.labelKey)}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        )}
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

              {/* Ordered, dated timeline of steps */}
              <Timeline
                steps={route.steps}
                currentDate={journey.meta.studentProfile.currentDate}
              />

              {/* Take it offline: calendar + printable exports of this route */}
              <DownloadTimeline
                steps={route.steps}
                anchor={
                  journey.meta.studentProfile.currentDate ??
                  new Date().toISOString().slice(0, 10)
                }
                career={journey.meta.career}
                routeName={route.name}
                routeId={route.id}
                disclaimers={journey.disclaimers}
              />

              {/* Skills beyond the degree */}
              <Skills skills={route.skills} costMatches={costMatches} />

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

/** Format a computed target period ("Mid 2026") via i18n. */
function usePeriodFormatter() {
  const { t } = useI18n();
  return (p: TargetPeriod) => t(`journey.season.${p.season}`, { year: p.year });
}

/**
 * Dated vertical timeline of a route's steps. Dates are computed in code from
 * each step's relative `offsetMonths` (spec §2.1) — the model never emits them.
 * Either/or forks render as a branch and optional steps are visually distinct.
 */
function Timeline({
  steps,
  currentDate,
}: {
  steps: JourneyStep[];
  currentDate?: string;
}) {
  const { t } = useI18n();
  // Fall back to today's date if a profile somehow lacks an anchor.
  const anchor = currentDate ?? new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => buildTimelineRows(steps), [steps]);

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {t("journey.timeline")}
      </h4>
      <p className="mt-1 text-xs text-stone-400">{t("journey.approxTimingNote")}</p>
      <ol className="mt-3">
        {rows.map((row, i) => (
          <TimelineRow
            key={row[0].id}
            row={row}
            anchor={anchor}
            isLast={i === rows.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}

/** A single timeline row: one step, or an either/or fork of several. */
function TimelineRow({
  row,
  anchor,
  isLast,
}: {
  row: JourneyStep[];
  anchor: string;
  isLast: boolean;
}) {
  const formatPeriod = usePeriodFormatter();
  const isFork = row.length > 1;
  const optional = !isFork && Boolean(row[0].optional);

  // The left-column date = the earliest period among the row's steps.
  const leadOffset = Math.min(...row.map((s) => s.offsetMonths));
  const leadPeriod = computeTargetPeriod(anchor, leadOffset);

  return (
    <li className="flex gap-3">
      {/* Computed date column */}
      <div className="w-16 shrink-0 pt-0.5 text-right">
        <span className="text-xs font-semibold text-stone-700">
          {formatPeriod(leadPeriod)}
        </span>
      </div>

      {/* Node + connecting line */}
      <div className="flex flex-col items-center">
        <span aria-hidden className={nodeClass(isFork, optional)} />
        {!isLast && <span aria-hidden className="my-1 w-px flex-1 bg-stone-200" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        {isFork ? (
          <ForkContent row={row} anchor={anchor} />
        ) : (
          <StepContent step={row[0]} />
        )}
      </div>
    </li>
  );
}

/** Marker dot styling: solid for required, dashed ring for optional, violet for forks. */
function nodeClass(isFork: boolean, optional: boolean): string {
  const base = "mt-0.5 h-4 w-4 shrink-0 rounded-full";
  if (isFork) return `${base} bg-violet-500 ring-2 ring-violet-200`;
  if (optional) return `${base} border-2 border-dashed border-orange-400 bg-white`;
  return `${base} bg-orange-500`;
}

/** A single, non-fork step. Optional steps are muted + badged. */
function StepContent({ step }: { step: JourneyStep }) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={`font-semibold ${
            step.optional ? "text-stone-600" : "text-stone-900"
          }`}
        >
          {step.title}
        </p>
        {step.optional && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            {t("journey.stepOptional")}
          </span>
        )}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-orange-700">
        {step.type}
      </p>
      <p className="mt-1 text-sm text-stone-600">{step.description}</p>
    </>
  );
}

/** An either/or fork: alternatives the student chooses between, not parallel steps. */
function ForkContent({ row, anchor }: { row: JourneyStep[]; anchor: string }) {
  const { t } = useI18n();
  const formatPeriod = usePeriodFormatter();
  return (
    <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
        {t("journey.stepEitherOr")}
      </p>
      <div className="mt-2">
        {row.map((step, i) => (
          <div key={step.id}>
            {i > 0 && (
              <div className="my-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-violet-400">
                <span aria-hidden className="h-px flex-1 bg-violet-200" />
                {t("journey.stepOr")}
                <span aria-hidden className="h-px flex-1 bg-violet-200" />
              </div>
            )}
            <div className="rounded-lg border border-violet-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-stone-900">{step.title}</p>
                <span className="text-xs font-semibold text-stone-500">
                  {formatPeriod(computeTargetPeriod(anchor, step.offsetMonths))}
                </span>
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-orange-700">
                {step.type}
              </p>
              <p className="mt-1 text-sm text-stone-600">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skills beyond the degree: core skills + price-banded upskilling options. */
function Skills({
  skills,
  costMatches,
}: {
  skills: RouteSkills;
  costMatches: (band: CostBand) => boolean;
}) {
  const { t } = useI18n();
  const upskilling = skills.upskilling.filter((u) => costMatches(u.costBand));
  if (skills.coreSkills.length === 0 && upskilling.length === 0) return null;

  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {t("journey.skills")}
      </h4>

      {skills.coreSkills.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-stone-500">
            {t("journey.coreSkills")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {skills.coreSkills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {upskilling.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-stone-500">
            {t("journey.upskilling")}
          </p>
          <ul className="mt-1.5 space-y-2">
            {upskilling.map((u) => (
              <li
                key={u.name}
                className="rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-orange-700 underline"
                  >
                    {u.name}
                  </a>
                  <div className="flex items-center gap-2">
                    <CostBadge band={u.costBand} />
                    {!u.verified && <VerifyTag />}
                  </div>
                </div>
                <p className="mt-1 text-sm text-stone-600">{u.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
