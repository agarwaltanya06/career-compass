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
7. TIMING IS RELATIVE, NOT DATED. For each step emit "offsetMonths": a whole number of months from now (0 = this month). NEVER emit an absolute date, year, month name, or a "targetPeriod" — calendar math is done in code. Order steps with "order"; include at least one optional experience step (e.g. an internship near the end of 3rd year, "optional": true) and at least one post-completion FORK (further study vs. work) where two steps share an "order" and reference each other via "alternativeTo" (e.g. "step-6" and "step-6b").
8. Go beyond the degree: every route needs a "skills" block with "coreSkills" and price-banded "upskilling" (free options first).
9. Label cost with "costBand" of "free" | "low" | "mid" | "high" everywhere it appears. Colleges also carry "approxAnnualFees" text so users can sort by price.
10. Generate India-wide. Do NOT pre-filter by the student's state. Return colleges from across India, each with a "location" string formatted "City, State" so the UI can filter.
11. Adapt the lead route to the profile: Class 9/10 → lead with the stream to pick in Class 11 and why; passed-12 / gap-year → lead with the nearest entry exam or fallback route. Give 1–3 routes.

JSON SHAPE (use these exact keys; omit nothing required):
{
  "meta": { "career": string, "careerAliases": string[], "studentProfile": { "class": string, "board": string|null, "stream": string|null, "language": string, "currentDate": string }, "generatedAt": string, "confidence": "high"|"medium"|"low", "cacheKey": string },
  "overview": { "summary": string, "dayInLife": string, "payRange": { "entry": string, "experienced": string, "note": string }, "demandOutlook": string, "requirements": string[] },
  "routes": [ {
    "id": string, "name": string, "bestFor": string,
    "feasibility": "high"|"medium"|"low", "feasibilityReason": string,
    "costBand": "free"|"low"|"mid"|"high", "duration": string,
    "steps": [ { "id": string, "order": number, "type": "education"|"exam"|"application"|"experience"|"skill"|"other", "title": string, "offsetMonths": number, "description": string, "optional"?: boolean, "alternativeTo"?: string } ],
    "skills": { "coreSkills": string[], "upskilling": [ { "name": string, "why": string, "costBand": "free"|"low"|"mid"|"high", "url": string, "verified": false } ] },
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

/**
 * Build the per-request user prompt from the MINIMAL profile only (spec §5 data
 * minimization). Carries the language instruction and the current date that
 * anchors the relative offsets — but never asks the model to do date math.
 */
export function buildUserPrompt(profile: GenerationProfile): string {
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
    ``,
    `Set meta.studentProfile.currentDate to "${profile.currentDate}" and meta.studentProfile.language to "${profile.locale}". Return STRICT JSON only.`,
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}
