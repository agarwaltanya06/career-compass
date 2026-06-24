"use client";

/**
 * Small presentational badges shared across the journey view.
 * Kept tiny and dependency-free so they're cheap to render on slow devices.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CostBand, Confidence, Feasibility } from "@/lib/types";

/**
 * Map a cost band to its i18n label key + colour + an indicative ₹ range.
 * The range is a rough planning hint per band (not a verified figure); `free`
 * has none, hence the optional field — see CostBadge.
 */
const COST_STYLE: Record<
  CostBand,
  { labelKey: string; cls: string; range?: string }
> = {
  free: { labelKey: "journey.filters.free", cls: "bg-emerald-100 text-emerald-800" },
  // "low" was the one cold (sky) badge — warmed to a neutral so the brand reads
  // warm while free/mid/high keep their meaningful green/amber/red progression.
  low: { labelKey: "journey.filters.low", cls: "bg-stone-100 text-stone-700", range: "≤ ₹50k/yr" },
  mid: { labelKey: "journey.filters.mid", cls: "bg-amber-100 text-amber-800", range: "₹50k–2L/yr" },
  high: { labelKey: "journey.filters.high", cls: "bg-rose-100 text-rose-800", range: "₹2L+/yr" },
};

export function CostBadge({ band }: { band: CostBand }) {
  const { t } = useI18n();
  const style = COST_STYLE[band];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style.cls}`}
    >
      {t("journey.costLabel")}: {t(style.labelKey)}
      {/* Indicative band range — shown only where we have one (not for free). */}
      {style.range && <span className="font-normal opacity-70">· {style.range}</span>}
    </span>
  );
}

/**
 * The "verify on official site" tag, shown on any unverified high-stakes field
 * (spec §3, rule 2). This is the safety rail made visible.
 */
export function VerifyTag() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
      <span aria-hidden>⚠️</span>
      {t("common.verifyTag")}
    </span>
  );
}

const FEASIBILITY_STYLE: Record<Feasibility, { labelKey: string; cls: string }> = {
  high: { labelKey: "journey.feasibilityHigh", cls: "bg-emerald-100 text-emerald-800" },
  medium: { labelKey: "journey.feasibilityMedium", cls: "bg-amber-100 text-amber-800" },
  low: { labelKey: "journey.feasibilityLow", cls: "bg-rose-100 text-rose-800" },
};

export function FeasibilityBadge({ level }: { level: Feasibility }) {
  const { t } = useI18n();
  const style = FEASIBILITY_STYLE[level];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.cls}`}>
      {t("journey.feasibilityLabel")}: {t(style.labelKey)}
    </span>
  );
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "journey.confidenceHigh",
  medium: "journey.confidenceMedium",
  low: "journey.confidenceLow",
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded-full border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600">
      {t("journey.confidence")}: {t(CONFIDENCE_LABEL[level])}
    </span>
  );
}

/** A small labelled link to an official site (always the page to verify on). */
export function OfficialLink({ url }: { url: string }) {
  const { t } = useI18n();
  // No real link (e.g. a generic state-CET placeholder, or a stripped search
  // redirect) → render nothing rather than an <a href=""> that reloads the page.
  if (!url.trim()) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-orange-700 underline"
    >
      {t("common.officialSite")} ↗
    </a>
  );
}
