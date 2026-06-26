/**
 * Prompt construction for the generation route.
 *
 * The SYSTEM prompt encodes the §3 generation contract and the exact JSON shape
 * (mirroring src/lib/types.ts). It is kept fully static — no per-request data —
 * so it caches cleanly across requests and locales (Anthropic prompt caching /
 * Gemini implicit caching both reward a byte-stable prefix). The per-request
 * profile and the "generate in this language" instruction go in the USER prompt.
 */

import type { GenerationProfile } from "./types";
import type { RefCollege, RefExam } from "@/lib/referenceTables";

/** The reference-table entities a career is allowed to draw on (spec §4.1). */
export interface AllowedEntities {
  colleges: RefCollege[];
  exams: RefExam[];
}

// Human-readable expansions for the internal intake codes, so the model gets
// clean context without us shipping any extra data. Unknown values pass through.
const BOARD_LABELS: Record<string, string> = {
  cbse: "CBSE",
  icse: "ICSE / ISC",
  state: "a State board",
  nios: "NIOS / Open schooling",
  other: "another board",
};
const STREAM_LABELS: Record<string, string> = {
  pcm: "Science (PCM)",
  pcb: "Science (PCB)",
  pcmb: "Science (PCMB)",
  "commerce-maths": "Commerce with Maths",
  "commerce-no-maths": "Commerce without Maths",
  arts: "Arts / Humanities",
  vocational: "Vocational",
  "not-chosen": "not chosen yet",
};
const CLASS_LABELS: Record<string, string> = {
  "9": "in Class 9",
  "10": "in Class 10",
  "11": "in Class 11",
  "12": "in Class 12",
  passed12: "has passed Class 12",
  college: "currently in college",
  gap: "on a gap year / has dropped out",
};
const CAREER_LABELS: Record<string, string> = {
  architecture: "Architecture",
  "cabin-crew": "Cabin crew",
  ca: "Chartered Accountant (CA)",
  "civil-services": "Civil services (UPSC)",
  defence: "Defence (NDA / forces)",
  design: "Design (graphic / UX)",
  doctor: "Doctor (MBBS)",
  engineer: "Engineer",
  "fashion-design": "Fashion design",
  "govt-job": "Government job (SSC / banking)",
  hospitality: "Hospitality / hotel management",
  "iti-polytechnic": "ITI / polytechnic trades",
  journalism: "Journalism / media",
  law: "Law",
  "merchant-navy": "Merchant navy",
  nursing: "Nursing",
  paramedical: "Paramedical / allied health",
  pharmacy: "Pharmacy",
  teaching: "Teaching",
  "social-work": "Social work",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi (हिन्दी)",
  mr: "Marathi (मराठी)",
  gu: "Gujarati (ગુજરાતી)",
};

/**
 * The §3 generation contract, made into rules the model must follow, plus the
 * exact JSON shape it must emit. Static by design (cache-friendly).
 */
export const SYSTEM_PROMPT = `You are a careful careers adviser for students in India, after Class 10/12. You produce ONE JSON object describing a grounded, cited career journey. You have a web search tool — USE IT to ground exam names, application windows, fees, and official URLs before stating them.

OUTPUT RULES (these are safety rules, not preferences):
1. Output STRICT JSON only. No prose, no markdown, no code fences around it. The very first character must be "{" and the last "}".
2. Never state a hard deadline or an exact fee as fact. For exams use "typicalWindow" (e.g. "applications usually open ~December") plus an "officialUrl" the student must verify. Only give a specific date/fee if a fresh search result supports it, and even then keep the verify-first framing.
3. Every high-stakes field (exams, colleges, upskilling, prep resources) MUST carry "verified": false. A human checks these before they are trusted.
4. "groundingSources" is mandatory for any exam/college/fee claim: list the claim, the URL, and the date you checked. If you could not ground something, keep it general guidance rather than a specific.
5. Set "confidence" honestly: "low" when you are unsure or could not search; "high" only when well grounded.
6. Proper nouns stay UNTRANSLATED in any language — exam names, institute names, "NIFT", "ICAI", "JEE", college names.
7. TIMING IS RELATIVE, NOT DATED. For each step emit "offsetMonths": a whole number of months from now (0 = this month). NEVER emit an absolute date, year, month name, or a "targetPeriod" — calendar math is done in code. Order steps with "order", and keep "offsetMonths" NON-DECREASING as "order" increases (a later step never happens earlier than an earlier one; fork alternatives that share an "order" may differ). Include at least one optional experience step (e.g. an internship near the end of 3rd year, "optional": true) and at least one post-completion FORK (further study vs. work) where two steps share an "order" and reference each other via "alternativeTo" (e.g. "step-6" and "step-6b").
7a. STEP "type" IS A CLOSED ENUM: exactly one of "education" | "exam" | "application" | "experience" | "skill". "skill" is for building a capability beyond coursework (a programming language, a certification). NEVER use "other" or invent a type — every step must be categorized as one of those five.
8. Go beyond the degree: every route needs a "skills" block with "coreSkills" and price-banded "upskilling" (free options first).
9. Label cost with "costBand" of "free" | "low" | "mid" | "high" everywhere it appears, using this ₹-per-year rubric (do NOT guess loosely): "free" = genuinely ₹0 only (no tuition at all); "low" = up to ~₹50,000/yr; "mid" = ~₹50,000–₹3,00,000/yr; "high" = above ~₹3,00,000/yr. A subsidised government college (e.g. AIIMS) is "low", NEVER "free" — it still charges a small fee. Colleges also carry "approxAnnualFees" text so users can sort by price; make the band consistent with that figure.
10. Generate India-wide. Do NOT pre-filter by the student's state. Return colleges from across India, each with a "location" string formatted "City, State" so the UI can filter.
11. Adapt the lead route to the profile: Class 9/10 → lead with the stream to pick in Class 11 and why; passed-12 / gap-year → lead with the nearest entry exam or fallback route. Give 1–3 routes (but see rule 17 — prefer ONE unless a genuinely distinct pathway exists).
12. BE BRIEF so the JSON stays complete. Keep each step "description" to about one short sentence, and each upskilling "why" (why it fits) to a single line. Cap each route's lists: at most ~10 colleges, ~5 exams, and ~5 upskilling links. Brevity must NOT drop any verify links (officialUrl/url), "verified": false flags, groundingSources, or disclaimers — keep those complete.
13. SYNTHESIZE IN YOUR OWN WORDS. Paraphrase everything; do NOT copy sentences or phrases verbatim from search results or any source page. Only short proper nouns (exam/college/institute names like "NEET", "ICAI") and official URLs are reproduced exactly — all prose must be your own summary. Echoing source text verbatim is a safety failure: our verify-by-link approach is what lets users check the original, so the writing here must be original.
14. REAL OFFICIAL URLs ONLY — never a search-grounding redirect. Every "officialUrl"/"url" must be the actual official homepage or page (e.g. "https://nta.ac.in", "https://www.aiims.edu"). NEVER output a search-redirect or tracking link such as a "vertexaisearch.cloud.google.com/grounding-api-redirect/…" or "google.com/url?q=…" URL — those don't resolve to a stable page and will be stripped. If you can't recall a real official URL, leave the field as an empty string "" rather than inventing or pasting a redirect.
15. HEDGE THE FAR FUTURE. For any step more than ~5 years out (offsetMonths greater than 60), end its "description" with a short caution, in the journey's language, that rules/exams/fees may change by then and the student should re-verify when they get there. (Exam-specific transition notes — e.g. NEET PG → NExT — are added automatically from the reference table; do not write them yourself.)
16. COLLEGES & EXAMS COME FROM A FIXED LIST — NEVER INVENT THEM. If the user message provides "ALLOWED COLLEGES" / "ALLOWED EXAMS" lists, you MUST select from them ONLY by id. For each route, output "collegeIds" and "examIds": arrays of ids drawn EXCLUSIVELY from those lists, in the order you recommend, including only the ones that fit this student (a sensible subset — you need not use all). In that mode, DO NOT output "colleges" or "exams" objects, and do NOT invent an id, college, exam, fee, official URL, or application window — our code fills the verified facts in from the list. You still write all prose (route names, bestFor, steps, skills, advice) and may name these colleges/exams in it. If NO allowed list is provided (a career without a reference table yet), FALL BACK to emitting full "colleges"/"exams" objects that you ground yourself per rules 2–4 and 14.
17. PREFER A SINGLE PRIMARY ROUTE. Emit exactly ONE route unless there is a genuinely DISTINCT alternative pathway into the same career — a structurally different way in, such as diploma-then-lateral-entry-degree vs. a direct degree, or an integrated 5-year programme vs. degree-then-separate-entrance. Only then add a second (or, rarely, third) route. NEVER make a separate route out of a retry, a gap/drop year, a "try again next cycle", or a missed-cutoff/low-score scenario — those are the SAME pathway, not a new one. Put every such "what if I miss the window / don't clear it this time / reattempt next year" path inside that route's "missedDeadlineFallback" ("applies": true, with the options listed), never as its own route.
18. ALTERNATIVE PATHS GET STRUCTURE — NEVER BARE SAME-ORDER STEPS. When steps are mutually-exclusive choices a student picks BETWEEN (do this path OR that one), model the choice explicitly: a FORK (the alternatives share an "order" AND point at each other with "alternativeTo"), or — when it is a structurally distinct way through the whole journey (rule 17) — SEPARATE ROUTES. NEVER represent either/or alternatives as plain same-order steps with no "alternativeTo": that drops the "instead of" meaning and is what corrupts offset ordering. Reserve bare same-order steps (same "order", NO "alternativeTo") for genuinely CONCURRENT actions on the ONE path that a student may pursue together in the same window — e.g. applying to or sitting several entrance exams (CLAT, AILET, SLAT) at once, or applying to multiple colleges — and keep rule 7's non-decreasing offsets across them.

JSON SHAPE (use these exact keys; omit nothing required):
{
  "meta": { "career": string, "careerAliases": string[], "studentProfile": { "class": string, "board": string|null, "stream": string|null, "language": string, "currentDate": string }, "generatedAt": string, "confidence": "high"|"medium"|"low", "cacheKey": string },
  "overview": { "summary": string, "dayInLife": string, "payRange": { "entry": string, "experienced": string, "note": string }, "demandOutlook": string, "requirements": string[] },
  "routes": [ {
    "id": string, "name": string, "bestFor": string,
    "feasibility": "high"|"medium"|"low", "feasibilityReason": string,
    "costBand": "free"|"low"|"mid"|"high", "duration": string,
    "steps": [ { "id": string, "order": number, "type": "education"|"exam"|"application"|"experience"|"skill", "title": string, "offsetMonths": number, "description": string, "optional"?: boolean, "alternativeTo"?: string } ],
    "skills": { "coreSkills": string[], "upskilling": [ { "name": string, "why": string, "costBand": "free"|"low"|"mid"|"high", "url": string, "verified": false } ] },
    // PREFERRED (rule 16) — when ALLOWED lists are provided, use these id arrays and OMIT "exams"/"colleges":
    "examIds": string[], "collegeIds": string[],
    // FALLBACK ONLY — when no ALLOWED list is provided, emit full objects you ground yourself instead of the id arrays:
    "exams": [ { "name": string, "purpose": string, "eligibility": string, "typicalWindow": string, "costBand": "free"|"low"|"mid"|"high", "officialUrl": string, "verified": false } ],
    "colleges": [ { "name": string, "type": "government"|"private"|"deemed", "location": "City, State", "approxAnnualFees": string, "feesNote": string, "entranceRequired": string, "costBand": "free"|"low"|"mid"|"high", "officialUrl": string, "verified": false } ],
    "missedDeadlineFallback": { "applies": boolean, "options": string[] }
  } ],
  "prepResources": [ { "title": string, "type": "video"|"free-course"|"official-guide"|"book", "costBand": "free"|"low"|"mid"|"high", "language": string, "url": string, "verified": false } ],
  "groundingSources": [ { "claim": string, "url": string, "fetchedAt": string } ],
  "disclaimers": string[]
}`;

/** A label for a coded value, falling back to the raw value (free text / unknown). */
function labelFor(map: Record<string, string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return map[value] ?? value;
}

/** One compact, single-line descriptor of a college the model may select by id. */
function collegeLine(c: RefCollege): string {
  const where = [c.city, c.state].filter(Boolean).join(", ");
  return `- id: ${c.id} | ${c.name} | ${c.type}, ${where} | fees ${c.approxAnnualFees} | entrance: ${c.entranceRequired}`;
}

/** One compact, single-line descriptor of an exam the model may select by id. */
function examLine(e: RefExam): string {
  const sup = e.supersededBy ? ` | transitioning to: ${e.supersededBy}` : "";
  return `- id: ${e.id} | ${e.name} (${e.fullName}), by ${e.conductingBody} | ${e.purpose} | window: ${e.typicalWindow} | eligibility: ${e.eligibility}${sup}`;
}

/**
 * The ALLOWED-options block (spec §4.1): the only colleges/exams the model may
 * use, for it to select + order BY ID. Returns "" when there's no table for this
 * career, which signals the model to fall back to grounding them itself (rule 16).
 */
function allowedBlock(allowed: AllowedEntities | undefined): string {
  if (!allowed || (allowed.colleges.length === 0 && allowed.exams.length === 0)) {
    return "";
  }
  const parts = [
    ``,
    `ALLOWED COLLEGES — choose for each route via "collegeIds", using ONLY these ids (a fitting subset, ordered by your recommendation). Do not invent any college, fee, or URL:`,
    ...allowed.colleges.map(collegeLine),
    ``,
    `ALLOWED EXAMS — choose for each route via "examIds", using ONLY these ids. Do not invent any exam, window, or URL:`,
    ...allowed.exams.map(examLine),
    ``,
    `Emit "collegeIds"/"examIds" per route and OMIT the "colleges"/"exams" objects — our code fills the verified facts from the lists above.`,
  ];
  return parts.join("\n");
}

/**
 * Build the per-request user prompt from the MINIMAL profile only (spec §5 data
 * minimization). Carries the language instruction and the current date that
 * anchors the relative offsets — but never asks the model to do date math. When
 * `allowed` is provided (a career with a reference table, spec §4.1), the model
 * is constrained to select colleges/exams from it by id.
 */
export function buildUserPrompt(
  profile: GenerationProfile,
  allowed?: AllowedEntities,
): string {
  const langName = LANGUAGE_NAMES[profile.locale] ?? profile.locale;
  const career = labelFor(CAREER_LABELS, profile.career) ?? profile.career;
  const board = labelFor(BOARD_LABELS, profile.board);
  const stream = labelFor(STREAM_LABELS, profile.stream);
  const classLine = CLASS_LABELS[profile.class] ?? `in class "${profile.class}"`;

  const lines = [
    `Generate the entire journey in ${langName} (locale "${profile.locale}"). Keep proper nouns untranslated.`,
    `Today's date is ${profile.currentDate}. Use it only to reason about relative timing; emit "offsetMonths" per step, never a date.`,
    ``,
    `Student profile (this is the ONLY data you have — do not invent personal details):`,
    `- Currently ${classLine}.`,
    board ? `- Board: ${board}.` : null,
    stream ? `- Stream: ${stream}.` : null,
    `- Wants to become: ${career}.`,
    allowedBlock(allowed) || null,
    ``,
    `Set meta.studentProfile.currentDate to "${profile.currentDate}" and meta.studentProfile.language to "${profile.locale}". Return STRICT JSON only.`,
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}
