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

/** What kind of milestone a timeline step represents. */
export type StepType = "education" | "exam" | "experience" | "skill" | "other";

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
  order: number;
  type: StepType;
  title: string;
  /** Soft timing like "Class 11–12" or "after 12th" — never a hard date. */
  timing: string;
  description: string;
}

/**
 * A high-stakes specific (exam/college/resource). `verified: false` means the
 * UI must show a "confirm on official site" tag — see section 3, rule 2.
 */
export interface Exam {
  name: string;
  purpose: string;
  eligibility: string;
  /** e.g. "applications usually open ~December" — never a hard date. */
  typicalWindow: string;
  costBand: CostBand;
  officialUrl: string;
  verified: boolean;
}

export interface College {
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

export interface Route {
  id: string;
  name: string;
  bestFor: string;
  feasibility: Feasibility;
  feasibilityReason: string;
  costBand: CostBand;
  duration: string;
  steps: JourneyStep[];
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
