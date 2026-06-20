/**
 * Google Gemini provider — the DEFAULT free tier (spec §5).
 *
 * Chosen because it's the one free option with native search grounding (the
 * `google_search` tool), so it won't invent deadlines the way a search-less
 * open-weights tier would. Rate-limited, so the route falls back to Anthropic
 * Haiku on a 429 (FreeTierLimitError below).
 *
 * Implemented over the REST API with `fetch` so the project takes on no extra
 * SDK dependency. The key goes in the `x-goog-api-key` header (never in the URL,
 * so it can't leak into request logs) and is never logged anywhere.
 */

import type {
  GenerationRequest,
  GenerationResult,
  ModelProvider,
  ProviderId,
} from "../types";
import { FreeTierLimitError, ProviderUnavailableError } from "../types";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Free-tier flash model with Google Search grounding. Uses 2.5-flash: the older
 * 2.0-flash free allocation has been wound down and now answers every call with
 * 429 RESOURCE_EXHAUSTED, which silently forced a fall back to the paid Anthropic
 * key on every request (so the free tier was, in practice, never used).
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Output budget. 2.5-flash counts THINKING tokens against this, so the old 8192
 * left only ~6–7k for the JSON — a full journey (esp. content-heavy careers like
 * MBBS, with long grounded URL lists) overran it and came back truncated
 * (finishReason MAX_TOKENS) → invalid JSON. 2.5-flash allows up to 65536; this
 * leaves ample headroom.
 */
const MAX_OUTPUT_TOKENS = 32768;

/**
 * How many times to re-ask Gemini when it returns NO usable content — i.e.
 * finishReason RECITATION (its grounding guard fires on fact-dense text it echoed
 * too closely), SAFETY, MAX_TOKENS, or simply empty parts. These are stochastic,
 * so a retry usually clears them; only when all attempts fail do we throw and let
 * the route/seed fall back to paid Haiku for that profile (spec §5).
 */
const MAX_ATTEMPTS = 3;

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
}

/** finishReason values that mean "no usable answer" — worth a retry/fallback. */
const UNUSABLE_FINISH = new Set(["RECITATION", "SAFETY", "MAX_TOKENS", "OTHER"]);

export class GeminiProvider implements ModelProvider {
  readonly id: ProviderId = "gemini";
  readonly model: string;
  private readonly apiKey: string;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const url = `${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`;
    let lastReason = "empty";

    // Retry RECITATION/empty in-place; a 429 or transport error breaks out
    // immediately so the route can fall back rather than burn retries.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          // Stable system prompt → eligible for Gemini's implicit prefix caching.
          systemInstruction: { parts: [{ text: req.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: req.userPrompt }] }],
          // Native web-search grounding.
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.4, maxOutputTokens: MAX_OUTPUT_TOKENS },
        }),
      });

      // Quota/rate exhaustion → let the route fall back to the paid Haiku key.
      if (res.status === 429) {
        throw new FreeTierLimitError("Gemini free-tier limit reached");
      }
      if (!res.ok) {
        // Google's error body carries no secret; safe to surface (route won't log keys).
        throw new ProviderUnavailableError(`Gemini request failed (${res.status})`);
      }

      const data = (await res.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      const reason = candidate?.finishReason;

      // A clean answer: non-empty text and not flagged as recited/truncated/etc.
      if (text.trim() && !(reason && UNUSABLE_FINISH.has(reason))) {
        return { text, provider: this.id, model: this.model };
      }

      // No usable content — remember why and retry (paraphrasing usually clears
      // RECITATION on a re-ask; see the system prompt's "synthesize" rule).
      lastReason = reason ?? (text.trim() ? "flagged" : "empty");
    }

    // Exhausted: surface as a provider failure so the caller falls back to Haiku.
    throw new ProviderUnavailableError(
      `Gemini returned no usable content after ${MAX_ATTEMPTS} attempts (${lastReason})`,
    );
  }
}
