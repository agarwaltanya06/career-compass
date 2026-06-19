/**
 * Timeline computation — the deterministic, code-side half of the spec's
 * "model emits relative timing, code computes the date" rule (§2.1 + §3 rule 7).
 *
 * The model only ever emits `offsetMonths` per step; here we turn that into a
 * coarse `targetPeriod` ("Mid 2026") anchored on the student's current date, and
 * group either/or fork steps so the UI can render them as a branch rather than
 * as two parallel mandatory steps.
 */

import type { JourneyStep } from "./types";

/** Coarse third-of-year bucket — deliberately vague, never a hard date. */
export type Season = "early" | "mid" | "late";

export interface TargetPeriod {
  season: Season;
  year: number;
}

/**
 * Compute the coarse display period for a step `offsetMonths` from `currentDate`.
 * Jan–Apr → "early", May–Aug → "mid", Sep–Dec → "late". The result is a planning
 * horizon, not a commitment.
 */
export function computeTargetPeriod(
  currentDate: string,
  offsetMonths: number,
): TargetPeriod {
  const base = new Date(currentDate);
  // Normalise to day 1 so end-of-month dates can't roll into the next month.
  const target = new Date(base.getFullYear(), base.getMonth() + offsetMonths, 1);
  const month = target.getMonth(); // 0–11
  const season: Season = month <= 3 ? "early" : month <= 7 ? "mid" : "late";
  return { season, year: target.getFullYear() };
}

/** A concrete year + 0-indexed month, the first of which anchors a calendar event. */
export interface TargetMonth {
  year: number;
  /** 0–11, as returned by Date.getMonth(). */
  month: number;
}

/**
 * Like {@link computeTargetPeriod} but resolved to a concrete month rather than a
 * third-of-year bucket. Used only for calendar export, where an `.ics` event needs
 * a real date; we deliberately pin every event to the 1st of the month so the
 * exported dates stay as coarse as the on-screen "Mid 2026" labels.
 */
export function computeTargetMonth(
  currentDate: string,
  offsetMonths: number,
): TargetMonth {
  const base = new Date(currentDate);
  const target = new Date(base.getFullYear(), base.getMonth() + offsetMonths, 1);
  return { year: target.getFullYear(), month: target.getMonth() };
}

/**
 * One row of the rendered timeline. A normal milestone is a single-step row; an
 * either/or fork (steps linked via `alternativeTo`) becomes one multi-step row
 * the UI renders as branching alternatives.
 */
export type TimelineRow = JourneyStep[];

/**
 * Order the steps and collapse `alternativeTo` forks into shared rows. Fork
 * alternatives are expected to share an `order`, so sorting keeps them adjacent;
 * any step pointing (directly or transitively) at an already-placed step joins
 * that step's row.
 */
export function buildTimelineRows(steps: JourneyStep[]): TimelineRow[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const rows: TimelineRow[] = [];
  const rowByStepId = new Map<string, number>();

  for (const step of sorted) {
    const targetRow =
      step.alternativeTo !== undefined
        ? rowByStepId.get(step.alternativeTo)
        : undefined;
    if (targetRow !== undefined) {
      rows[targetRow].push(step);
      rowByStepId.set(step.id, targetRow);
    } else {
      rows.push([step]);
      rowByStepId.set(step.id, rows.length - 1);
    }
  }

  return rows;
}
