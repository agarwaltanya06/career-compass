/**
 * Shared contracts for the live generation pipeline (spec §3 + §7).
 *
 * The model call sits behind a small **provider abstraction**: Gemini (free
 * tier, native search grounding) and Anthropic (Haiku fallback) implement one
 * `ModelProvider` interface so they're interchangeable behind the route. The
 * route normalizes their very different request shapes (Gemini's `google_search`
 * tool vs Anthropic's `web_search` server tool) into the single `generate()`
 * call below — see providers/gemini.ts and providers/anthropic.ts.
 */

import type { Journey } from "@/lib/types";

/** Which backend ran the generation. */
export type ProviderId = "gemini" | "anthropic";

/**
 * Which backend to run. This is an INTERNAL knob, not a user-facing tier: the
 * seed script (scripts/seed.ts) uses it to force Gemini-only or Anthropic-only
 * runs while pre-seeding the cache. Live visitors never choose — they all get the
 * one path (cache → candidate → Gemini → Haiku fallback). `model` is optional;
 * each provider has a sane default.
 */
export interface ProviderChoice {
  provider: ProviderId;
  model?: string;
}

/**
 * The **minimum** profile sent to the model (data minimization, spec §5): never
 * names or contact details. The route whitelists exactly these fields before
 * building the prompt, so no extra client-sent data can leak to a free tier that
 * may train on prompts.
 */
export interface GenerationProfile {
  /** "9" | "10" | "11" | "12" | "passed12" | "college" | "gap". */
  class: string;
  /** Board code, e.g. "cbse". Omitted/`none` when not collected. */
  board?: string;
  /** Stream code, e.g. "commerce-maths". Only for class >= 11. */
  stream?: string;
  /** Career goal — a known slug ("ca") or free text. */
  career: string;
  /** Language to generate the whole journey in, e.g. "en" | "hi". */
  locale: string;
  /** ISO date anchoring the timeline; the model emits offsets relative to it. */
  currentDate: string;
}

/** What a provider is handed: a stable system prompt + the per-request user prompt. */
export interface GenerationRequest {
  systemPrompt: string;
  userPrompt: string;
}

/** What a provider returns: raw model text (expected to be strict JSON) + provenance. */
export interface GenerationResult {
  text: string;
  provider: ProviderId;
  model: string;
}

/**
 * The one internal interface every backend implements. Each provider enables web
 * search grounding and prompt caching internally and hands back plain text, so
 * the route never has to care which backend ran.
 */
export interface ModelProvider {
  readonly id: ProviderId;
  readonly model: string;
  generate(req: GenerationRequest): Promise<GenerationResult>;
}

/**
 * A free-tier provider hit its rate/quota limit. The route catches this to fall
 * back from Gemini's free tier to the paid Anthropic Haiku key (spec §5).
 */
export class FreeTierLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FreeTierLimitError";
  }
}

/** A provider can't run at all (missing key / unsupported config). */
export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

// ---- HTTP contract for POST /api/generate ----------------------------------

export interface GenerateRequestBody {
  profile: GenerationProfile;
  /**
   * Force a fresh live generation, bypassing the cached verified/candidate serve
   * (the user-facing "Regenerate" button). Open to everyone but rate-limited at
   * the route, since each one spends a real model call.
   */
  refresh?: boolean;
}

/**
 * Trust state of a served journey (spec §4). `verified` is the human-reviewed
 * default; `candidate` is a fresh, unreviewed machine generation shown only to
 * the requester with the "unverified — check official links" stamp.
 */
export type JourneyStatus = "verified" | "candidate";

export interface GenerateResponseBody {
  journey: Journey;
  status: JourneyStatus;
  cacheKey: string;
  /** Provenance for candidates; omitted for cache hits. */
  generatedBy?: { provider: ProviderId; model: string };
  /**
   * Review flags raised by the post-generation audit (spec §3 rules 12–13).
   * Structural violations (offset-order breaks, duplicate/artifact routes) trigger
   * a regeneration first and only appear here if those retries are exhausted; soft
   * flags (missing far-future / NExT hedge, ungrounded specifics) always appear.
   * Present only on fresh candidates that tripped a check; absent for verified
   * cache hits. These tell the reviewer what to double-check — they don't block
   * serving.
   */
  warnings?: string[];
}

export interface GenerateErrorBody {
  error: string;
  /**
   * Set when generation failed because BOTH the free Gemini tier and the Haiku
   * fallback were unavailable. Carries a friendly, pre-filled prompt the user can
   * paste into Google's AI Mode or any free AI tool to generate their own plan —
   * so a busy free tier never dead-ends. Absent for ordinary validation errors.
   */
  externalPrompt?: string;
  /**
   * Set when the input safety gate rejected the request: "blocked" (off-topic /
   * disallowed → neutral nudge) or "distress" (self-harm signals → helpline). The
   * UI shows the calm SafetyNotice instead of the generic failure screen.
   */
  safety?: "blocked" | "distress";
}

// ---- Streaming contract (SSE) ----------------------------------------------
// The route can stream progress so the UI shows real steps (which model is
// running, when generation starts, a fallback) instead of a blank wait. Each
// SSE `data:` line is one of these JSON events.

/** A live progress update. `model`/`provider` carry the REAL backend in use. */
export interface GenerateStatusEvent {
  type: "status";
  /** "checking" = cache lookup; "generating" = model call started; */
  /* "falling-back" = primary failed, paid fallback now running. */
  phase: "checking" | "generating" | "falling-back";
  provider?: ProviderId;
  model?: string;
}

/** Terminal events: either the finished journey, or a friendly error. */
export type GenerateStreamEvent =
  | GenerateStatusEvent
  | ({ type: "result" } & GenerateResponseBody)
  /** `externalPrompt` is present only when both providers were unavailable;
   *  `safety` is present only when the input safety gate rejected the request. */
  | {
      type: "error";
      message: string;
      externalPrompt?: string;
      safety?: "blocked" | "distress";
    };
