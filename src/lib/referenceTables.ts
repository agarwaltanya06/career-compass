/**
 * Reference tables — the canonical colleges & exams (spec §4.1).
 *
 * Facts (names, fees, official URLs, windows) live HERE, verified once and reused
 * across every journey, never re-invented per generation. `data/colleges.json`
 * and `data/exams.json` are the source of truth; this module loads them, lets the
 * generator look up the entities allowed for a career, and converts a table row
 * into the journey-facing `College`/`Exam` shape.
 *
 * The model only ever SELECTS and ORDERS from these by `id` (see prompt.ts +
 * run.ts hydration); the facts in the journey come from the table, so a model
 * can't invent a college, fee, or window.
 *
 * The JSON is imported (bundled) rather than read via fs, matching how the i18n
 * messages load — small, static, and type-checked. Editing a row (e.g. filling
 * in a `costBand`) takes effect on the next build / dev reload.
 */

import collegesJson from "../../data/colleges.json";
import examsJson from "../../data/exams.json";
import type { College, CollegeType, CostBand, Exam } from "./types";

/** One row of `data/colleges.json`. `costBand` is "" until a human sets it (§3 rubric). */
export interface RefCollege {
  id: string;
  name: string;
  type: CollegeType;
  state: string;
  city: string;
  approxAnnualFees: string;
  costBand: CostBand | "";
  entranceRequired: string;
  officialUrl: string;
  careers: string[];
  lastVerified: string | null;
  verified: boolean;
}

/** One row of `data/exams.json`. */
export interface RefExam {
  id: string;
  name: string;
  fullName: string;
  conductingBody: string;
  purpose: string;
  typicalWindow: string;
  eligibility: string;
  costBand: CostBand | "";
  officialUrl: string;
  careers: string[];
  /** Optional id of the exam that replaces this one (e.g. neet-pg → next). */
  supersededBy?: string;
  lastVerified: string | null;
  verified: boolean;
}

const COLLEGES = collegesJson as RefCollege[];
const EXAMS = examsJson as RefExam[];

const COLLEGE_BY_ID = new Map(COLLEGES.map((c) => [c.id, c]));
const EXAM_BY_ID = new Map(EXAMS.map((e) => [e.id, e]));

/** Normalize a career token (slug or label) for tag matching. */
function norm(career: string): string {
  return career.trim().toLowerCase();
}

/** Colleges whose `careers` tag includes this career, in file order. */
export function collegesForCareer(career: string): RefCollege[] {
  const key = norm(career);
  return COLLEGES.filter((c) => c.careers.some((x) => norm(x) === key));
}

/** Exams whose `careers` tag includes this career, in file order. */
export function examsForCareer(career: string): RefExam[] {
  const key = norm(career);
  return EXAMS.filter((e) => e.careers.some((x) => norm(x) === key));
}

export function getCollege(id: string): RefCollege | undefined {
  return COLLEGE_BY_ID.get(id);
}
export function getExam(id: string): RefExam | undefined {
  return EXAM_BY_ID.get(id);
}

/** Shown next to fees on every table-sourced college — the facts are still "verify". */
const FEES_NOTE = "approximate — confirm on official site";

/**
 * Convert a table row into the journey's `College` shape. Returns a plain object
 * (not yet validated): an empty `costBand` is left as-is for parseJourney to
 * coerce, so an un-banded table row is visible rather than silently dropped.
 */
export function toCollegeShape(ref: RefCollege): College {
  return {
    id: ref.id,
    name: ref.name,
    type: ref.type,
    location: [ref.city, ref.state].filter(Boolean).join(", "),
    approxAnnualFees: ref.approxAnnualFees,
    feesNote: FEES_NOTE,
    entranceRequired: ref.entranceRequired,
    // "" is not a valid CostBand; parseJourney coerces it. Cast keeps the shape.
    costBand: ref.costBand as CostBand,
    officialUrl: ref.officialUrl,
    verified: ref.verified,
  };
}

/**
 * Convert a table row into the journey's `Exam` shape. When the row has a
 * `supersededBy` id that resolves to another table exam, the successor's
 * proper-noun name is baked in as `supersededByName` so the UI can show the
 * transition note deterministically (spec §4.1) — e.g. neet-pg → "NExT
 * (National Exit Test)".
 */
export function toExamShape(ref: RefExam): Exam {
  const successor = ref.supersededBy ? getExam(ref.supersededBy) : undefined;
  return {
    id: ref.id,
    name: ref.name,
    purpose: ref.purpose,
    eligibility: ref.eligibility,
    typicalWindow: ref.typicalWindow,
    costBand: ref.costBand as CostBand,
    officialUrl: ref.officialUrl,
    verified: ref.verified,
    ...(successor ? { supersededByName: `${successor.name} (${successor.fullName})` } : {}),
  };
}
