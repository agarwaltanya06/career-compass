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
import { auditJourney, type AuditResult } from "./audit";
import { buildCacheKey, cacheFileName } from "./cacheKey";
import { buildExternalPrompt } from "./externalPrompt";
import { SYSTEM_PROMPT, buildUserPrompt, type AllowedEntities } from "./prompt";
import { readVerified, readLatestCandidate, writeCandidate } from "./store";
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
  /**
   * A friendly, pre-filled prompt the user can paste into Google's AI Mode or any
   * free AI tool to generate their own plan. Set when a model run failed (so the
   * UI can offer a real way forward instead of a dead end). Mutable so the
   * pipeline can stamp it onto an error raised deeper in the call stack.
   */
  externalPrompt?: string;
  constructor(
    message: string,
    status: number,
    options?: { rateLimited?: boolean; cause?: unknown; externalPrompt?: string },
  ) {
    super(message);
    this.status = status;
    this.rateLimited = options?.rateLimited ?? false;
    this.externalPrompt = options?.externalPrompt;
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
 * How many times to REGENERATE when the audit flags a structural violation
 * (offset-order break or duplicate/artifact route) — those are mechanical model
 * slips a fresh draft almost always fixes. 2 retries = up to 3 audited drafts.
 */
const MAX_STRUCTURAL_RETRIES = 2;

/**
 * Produce ONE validated journey: try `primary` (validating, with a single
 * parse-failure retry — §3 phase 3); on a free-tier/unavailable error fall back
 * to `fallback` (same parse retry) when one is configured. Returns the journey
 * and which provider actually produced it, or throws a GenerateError. This is the
 * unit the structural-audit retry loop calls repeatedly.
 */
async function generateOnce(
  primary: ModelProvider,
  fallback: ModelProvider | null,
  systemPrompt: string,
  userPrompt: string,
  tableArg: AllowedEntities | null,
  emit: Emit,
): Promise<{ journey: Journey; used: ModelProvider }> {
  let journey: Journey | null = null;
  let used: ModelProvider = primary;
  try {
    journey = await attempt(primary, systemPrompt, userPrompt, tableArg);
    if (!journey) journey = await attempt(primary, systemPrompt, userPrompt, tableArg);
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
        journey = await attempt(fallback, systemPrompt, userPrompt, tableArg);
        if (!journey) journey = await attempt(fallback, systemPrompt, userPrompt, tableArg);
      } catch {
        throw new GenerateError(
          "Our free plan generator is busy right now. Please try again in a little while.",
          502,
        );
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
  return { journey, used };
}

/**
 * The full generation pipeline (cache-first → model → validate → store), with an
 * `emit` sink for live progress. Returns the response body or throws a
 * GenerateError.
 *
 * @param override When set (e.g. the seed script forcing Gemini), this exact
 *   provider is used with NO automatic Anthropic fallback — so a free-tier 429
 *   surfaces as a `GenerateError` with `rateLimited: true` instead of silently
 *   spending the paid key. This is internal seeding tooling, not a user-facing
 *   model picker: live visitors always pass `undefined` and get the one pipeline.
 * @param options.serveExistingCandidate When true (the live route), a verified
 *   miss first tries the newest queued CANDIDATE and serves it stamped
 *   "candidate" — so the reviewed seeded journeys back the 20-career catalogue at
 *   launch without a model call per visit. Left false by the SEED script, which
 *   must always regenerate to refresh the queue (otherwise re-seeding is a no-op).
 * @param options.forceFresh When true (the user-facing "Regenerate" button),
 *   skip BOTH the verified and candidate cache serves and always run the model —
 *   so a regenerate produces a genuinely new draft rather than echoing the cache.
 *   The route rate-limits this path.
 */
export async function runGeneration(
  profile: GenerationProfile,
  override: ProviderChoice | undefined,
  emit: Emit,
  options?: { serveExistingCandidate?: boolean; forceFresh?: boolean },
): Promise<GenerateResponseBody> {
  // ---- Cache-first (§4): serve a verified default if we have one — unless the
  // caller asked to force a fresh regeneration. ----
  const cacheKey = buildCacheKey(profile);
  const fileName = cacheFileName(cacheKey, profile.locale);
  emit({ type: "status", phase: "checking" });
  if (!options?.forceFresh) {
    const verified = await readVerified(fileName);
    if (verified) {
      return { journey: verified, status: "verified", cacheKey };
    }

    // ---- Else serve the newest reviewed CANDIDATE if one is queued (live route
    // only). It's stamped "candidate" so the UI shows the unverified banner, and
    // it spares a model call per visit at launch. The seed script opts out so it
    // always regenerates a fresh candidate. ----
    if (options?.serveExistingCandidate) {
      const candidate = await readLatestCandidate(fileName);
      if (candidate) {
        return { journey: candidate, status: "candidate", cacheKey };
      }
    }
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

  // A friendly, pre-filled prompt the user can paste into a free AI tool if the
  // whole pipeline can't produce a plan right now — so a busy free tier (or an
  // unconfigured backend) never dead-ends. Stamped onto any failure thrown below.
  const externalPrompt = buildExternalPrompt({
    career: profile.career,
    classCode: profile.class,
    board: profile.board,
    stream: profile.stream,
    locale: profile.locale,
  });

  // Build the primary provider (override if given, else the Gemini free-tier
  // default) and the Haiku fallback (skipped for an explicit override).
  let primary: ModelProvider;
  let fallback: ModelProvider | null = null;
  try {
    if (override) {
      primary = makeProvider(override);
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
        "Our free plan generator is unavailable right now. Please try again later.",
        503,
        { externalPrompt },
      );
    }
  }

  // Announce the real backend now in use, before the long grounded call.
  emit({ type: "status", phase: "generating", provider: primary.id, model: primary.model });

  // Generate, then AUDIT: if the draft has a structural violation (offset-order
  // break or a duplicate/artifact route), regenerate up to MAX_STRUCTURAL_RETRIES
  // times before accepting it — those are mechanical model slips a fresh draft
  // almost always fixes. Soft review flags never trigger a retry. If retries are
  // exhausted (or a retry call throws), keep the last good draft and let it
  // through to the candidate queue, still flagged — the audit never hard-blocks.
  let journey: Journey | null = null;
  let used: ModelProvider = primary;
  let audit: AuditResult = { structural: [], review: [] };
  for (let attemptNo = 0; ; attemptNo++) {
    let draft: { journey: Journey; used: ModelProvider };
    try {
      draft = await generateOnce(primary, fallback, SYSTEM_PROMPT, userPrompt, tableArg, emit);
    } catch (err) {
      // A regeneration failed: keep the earlier (structurally-flawed) draft if we
      // have one — a flagged candidate beats failing the request. The first
      // attempt has nothing to fall back on, so its error propagates — stamped
      // with the copyable prompt so the UI can offer a free way forward.
      if (journey) break;
      if (err instanceof GenerateError && !err.externalPrompt) {
        err.externalPrompt = externalPrompt;
      }
      throw err;
    }

    journey = draft.journey;
    used = draft.used;
    audit = auditJourney(journey);

    if (audit.structural.length === 0 || attemptNo >= MAX_STRUCTURAL_RETRIES) break;

    console.warn(
      `[generate] candidate "${cacheKey}" has structural violation(s); regenerating ` +
        `(retry ${attemptNo + 1}/${MAX_STRUCTURAL_RETRIES}):\n- ${audit.structural.join("\n- ")}`,
    );
    emit({ type: "status", phase: "generating", provider: primary.id, model: primary.model });
  }

  // The loop always assigns `journey` before any break (a first-attempt failure
  // throws instead), so this is just a type guard for the null-init above.
  if (!journey) {
    throw new GenerateError(
      "The plan came back in an unexpected format. Please try again.",
      502,
      { externalPrompt },
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

  // ---- Surface remaining audit flags for review (§3 rules 12–13). Structural
  // violations only land here if retries were exhausted; review flags are
  // heuristic. Neither edits or blocks the journey — they tell the human reviewer
  // what to double-check. ----
  const warnings = [...audit.structural, ...audit.review];
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
