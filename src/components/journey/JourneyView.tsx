"use client";

/**
 * Journey view (spec §journey-view): renders a Journey object as an ordered
 * timeline of steps plus filterable college/exam cards, with a cost-bucket
 * filter (free / low / mid / high) and verify-first tagging.
 *
 * Shared by the live journey page (sessionStorage hand-off from intake) and the
 * bookmarkable /journey/[slug] page, so all the rendering, filtering, collapsing
 * and export/print logic lives here once.
 */

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { journeyPath } from "@/lib/generate/client";
import type { JourneyStatus } from "@/lib/generate/types";
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

export function JourneyView({
  journey,
  status,
}: {
  journey: Journey;
  status: JourneyStatus | null;
}) {
  const { t } = useI18n();
  const [cost, setCost] = useState<CostFilter>("all");
  const [cards, setCards] = useState<CardFilter>("all");
  const [location, setLocation] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("default");
  // When true, every route is forced open (and the on-screen chrome hidden by
  // print CSS) so the browser's print-to-PDF captures the FULL plan, not just
  // whichever routes the reader happened to expand.
  const [printing, setPrinting] = useState(false);

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

  // Exam-transition cautions (spec §4.1), driven by the reference table's
  // `supersededBy` field — e.g. NEET PG → NExT. Scanned across ALL routes (never
  // the filtered set), so the caution always surfaces, and deduped by exam id so
  // it appears at most once even when the exam recurs across routes.
  const examTransitions = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; supersededByName: string }[] = [];
    for (const route of journey.routes) {
      for (const e of route.exams) {
        if (!e.supersededByName) continue;
        const key = e.id ?? e.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: e.name, supersededByName: e.supersededByName });
      }
    }
    return out;
  }, [journey.routes]);

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

  // Print-to-PDF: open every route, let React paint, then call print(); reset
  // once the dialog/sheet closes (afterprint also fires on mobile share sheets).
  useEffect(() => {
    if (!printing) return;
    const reset = () => setPrinting(false);
    window.addEventListener("afterprint", reset, { once: true });
    // Two frames so the now-expanded routes are laid out before the snapshot.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print())
    );
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", reset);
    };
  }, [printing]);

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

        {/* Share + save actions (hidden from the printed/PDF copy). */}
        <JourneyActions journey={journey} onDownloadPdf={() => setPrinting(true)} />

        {/* Unverified-candidate stamp (spec §4): a fresh, not-yet-reviewed
            machine generation, shown only to the requester. */}
        {status === "candidate" && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            <span aria-hidden>⚠️</span>
            <span>{t("journey.candidateBanner")}</span>
          </p>
        )}
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

      {/* ---- Filter bar (sticky under the header on scroll; off in print) ---- */}
      <div className="sticky top-[57px] z-10 -mx-4 mt-8 border-y border-stone-200 bg-orange-50/95 px-4 py-3 backdrop-blur print:hidden">
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

        {/* Exam-transition cautions (e.g. NEET PG → NExT) — always shown once,
            outside the cost/location filters, so they can't be hidden. */}
        {examTransitions.length > 0 && (
          <div className="mt-3 space-y-2">
            {examTransitions.map((tr) => (
              <p
                key={tr.name}
                className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900"
              >
                <span aria-hidden>⚠️</span>
                <span>
                  {t("journey.examTransition", {
                    exam: tr.name,
                    name: tr.supersededByName,
                  })}
                </span>
              </p>
            ))}
          </div>
        )}

        {nothingMatches && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-800">
            {t("journey.filters.noneMatch")}
          </p>
        )}

        <div className="mt-4 space-y-6">
          {filteredRoutes.map(({ route, exams, colleges }) => (
            <CollapsibleRoute
              key={route.id}
              route={route}
              exams={exams}
              colleges={colleges}
              journey={journey}
              costMatches={costMatches}
              // Collapsed by default so several paths are easy to scan and
              // compare at a glance; forced open while printing to PDF.
              forceOpen={printing}
            />
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

/**
 * Share + save controls under the journey header: copy a bookmarkable link
 * (derived from the non-personal cache key) and download the plan as a PDF via
 * the browser's print-to-PDF. Hidden from the printed copy itself.
 */
function JourneyActions({
  journey,
  onDownloadPdf,
}: {
  journey: Journey;
  onDownloadPdf: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const path = journeyPath(
      journey.meta.cacheKey,
      journey.meta.studentProfile.language ?? "en"
    );
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions): show the URL so the
      // user can copy it by hand rather than failing silently.
      window.prompt(t("journey.actions.copyManual"), url);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2 print:hidden">
      <ActionButton onClick={handleCopy} icon={copied ? "✅" : "🔗"}>
        {copied ? t("journey.actions.copied") : t("journey.actions.copyLink")}
      </ActionButton>
      <ActionButton onClick={onDownloadPdf} icon="📄">
        {t("journey.actions.downloadPdf")}
      </ActionButton>
    </div>
  );
}

/** A pill action button matching the journey view's warm outline aesthetic. */
function ActionButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-orange-300 bg-white px-4 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}

/**
 * One career route, rendered as a collapsible card. The always-visible summary
 * shows just the essentials — name, fit, cost band, duration — with a chevron and
 * a "Learn more" label that signal there's more inside. Expanding reveals the
 * full route (timeline, exports, skills, exam/college cards, fallback) so a
 * student can scan and compare several paths before diving into one.
 *
 * `forceOpen` overrides the collapse for printing, where the whole plan must show.
 */
function CollapsibleRoute({
  route,
  exams,
  colleges,
  journey,
  costMatches,
  forceOpen,
}: {
  route: Journey["routes"][number];
  exams: Journey["routes"][number]["exams"];
  colleges: Journey["routes"][number]["colleges"];
  journey: Journey;
  costMatches: (band: CostBand) => boolean;
  forceOpen: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const expanded = open || forceOpen;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* Always-visible, clickable summary — toggles the details below. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-stone-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-stone-900">{route.name}</h3>
            <FeasibilityBadge level={route.feasibility} />
            <CostBadge band={route.costBand} />
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
              ⏳ {route.duration}
            </span>
          </div>
        </div>
        {/* The "more inside" affordance — kept visible on mobile too (clarity),
            hidden only from the printed copy. */}
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-700 print:hidden">
          <span className="whitespace-nowrap">
            {expanded ? t("journey.showLess") : t("journey.learnMore")}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <p className="text-sm text-stone-600">
            {t("journey.bestFor")}: {route.bestFor}
          </p>
          <p className="mt-2 text-sm text-stone-600">{route.feasibilityReason}</p>

          {/* Ordered, dated timeline of steps */}
          <Timeline
            steps={route.steps}
            currentDate={journey.meta.studentProfile.currentDate}
          />

          {/* Take it offline: calendar + printable exports of this route */}
          <div className="print:hidden">
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
          </div>

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
        </div>
      )}
    </article>
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
