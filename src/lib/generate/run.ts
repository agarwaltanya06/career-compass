/**
 * The generation pipeline (spec §3 + §4), extracted from the POST /api/generate
 * route so it lives in EXACTLY ONE place and can be reused without duplication.
 *
 * Both callers import `runGeneration` from here:
 *   - the route (src/app/api/generate/route.ts) — live, per-request generation;
 *   - the seed script (scripts/seed.ts) — offline pre-seeding of the cache.
 *
 * Because they share this function, seeded content is byte-for-byte what a live
 * cache miss would produce and store (same prompt, same validation, same meta
 * normalization, same candidate file format).
 */

import type { Journey } from "@/lib/types";
import { parseJourney } from "@/lib/journeySchema";
import {
  collegesForCareer,
  examsForCareer,
  getCollege,
  getExam,
  toCollegeShape,
  toExamShape,
} from "@/lib/referenceTables";
import { auditJourney } from "./audit";
import { buildCacheKey, cacheFileName } from "./cacheKey";
import { SYSTEM_PROMPT, buildUserPrompt, type AllowedEntities } from "./prompt";
import { readVerified, writeCandidate } from "./store";
import { DEFAULT_CHOICE, FALLBACK_CHOICE, makeProvider } from "./providers";
import {
  FreeTierLimitError,
  ProviderUnavailableError,
  type GenerateResponseBody,
  type GenerateStatusEvent,
  type GenerationProfile,
  type ModelProvider,
  type ProviderChoice,
} from "./types";

/** A friendly, user-facing failure with the HTTP status the JSON path should use. */
export class GenerateError extends Error {
  readonly status: number;
  /**
   * True when the underlying failure was a provider rate/quota limit (HTTP 429).
   * The route doesn't care, but the seed script uses it to back off and retry
   * (the original error is preserved as `cause`).
   */
  readonly rateLimited: boolean;
  constructor(
    message: string,
    status: number,
    options?: { rateLimited?: boolean; cause?: unknown },
  ) {
    super(message);
    this.status = status;
    this.rateLimited = options?.rateLimited ?? false;
    if (options?.cause !== undefined) this.cause = options.cause;
    this.name = "GenerateError";
  }
}

/** Sink for live progress events; a no-op on the non-streaming JSON path. */
export type Emit = (event: GenerateStatusEvent) => void;

/**
 * Escape raw control characters (newline/tab/etc., U+0000–U+001F) that appear
 * INSIDE JSON string literals. Models occasionally emit a literal newline in a
 * description, which is illegal JSON ("Bad control character in string literal")
 * even though structural whitespace between tokens is fine — so we only touch
 * characters while inside a string, tracking backslash escapes to stay correct.
 */
function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    const code = s.charCodeAt(i);
    if (inString && code < 0x20) {
      out +=
        ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t"
          : "\\u" + code.toString(16).padStart(4, "0");
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Pull the JSON object out of raw model text. Strict-JSON is requested, but a
 * model may still wrap it in ``` fences or add a stray sentence — slice from the
 * first "{" to the last "}". If that doesn't parse, retry once after escaping any
 * stray in-string control characters (a common, otherwise-valid model slip).
 */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings(slice));
    } catch {
      return null;
    }
  }
}

/** Pull table ids from a model field that may be string[] or {id}[] (tolerant). */
function extractIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "string") ids.push(item);
    else if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
      ids.push((item as { id: string }).id);
    }
  }
  return [...new Set(ids)]; // de-dup, keep first-seen order
}

/**
 * Replace each route's colleges/exams with the canonical reference-table entities
 * the model selected by id (spec §4.1). When a career HAS a table, this enforces
 * table-only: ONLY hydrated entities survive, so a model can't smuggle in an
 * invented college, fee, or window — anything without a known id is dropped. The
 * model's chosen order is preserved; unknown ids are skipped. Mutates `raw` in
 * place before validation. No-op for careers without a table (handled by caller).
 */
function hydrateReferenceEntities(raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const routes = (raw as { routes?: unknown }).routes;
  if (!Array.isArray(routes)) return;
  for (const route of routes) {
    if (!route || typeof route !== "object") continue;
    const r = route as Record<string, unknown>;
    r.colleges = extractIds(r.collegeIds ?? r.colleges)
      .map(getCollege)
      .filter((c) => c !== undefined)
      .map(toCollegeShape);
    r.exams = extractIds(r.examIds ?? r.exams)
      .map(getExam)
      .filter((e) => e !== undefined)
      .map(toExamShape);
    delete r.collegeIds;
    delete r.examIds;
  }
}

/**
 * Ensure every career-relevant exam that carries a `supersededBy` is present in
 * the journey, so its transition caution (e.g. NEET PG → NExT) ALWAYS surfaces —
 * even if the model didn't select it (spec §4.1). Adds any missing one (by id) to
 * the first route's exams. Runs on `raw` before validation so the added exam goes
 * through the same coercion as the rest. No-op when the career has no such exam.
 */
function ensureTransitionExams(raw: unknown, allowed: AllowedEntities): void {
  const refs = allowed.exams.filter((e) => e.supersededBy && getExam(e.supersededBy));
  if (refs.length === 0 || !raw || typeof raw !== "object") return;
  const routes = (raw as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || routes.length === 0) return;

  const present = new Set<string>();
  for (const route of routes) {
    const exams = (route as { exams?: unknown }).exams;
    if (!Array.isArray(exams)) continue;
    for (const e of exams) {
      if (e && typeof e === "object" && typeof (e as { id?: unknown }).id === "string") {
        present.add((e as { id: string }).id);
      }
    }
  }

  const first = routes[0] as Record<string, unknown>;
  if (!Array.isArray(first.exams)) first.exams = [];
  for (const ref of refs) {
    if (!present.has(ref.id)) {
      (first.exams as unknown[]).push(toExamShape(ref));
      present.add(ref.id);
    }
  }
}

/**
 * Run one provider and validate; null on a parse failure (so we can retry). When
 * `allowed` is set (a career with a reference table), the model's id selections
 * are hydrated from the table and any superseded exam is force-added so its
 * transition caution always surfaces (spec §4.1).
 */
async function attempt(
  provider: ModelProvider,
  systemPrompt: string,
  userPrompt: string,
  allowed: AllowedEntities | null,
): Promise<Journey | null> {
  const result = await provider.generate({ systemPrompt, userPrompt });
  const raw = extractJson(result.text);
  if (allowed) {
    hydrateReferenceEntities(raw);
    ensureTransitionExams(raw, allowed);
  }
  return parseJourney(raw);
}

/**
 * The full generation pipeline (cache-first → model → validate → store), with an
 * `emit` sink for live progress. Returns the response body or throws a
 * GenerateError.
 *
 * @param override When set (e.g. the seed script forcing Gemini), this exact
 *   provider is used with NO automatic Anthropic fallback — so a free-tier 429
 *   surfaces as a `GenerateError` with `rateLimited: true` instead of silently
 *   spending the paid key.
 */
export async function runGeneration(
  profile: GenerationProfile,
  override: ProviderChoice | undefined,
  userKey: string | undefined,
  emit: Emit,
): Promise<GenerateResponseBody> {
  // ---- Cache-first (§4): serve a verified default if we have one. ----
  const cacheKey = buildCacheKey(profile);
  const fileName = cacheFileName(cacheKey, profile.locale);
  emit({ type: "status", phase: "checking" });
  const verified = await readVerified(fileName);
  if (verified) {
    return { journey: verified, status: "verified", cacheKey };
  }

  // ---- Miss → generate behind the provider abstraction. ----
  // Reference table (spec §4.1): the canonical colleges/exams this career may use.
  // When present, the model selects/orders from them by id and we hydrate the
  // verified facts in code; when absent, the model grounds them itself (legacy).
  const allowed: AllowedEntities = {
    colleges: collegesForCareer(profile.career),
    exams: examsForCareer(profile.career),
  };
  const useTable = allowed.colleges.length > 0 || allowed.exams.length > 0;
  const tableArg = useTable ? allowed : null;
  const userPrompt = buildUserPrompt(profile, useTable ? allowed : undefined);

  // Build the primary provider (override if given, else the Gemini free-tier
  // default) and a fallback (the user's chosen one can't fall back to your key).
  let primary: ModelProvider;
  let fallback: ModelProvider | null = null;
  try {
    if (override) {
      primary = makeProvider(override, userKey);
    } else {
      primary = makeProvider(DEFAULT_CHOICE);
      try {
        fallback = makeProvider(FALLBACK_CHOICE);
      } catch {
        fallback = null; // No fallback key configured — primary must carry it.
      }
    }
  } catch {
    // Default provider has no key: try the fallback as the primary instead.
    try {
      primary = makeProvider(FALLBACK_CHOICE);
    } catch {
      throw new GenerateError(
        "Live generation isn't configured yet. Please try a cached journey.",
        503,
      );
    }
  }

  // Announce the real backend now in use, before the long grounded call.
  emit({ type: "status", phase: "generating", provider: primary.id, model: primary.model });

  let journey: Journey | null = null;
  let used: ModelProvider = primary;
  try {
    // Validate; retry once on a parse failure (§3 phase 3).
    journey = await attempt(primary, SYSTEM_PROMPT, userPrompt, tableArg);
    if (!journey) journey = await attempt(primary, SYSTEM_PROMPT, userPrompt, tableArg);
  } catch (err) {
    // Free-tier exhausted / unavailable → fall back to your Haiku key (§5).
    if (
      fallback &&
      (err instanceof FreeTierLimitError || err instanceof ProviderUnavailableError)
    ) {
      used = fallback;
      emit({
        type: "status",
        phase: "falling-back",
        provider: fallback.id,
        model: fallback.model,
      });
      try {
        journey = await attempt(fallback, SYSTEM_PROMPT, userPrompt, tableArg);
        if (!journey) journey = await attempt(fallback, SYSTEM_PROMPT, userPrompt, tableArg);
      } catch {
        throw new GenerateError("Couldn't generate a plan right now. Please try again.", 502);
      }
    } else {
      // No fallback (e.g. an explicit provider override): surface the cause so a
      // caller can react — the seed script backs off on `rateLimited`.
      throw new GenerateError("Couldn't generate a plan right now. Please try again.", 502, {
        rateLimited: err instanceof FreeTierLimitError,
        cause: err,
      });
    }
  }

  if (!journey) {
    throw new GenerateError(
      "The plan came back in an unexpected format. Please try again.",
      502,
    );
  }

  // ---- Normalize meta deterministically (don't trust the model for these). ----
  journey.meta.cacheKey = cacheKey;
  journey.meta.generatedAt = profile.currentDate;
  journey.meta.studentProfile = {
    class: profile.class,
    board: profile.board,
    stream: profile.stream,
    language: profile.locale,
    currentDate: profile.currentDate,
  };

  // ---- Audit for review (§3 rules 12–13): flag offset-order violations and
  // missing far-future / NExT hedges. This never edits or blocks the journey —
  // it just surfaces what the human reviewer should double-check. ----
  const warnings = auditJourney(journey);
  if (warnings.length > 0) {
    // The seed run's stdout and the serverless logs are the review surface; no
    // secrets are involved (cacheKey + plain text only).
    console.warn(
      `[generate] candidate "${cacheKey}" flagged for review:\n- ${warnings.join("\n- ")}`,
    );
  }

  // ---- Store as an unverified candidate for review (§4); never overwrite a
  // verified default. A write failure shouldn't block the user's result. ----
  try {
    await writeCandidate(fileName, journey);
  } catch {
    // Best-effort: read-only filesystems (e.g. some serverless hosts) still serve
    // the journey; the candidate just isn't queued. No keys are involved.
  }

  return {
    journey,
    status: "candidate",
    cacheKey,
    generatedBy: { provider: used.id, model: used.model },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
