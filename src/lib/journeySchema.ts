/**
 * Runtime validation for a model-generated (or stored) Journey.
 *
 * There's no schema library in the project, so this is a hand-rolled validator
 * that mirrors src/lib/types.ts. It does two jobs:
 *
 *  1. **Validate** — returns null if a required field is missing or the wrong
 *     type, so a malformed model response never reaches the UI (spec §3 phase 3:
 *     "validate the response against the Journey type before returning").
 *  2. **Sanitize** — rebuilds clean objects field-by-field, dropping anything
 *     the model emitted that isn't in the type. That's how we enforce "the model
 *     must never output absolute dates" (spec §3 rule 7): a step's `targetPeriod`
 *     or any stray date field is simply not copied — only the relative
 *     `offsetMonths` survives, and the UI computes the displayed period in code
 *     (see lib/timeline.ts).
 */

import type {
  College,
  CollegeType,
  Confidence,
  CostBand,
  Exam,
  Feasibility,
  GroundingSource,
  Journey,
  JourneyStep,
  PrepResource,
  ResourceType,
  Route,
  RouteSkills,
  StepType,
  UpskillingOption,
} from "./types";

// ---- small guards ----------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * True for a search-grounding REDIRECT/tracking URL that must never be shown as a
 * user-facing "verify" link (spec §3 rule 12). Gemini's `google_search` grounding
 * returns opaque redirects like
 * `https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC…` — these
 * don't resolve to a stable official page, leak a tracking token, and rot fast.
 * We only ever surface a real `officialUrl`, so any of these is stripped on the
 * way in (here) and on the way out (stored files are re-validated on read).
 */
export function isSearchRedirectUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("vertexaisearch.cloud.google.com") ||
    u.includes("grounding-api-redirect") ||
    /\bgoogle\.[a-z.]+\/url\?/.test(u) || // www.google.com/url?q=… redirector
    u.includes("googleusercontent.com/grounding")
  );
}

/**
 * Normalize a user-facing URL: trim it, then BLANK it if it's not a real http(s)
 * link the student can verify — i.e. a search-redirect (above) or a non-http
 * scheme. Returning "" (rather than dropping the field) keeps the object shape
 * stable; the UI already hides empty links.
 */
function cleanUrl(v: unknown): string {
  const url = str(v).trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";
  if (isSearchRedirectUrl(url)) return "";
  return url;
}

const COST_BANDS: CostBand[] = ["free", "low", "mid", "high"];
function costBand(v: unknown): CostBand {
  return COST_BANDS.includes(v as CostBand) ? (v as CostBand) : "mid";
}
const CONFIDENCE: Confidence[] = ["high", "medium", "low"];
function confidence(v: unknown): Confidence {
  return CONFIDENCE.includes(v as Confidence) ? (v as Confidence) : "low";
}
const FEASIBILITY: Feasibility[] = ["high", "medium", "low"];
function feasibility(v: unknown): Feasibility {
  return FEASIBILITY.includes(v as Feasibility) ? (v as Feasibility) : "medium";
}
const STEP_TYPES: StepType[] = [
  "education",
  "exam",
  "application",
  "experience",
  "skill",
];
/**
 * Coerce a step type to the closed enum (spec §3 rule 12). `"other"` is forbidden,
 * so an unknown/forbidden value falls back to "education" — a real, neutral type
 * — rather than passing `"other"` through. The fallback is rare in practice: the
 * system prompt instructs the model to pick a real type for every step.
 */
function stepType(v: unknown): StepType {
  return STEP_TYPES.includes(v as StepType) ? (v as StepType) : "education";
}
const COLLEGE_TYPES: CollegeType[] = ["government", "private", "deemed"];
function collegeType(v: unknown): CollegeType {
  return COLLEGE_TYPES.includes(v as CollegeType) ? (v as CollegeType) : "private";
}
const RESOURCE_TYPES: ResourceType[] = ["video", "free-course", "official-guide", "book"];
function resourceType(v: unknown): ResourceType {
  return RESOURCE_TYPES.includes(v as ResourceType) ? (v as ResourceType) : "official-guide";
}

// ---- per-node sanitizers (return null only when a required field is unusable) -

function parseStep(v: unknown): JourneyStep | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  // Accept either a real number or a numeric string for the relative offset.
  const rawOffset = typeof v.offsetMonths === "string" ? Number(v.offsetMonths) : v.offsetMonths;
  if (!id || !title || typeof rawOffset !== "number" || !Number.isFinite(rawOffset)) {
    return null;
  }
  const order =
    typeof v.order === "number"
      ? v.order
      : typeof v.order === "string" && v.order.trim()
        ? Number(v.order)
        : NaN;
  // Note: NO targetPeriod / date copied here — dates are computed in code only.
  const step: JourneyStep = {
    id,
    order: Number.isFinite(order) ? order : 0,
    type: stepType(v.type),
    title,
    offsetMonths: Math.max(0, Math.round(rawOffset)),
    description: str(v.description),
  };
  if (v.optional === true) step.optional = true;
  if (typeof v.alternativeTo === "string" && v.alternativeTo) {
    step.alternativeTo = v.alternativeTo;
  }
  return step;
}

function parseUpskilling(v: unknown): UpskillingOption | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  if (!name) return null;
  return {
    name,
    why: str(v.why),
    costBand: costBand(v.costBand),
    url: cleanUrl(v.url),
    verified: bool(v.verified),
  };
}

function parseSkills(v: unknown): RouteSkills {
  const o = isObj(v) ? v : {};
  return {
    coreSkills: strArray(o.coreSkills),
    upskilling: arr(o.upskilling)
      .map(parseUpskilling)
      .filter((x): x is UpskillingOption => x !== null),
  };
}

function parseExam(v: unknown): Exam | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  if (!name) return null;
  const id = str(v.id);
  const supersededByName = str(v.supersededByName);
  return {
    ...(id ? { id } : {}),
    name,
    purpose: str(v.purpose),
    eligibility: str(v.eligibility),
    typicalWindow: str(v.typicalWindow),
    costBand: costBand(v.costBand),
    officialUrl: cleanUrl(v.officialUrl),
    verified: bool(v.verified),
    ...(supersededByName ? { supersededByName } : {}),
  };
}

function parseCollege(v: unknown): College | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  if (!name) return null;
  // Tolerate a model that emits state/city separately (spec §2 shape) and fold
  // them into the single `location` field the type/UI actually use.
  const location =
    str(v.location) ||
    [str(v.city), str(v.state)].filter(Boolean).join(", ");
  const id = str(v.id);
  return {
    ...(id ? { id } : {}),
    name,
    type: collegeType(v.type),
    location,
    approxAnnualFees: str(v.approxAnnualFees),
    feesNote: str(v.feesNote),
    entranceRequired: str(v.entranceRequired),
    costBand: costBand(v.costBand),
    officialUrl: cleanUrl(v.officialUrl),
    verified: bool(v.verified),
  };
}

function parseRoute(v: unknown): Route | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const name = str(v.name);
  const steps = arr(v.steps).map(parseStep).filter((s): s is JourneyStep => s !== null);
  if (!id || !name || steps.length === 0) return null;
  const fb = isObj(v.missedDeadlineFallback) ? v.missedDeadlineFallback : {};
  return {
    id,
    name,
    bestFor: str(v.bestFor),
    feasibility: feasibility(v.feasibility),
    feasibilityReason: str(v.feasibilityReason),
    costBand: costBand(v.costBand),
    duration: str(v.duration),
    steps,
    skills: parseSkills(v.skills),
    exams: arr(v.exams).map(parseExam).filter((e): e is Exam => e !== null),
    colleges: arr(v.colleges).map(parseCollege).filter((c): c is College => c !== null),
    missedDeadlineFallback: {
      applies: bool(fb.applies, false),
      options: strArray(fb.options),
    },
  };
}

function parsePrepResource(v: unknown): PrepResource | null {
  if (!isObj(v)) return null;
  const title = str(v.title);
  if (!title) return null;
  return {
    title,
    type: resourceType(v.type),
    costBand: costBand(v.costBand),
    language: str(v.language, "en"),
    url: cleanUrl(v.url),
    verified: bool(v.verified),
  };
}

function parseGroundingSource(v: unknown): GroundingSource | null {
  if (!isObj(v)) return null;
  // A grounding source whose only URL is a search-redirect is useless as a
  // citation (it doesn't resolve to a stable page), so drop the whole entry
  // rather than surface a dead/tracking link — spec §3 rule 12.
  const url = cleanUrl(v.url);
  if (!url) return null;
  return { claim: str(v.claim), url, fetchedAt: str(v.fetchedAt) };
}

// ---- top-level -------------------------------------------------------------

/**
 * Validate + sanitize an arbitrary value into a Journey, or return null if it
 * can't be made into a usable one. The caller normalizes `meta` afterwards.
 */
export function parseJourney(value: unknown): Journey | null {
  if (!isObj(value)) return null;
  const meta = isObj(value.meta) ? value.meta : null;
  const overview = isObj(value.overview) ? value.overview : null;
  if (!meta || !overview) return null;

  const routes = arr(value.routes)
    .map(parseRoute)
    .filter((r): r is Route => r !== null);
  if (routes.length === 0) return null;

  const profile = isObj(meta.studentProfile) ? meta.studentProfile : {};
  const pay = isObj(overview.payRange) ? overview.payRange : {};

  return {
    meta: {
      career: str(meta.career),
      careerAliases: strArray(meta.careerAliases),
      studentProfile: {
        class: str(profile.class),
        board: str(profile.board) || undefined,
        stream: str(profile.stream) || undefined,
        language: str(profile.language) || undefined,
        currentDate: str(profile.currentDate) || undefined,
      },
      generatedAt: str(meta.generatedAt),
      confidence: confidence(meta.confidence),
      cacheKey: str(meta.cacheKey),
    },
    overview: {
      summary: str(overview.summary),
      dayInLife: str(overview.dayInLife),
      payRange: {
        entry: str(pay.entry),
        experienced: str(pay.experienced),
        note: str(pay.note),
      },
      demandOutlook: str(overview.demandOutlook),
      requirements: strArray(overview.requirements),
    },
    routes,
    prepResources: arr(value.prepResources)
      .map(parsePrepResource)
      .filter((r): r is PrepResource => r !== null),
    groundingSources: arr(value.groundingSources)
      .map(parseGroundingSource)
      .filter((g): g is GroundingSource => g !== null),
    disclaimers: strArray(value.disclaimers),
  };
}
