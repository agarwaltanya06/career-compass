/**
 * Post-generation AUDIT (spec §3 rules 12–13).
 *
 * Runs on a freshly generated candidate AFTER it has been validated/sanitized by
 * parseJourney. It changes nothing about the journey — it only FLAGS it. Flags
 * fall into two buckets (see {@link AuditResult}):
 *
 *  - STRUCTURAL violations — mechanical model slips (a non-decreasing-offset
 *    break, or a duplicate/artifact route) that a fresh draft almost always
 *    fixes. The generator REGENERATES on these, up to 2 retries, before writing a
 *    candidate (src/lib/generate/run.ts). If retries are exhausted the journey is
 *    still served/queued, just flagged — the audit never hard-blocks.
 *  - REVIEW flags — heuristic "a human should look" signals (a missing far-future
 *    hedge, ungrounded unverified specifics). These never trigger a retry; they
 *    just tell the reviewer (the candidates folder is the review queue, spec §4)
 *    what to double-check before promoting.
 *
 * Both buckets go to the server/seed console in run.ts.
 *
 * What it checks:
 *  - [structural] offsetMonths is NON-DECREASING along `order` within each route
 *    (rule 12) — a later milestone dated earlier than an earlier one.
 *  - [structural] no DUPLICATE / ARTIFACT routes — duplicate route ids or names,
 *    or duplicate step ids within a route (the model echoing a path or a step).
 *  - [review] far-future steps (>5 years out) carry the "rules may change" hedge
 *    (rule 13) — heuristic, so we flag for a human rather than auto-edit.
 *  - [review] UNVERIFIED exam/college specifics with no grounding (rule 3).
 *
 * The NEET PG → NExT transition note is NOT audited here: it's now produced
 * deterministically from the reference table's `supersededBy` field (spec §4.1),
 * so there's nothing for a human to confirm.
 */

import type { Journey } from "@/lib/types";

/** Steps beyond this many months from now are "far future" (spec §3 rule 13 ≈ 5yr). */
const FAR_FUTURE_MONTHS = 60;

/** Loose detector for the far-future hedge text the model is asked to append. */
const HEDGE_RE = /\b(may change|might change|could change|re-?verify|verify (when|again|nearer|closer)|by then|confirm .* (rule|requirement|exam|fee))/i;

/** Result of {@link auditJourney}: structural violations vs. soft review flags. */
export interface AuditResult {
  /**
   * STRUCTURAL violations — offset-order breaks and duplicate/artifact routes.
   * Mechanical slips a regeneration almost always fixes, so the generator retries
   * on any of these (run.ts) before writing a candidate.
   */
  structural: string[];
  /**
   * Soft REVIEW flags — missing far-future hedge, ungrounded unverified specifics.
   * Heuristic; never block and never trigger a retry.
   */
  review: string[];
}

/** Return the set of keys that appear more than once (empty keys are ignored). */
function findDuplicates<T>(items: T[], key: (item: T) => string): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    const k = key(item).trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) dupes.add(k);
    else seen.add(k);
  }
  return [...dupes];
}

/**
 * Audit a generated journey, returning structural violations (which the generator
 * regenerates on) and soft review flags (which it doesn't) for `journey` — the
 * already sanitized candidate.
 */
export function auditJourney(journey: Journey): AuditResult {
  const structural: string[] = [];
  const review: string[] = [];

  // ---- [structural] offsetMonths non-decreasing along `order` (rule 12) ----
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
        structural.push(
          `Route "${route.id}" step "${step.id}" (order ${step.order}) is dated ${step.offsetMonths}mo — earlier than a preceding step (${maxOffsetOfEarlierOrders}mo). offsetMonths must be non-decreasing along order.`,
        );
      }
      runningMax = Math.max(runningMax, step.offsetMonths);
      prevOrder = step.order;
    }
  }

  // ---- [structural] duplicate / artifact routes ----
  // Route ids wire the UI (route selection + fork `alternativeTo` targets), so
  // duplicate ids break that wiring. Identical route names are the model echoing
  // one path twice. Duplicate STEP ids within a route corrupt the fork/offset
  // logic. All three are mechanical artifacts a fresh draft fixes.
  for (const id of findDuplicates(journey.routes, (r) => r.id)) {
    structural.push(
      `Duplicate route id "${id}" — route ids must be unique (they wire selection and fork targets). Likely a duplicated/artifact route.`,
    );
  }
  for (const name of findDuplicates(journey.routes, (r) => r.name)) {
    structural.push(
      `Duplicate route name "${name}" — two routes present as the same path. Likely a duplicated/artifact route.`,
    );
  }
  for (const route of journey.routes) {
    for (const id of findDuplicates(route.steps, (s) => s.id)) {
      structural.push(
        `Route "${route.id}" has duplicate step id "${id}" — step ids must be unique within a route (forks reference them by id).`,
      );
    }
  }

  // ---- [review] far-future steps should carry the hedge (rule 13) ----
  const farFuture = journey.routes.flatMap((r) =>
    r.steps
      .filter((s) => s.offsetMonths > FAR_FUTURE_MONTHS && !HEDGE_RE.test(s.description))
      .map((s) => `"${r.id}/${s.id}" (${s.offsetMonths}mo)`),
  );
  if (farFuture.length > 0) {
    review.push(
      `Far-future steps (>5yr out) without a visible "rules may change — verify when you get there" hedge: ${farFuture.join(", ")}. Confirm the hedge before promoting.`,
    );
  }

  // ---- [review] UNVERIFIED high-stakes claims with NO grounding (rule 3) ----
  // Table-sourced exams/colleges are verified (facts come from data/*.json), so
  // they need no grounding. Only model-grounded, still-unverified specifics do —
  // and stripping search-redirect URLs (rule 12) can leave them with none.
  const hasUnverifiedSpecifics = journey.routes.some(
    (r) => r.exams.some((e) => !e.verified) || r.colleges.some((c) => !c.verified),
  );
  if (hasUnverifiedSpecifics && journey.groundingSources.length === 0) {
    review.push(
      `Journey has unverified exams/colleges but ZERO grounding sources (likely all were search-redirect links and got stripped). Re-ground these claims or downgrade them to general guidance before promoting.`,
    );
  }

  return { structural, review };
}
