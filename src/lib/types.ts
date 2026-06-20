/**
 * The `journey` object — the single contract shared by the UI and (later) the
 * generation endpoint. Mirrors section 2 of journey-spec.md.
 *
 * Keep this file as the source of truth: the hard-coded sample, the renderer,
 * and the future `/api/generate` route all consume these exact shapes.
 */

/** Cost buckets used for the cost-band filter on routes, colleges, exams, etc. */
export type CostBand = "free" | "low" | "mid" | "high";

/** The model's own freshness / trust rating for a journey. */
export type Confidence = "high" | "medium" | "low";

/** Relative feasibility of a route *for this particular student*. */
export type Feasibility = "high" | "medium" | "low";

/**
 * What kind of milestone a timeline step represents. The enum is deliberately
 * closed and `"other"` is NOT a member: the model must categorize every step as
 * a real type (spec §3 rule 12 — "never `other`"). The validator coerces an
 * unknown/forbidden value to a real type rather than letting `"other"` through.
 */
export type StepType =
  | "education"
  | "exam"
  | "application"
  | "experience"
  | "skill";

/** College ownership type. */
export type CollegeType = "government" | "private" | "deemed";

/** Kind of prep resource. */
export type ResourceType = "video" | "free-course" | "official-guide" | "book";

/**
 * The profile collected during the adaptive intake (section 1). Most fields are
 * optional because branching means not every student answers every question.
 */
export interface StudentProfile {
  class: string;
  board?: string;
  /** Only collected for class >= 11. */
  stream?: string;
  /** Self-reported comfort with English, used to pick resource language. */
  englishComfort?: "low" | "okay" | "high";
  /** Preferred language for the plan, e.g. "en" | "hi". */
  language?: string;
  /**
   * ISO date string anchoring the dated timeline. The model emits relative
   * `offsetMonths` per step; code computes each `targetPeriod` from this. Location
   * is no longer collected here — results are filtered by location instead.
   */
  currentDate?: string;
}

export interface JourneyMeta {
  career: string;
  /** Alternate names for search + regional matching, e.g. ["CA", "सीए"]. */
  careerAliases: string[];
  studentProfile: StudentProfile;
  /** ISO date string. */
  generatedAt: string;
  confidence: Confidence;
  /** Normalized cache key — see section 4 of the spec. */
  cacheKey: string;
}

export interface PayRange {
  entry: string;
  experienced: string;
  /** Always a hedge, never presented as a hard fact. */
  note: string;
}

export interface JourneyOverview {
  summary: string;
  dayInLife: string;
  payRange: PayRange;
  demandOutlook: string;
  /** Height / vision / age and similar gating requirements where relevant. */
  requirements: string[];
}

export interface JourneyStep {
  /**
   * Stable identifier for this step, used to wire up `alternativeTo` forks.
   * e.g. "step-1", "step-6", "step-6b".
   */
  id: string;
  /** Sort position on the timeline. Fork alternatives share the same order. */
  order: number;
  type: StepType;
  title: string;
  /**
   * Months from `studentProfile.currentDate`. The MODEL emits this relative
   * offset only; the UI computes the coarse, human `targetPeriod` ("Mid 2026")
   * from it in code (see lib/timeline.ts). The model never emits absolute dates,
   * so calendar arithmetic stays deterministic — spec §2.1 + §3 rule 7.
   */
  offsetMonths: number;
  description: string;
  /** Non-essential milestone (e.g. a summer internship) — rendered as skippable. */
  optional?: boolean;
  /**
   * The `id` of another step this one is an either/or alternative to (e.g. a
   * post-degree fork: further study vs. a job). Forks render as a branch, not
   * as two parallel mandatory steps — spec §2.1 + §3 rule 8.
   */
  alternativeTo?: string;
}

/**
 * A high-stakes specific (exam/college/resource). `verified: false` means the
 * UI must show a "confirm on official site" tag — see section 3, rule 2.
 */
export interface Exam {
  /**
   * Canonical id of the source row in `data/exams.json` when this exam came from
   * the reference table (spec §4.1). Present on table-sourced exams; absent on a
   * legacy model-grounded one. Lets the UI/verification link back to the entity.
   */
  id?: string;
  name: string;
  purpose: string;
  eligibility: string;
  /** e.g. "applications usually open ~December" — never a hard date. */
  typicalWindow: string;
  costBand: CostBand;
  officialUrl: string;
  verified: boolean;
  /**
   * Proper-noun name of the exam that is replacing this one, resolved
   * deterministically from the reference table's `supersededBy` field at
   * hydration (spec §4.1). Drives the UI's "transitioning to X — confirm which
   * applies to your batch" note, so the transition is data-driven, not prose the
   * model has to remember (e.g. NEET PG → "NExT (National Exit Test)").
   */
  supersededByName?: string;
}

export interface College {
  /** Canonical id of the source row in `data/colleges.json` (spec §4.1). */
  id?: string;
  name: string;
  type: CollegeType;
  location: string;
  approxAnnualFees: string;
  /** Hedge text shown next to the fees. */
  feesNote: string;
  entranceRequired: string;
  costBand: CostBand;
  officialUrl: string;
  verified: boolean;
}

export interface MissedDeadlineFallback {
  applies: boolean;
  options: string[];
}

/**
 * A price-banded upskilling option — what to learn beyond the degree and where.
 * Free options should be listed first (spec §3, rule 8). `verified: false` shows
 * the "confirm on official site" tag, like other high-stakes specifics.
 */
export interface UpskillingOption {
  name: string;
  why: string;
  costBand: CostBand;
  url: string;
  verified: boolean;
}

/** Skills BEYOND the degree for a route: core skills + price-banded upskilling. */
export interface RouteSkills {
  /** Skills to build regardless of route, e.g. problem-solving, a language. */
  coreSkills: string[];
  /** Concrete courses/resources to upskill, free ones first. */
  upskilling: UpskillingOption[];
}

export interface Route {
  id: string;
  name: string;
  bestFor: string;
  feasibility: Feasibility;
  feasibilityReason: string;
  costBand: CostBand;
  duration: string;
  steps: JourneyStep[];
  /** Skills beyond the degree: core skills + price-banded upskilling options. */
  skills: RouteSkills;
  exams: Exam[];
  colleges: College[];
  missedDeadlineFallback: MissedDeadlineFallback;
}

export interface PrepResource {
  title: string;
  type: ResourceType;
  costBand: CostBand;
  language: string;
  url: string;
  verified: boolean;
}

export interface GroundingSource {
  claim: string;
  url: string;
  /** ISO date string. */
  fetchedAt: string;
}

export interface Journey {
  meta: JourneyMeta;
  overview: JourneyOverview;
  routes: Route[];
  prepResources: PrepResource[];
  groundingSources: GroundingSource[];
  disclaimers: string[];
}
