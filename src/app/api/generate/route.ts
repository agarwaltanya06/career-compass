/**
 * POST /api/generate — the only server part (spec §7).
 *
 * Flow:
 *   1. Validate the request; minimize the profile (no names/contact — §5).
 *   2. CACHE-FIRST: derive the §4 cacheKey, serve a stored VERIFIED journey if
 *      one exists.
 *   3. On a miss, call the model behind the provider abstraction — Gemini's
 *      grounded free tier by default, falling back to Anthropic Haiku when the
 *      free tier is exhausted or unconfigured (§5). A per-request override lets
 *      a user pick a different provider/model or supply their own key.
 *   4. Validate the response against the Journey type; retry once on a parse
 *      failure, then a friendly error.
 *   5. Compute the timeline in code, not the model: the model emits relative
 *      offsetMonths only; the displayed period is derived at render
 *      (lib/timeline.ts). We never let an absolute date through.
 *   6. Store the fresh generation as an UNVERIFIED CANDIDATE for review (§4) —
 *      never auto-overwriting a verified default — and return it stamped.
 *
 * API keys are never logged.
 */

import { NextResponse } from "next/server";
import type { Journey } from "@/lib/types";
import { parseJourney } from "@/lib/journeySchema";
import { buildCacheKey, cacheFileName, slugifyCareer } from "@/lib/generate/cacheKey";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/generate/prompt";
import { readVerified, writeCandidate } from "@/lib/generate/store";
import {
  DEFAULT_CHOICE,
  FALLBACK_CHOICE,
  makeProvider,
} from "@/lib/generate/providers";
import {
  FreeTierLimitError,
  ProviderUnavailableError,
  type GenerateRequestBody,
  type GenerateResponseBody,
  type GenerateStatusEvent,
  type GenerationProfile,
  type ModelProvider,
  type ProviderChoice,
} from "@/lib/generate/types";

// fs access requires the Node runtime; this route is always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generation + web search can take well over a minute (observed ~90–125s with
// grounding), so request the platform's longer ceiling. Cache-first is the real
// latency lever — a verified hit returns in ~50ms (spec §7 phase 2/3).
export const maxDuration = 300;

/** The intake sentinel for "Not sure — help me explore" (see lib/intake.ts). */
const EXPLORE_GOAL = "__explore__";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** A friendly, user-facing failure with the HTTP status the JSON path should use. */
class GenerateError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GenerateError";
  }
}

/** Sink for live progress events; a no-op on the non-streaming JSON path. */
type Emit = (event: GenerateStatusEvent) => void;

/**
 * Pull the JSON object out of raw model text. Strict-JSON is requested, but a
 * model may still wrap it in ``` fences or add a stray sentence — slice from the
 * first "{" to the last "}".
 */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Run one provider and validate; null on a parse failure (so we can retry). */
async function attempt(
  provider: ModelProvider,
  systemPrompt: string,
  userPrompt: string,
): Promise<Journey | null> {
  const result = await provider.generate({ systemPrompt, userPrompt });
  return parseJourney(extractJson(result.text));
}

/** Read the minimal, name-free profile out of an arbitrary request body. */
function readProfile(raw: unknown): GenerationProfile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  const cls = typeof p.class === "string" ? p.class.trim() : "";
  const career = typeof p.career === "string" ? p.career.trim() : "";
  if (!cls || !career) return null;
  const locale = typeof p.locale === "string" && p.locale.trim() ? p.locale.trim() : "en";
  const currentDate =
    typeof p.currentDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(p.currentDate)
      ? p.currentDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  return {
    class: cls,
    board: typeof p.board === "string" && p.board.trim() ? p.board.trim() : undefined,
    stream: typeof p.stream === "string" && p.stream.trim() ? p.stream.trim() : undefined,
    career,
    locale,
    currentDate,
  };
}

function readChoice(raw: unknown): ProviderChoice | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const m = raw as Record<string, unknown>;
  if (m.provider === "gemini" || m.provider === "anthropic") {
    return {
      provider: m.provider,
      model: typeof m.model === "string" && m.model.trim() ? m.model.trim() : undefined,
    };
  }
  return undefined;
}

/**
 * The full generation pipeline (cache-first → model → validate → store), with an
 * `emit` sink for live progress. Returns the response body or throws a
 * GenerateError. Shared by both the streaming and the plain-JSON paths so the
 * logic lives in exactly one place.
 */
async function runGeneration(
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
  const userPrompt = buildUserPrompt(profile);

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
    journey = await attempt(primary, SYSTEM_PROMPT, userPrompt);
    if (!journey) journey = await attempt(primary, SYSTEM_PROMPT, userPrompt);
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
        journey = await attempt(fallback, SYSTEM_PROMPT, userPrompt);
        if (!journey) journey = await attempt(fallback, SYSTEM_PROMPT, userPrompt);
      } catch {
        throw new GenerateError("Couldn't generate a plan right now. Please try again.", 502);
      }
    } else {
      throw new GenerateError("Couldn't generate a plan right now. Please try again.", 502);
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
  };
}

export async function POST(request: Request) {
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return jsonError("Could not read the request. Please try again.", 400);
  }

  const profile = readProfile(body.profile);
  if (!profile) {
    return jsonError("Please choose a class and a career goal first.", 400);
  }
  if (profile.career === EXPLORE_GOAL || slugifyCareer(profile.career) === "explore") {
    return jsonError(
      "Exploration mode isn't available here yet — pick a specific career to get a full plan.",
      400,
    );
  }

  const override = readChoice(body.model);
  const userKey = typeof body.apiKey === "string" ? body.apiKey : undefined;

  // Stream progress when the client asks for it (intake flow); otherwise return
  // a single JSON body (back-compat for any plain caller).
  const wantsStream = (request.headers.get("accept") ?? "").includes("text/event-stream");

  if (!wantsStream) {
    try {
      const result = await runGeneration(profile, override, userKey, () => {});
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof GenerateError) return jsonError(err.message, err.status);
      return jsonError("Couldn't generate a plan right now. Please try again.", 502);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        const result = await runGeneration(profile, override, userKey, send);
        send({ type: "result", ...result });
      } catch (err) {
        const message =
          err instanceof GenerateError
            ? err.message
            : "Couldn't generate a plan right now. Please try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
