/**
 * Post-generation AUDIT (spec §3 rules 12–13).
 *
 * Runs on a freshly generated candidate AFTER it has been validated/sanitized by
 * parseJourney, and returns a list of plain-English warnings. It changes nothing
 * about the journey — it only FLAGS it so the human reviewer (the candidates
 * folder is the review queue, spec §4) knows what to double-check before
 * promoting. Warnings also go to the server/seed console in run.ts.
 *
 * What it checks:
 *  - offsetMonths is NON-DECREASING along `order` within each route (rule 12) —
 *    a hard correctness signal: a later milestone dated earlier than an earlier
 *    one is almost always a model slip.
 *  - far-future steps (>5 years out) carry the "rules may change" hedge (rule 13)
 *    — heuristic, so we flag for a human to confirm rather than auto-edit.
 *  - UNVERIFIED exam/college specifics with no grounding (rule 3).
 *
 * The NEET PG → NExT transition note is NOT audited here: it's now produced
 * deterministically from the reference table's `supersededBy` field (spec §4.1),
 * so there's nothing for a human to confirm.
 *
 * These are deliberately conservative: a warning means "a human should look",
 * not "reject". Nothing here blocks serving the candidate to its requester.
 */

import type { Journey } from "@/lib/types";

/** Steps beyond this many months from now are "far future" (spec §3 rule 13 ≈ 5yr). */
const FAR_FUTURE_MONTHS = 60;

/** Loose detector for the far-future hedge text the model is asked to append. */
const HEDGE_RE = /\b(may change|might change|could change|re-?verify|verify (when|again|nearer|closer)|by then|confirm .* (rule|requirement|exam|fee))/i;

/**
 * Audit a generated journey and return zero or more review flags for `journey`
 * (the sanitized candidate).
 */
export function auditJourney(journey: Journey): string[] {
  const warnings: string[] = [];

  // ---- offsetMonths non-decreasing along `order` (rule 12) ----
  for (const route of journey.routes) {
    const sorted = [...route.steps].sort((a, b) => a.order - b.order);
    // Max offset seen among steps with a STRICTLY smaller order. Steps sharing an
    // order (fork alternatives) aren't compared against each other.
    let maxOffsetOfEarlierOrders = -Infinity;
    let runningMax = -Infinity;
    let prevOrder: number | null = null;
    for (const step of sorted) {
      if (prevOrder !== null && step.order > prevOrder) {
        maxOffsetOfEarlierOrders = runningMax;
      }
      if (step.offsetMonths < maxOffsetOfEarlierOrders) {
        warnings.push(
          `Route "${route.id}" step "${step.id}" (order ${step.order}) is dated ${step.offsetMonths}mo — earlier than a preceding step (${maxOffsetOfEarlierOrders}mo). offsetMonths must be non-decreasing along order.`,
        );
      }
      runningMax = Math.max(runningMax, step.offsetMonths);
      prevOrder = step.order;
    }
  }

  // ---- far-future steps should carry the hedge (rule 13) ----
  const farFuture = journey.routes.flatMap((r) =>
    r.steps
      .filter((s) => s.offsetMonths > FAR_FUTURE_MONTHS && !HEDGE_RE.test(s.description))
      .map((s) => `"${r.id}/${s.id}" (${s.offsetMonths}mo)`),
  );
  if (farFuture.length > 0) {
    warnings.push(
      `Far-future steps (>5yr out) without a visible "rules may change — verify when you get there" hedge: ${farFuture.join(", ")}. Confirm the hedge before promoting.`,
    );
  }

  // ---- UNVERIFIED high-stakes claims with NO grounding (rule 3) ----
  // Table-sourced exams/colleges are verified (facts come from data/*.json), so
  // they need no grounding. Only model-grounded, still-unverified specifics do —
  // and stripping search-redirect URLs (rule 12) can leave them with none.
  const hasUnverifiedSpecifics = journey.routes.some(
    (r) => r.exams.some((e) => !e.verified) || r.colleges.some((c) => !c.verified),
  );
  if (hasUnverifiedSpecifics && journey.groundingSources.length === 0) {
    warnings.push(
      `Journey has unverified exams/colleges but ZERO grounding sources (likely all were search-redirect links and got stripped). Re-ground these claims or downgrade them to general guidance before promoting.`,
    );
  }

  return warnings;
}
