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
import { slugifyCareer } from "@/lib/generate/cacheKey";
import { runGeneration, GenerateError } from "@/lib/generate/run";
import type {
  GenerateRequestBody,
  GenerationProfile,
  ProviderChoice,
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
