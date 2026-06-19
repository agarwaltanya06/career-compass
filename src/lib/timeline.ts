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
