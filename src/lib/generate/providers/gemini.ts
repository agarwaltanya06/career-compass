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

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

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
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    });

    // Quota/rate exhaustion → let the route fall back to the paid Haiku key.
    if (res.status === 429) {
      throw new FreeTierLimitError("Gemini free-tier limit reached");
    }
    if (!res.ok) {
      // Google's error body carries no secret; safe to surface (route won't log keys).
      throw new ProviderUnavailableError(
        `Gemini request failed (${res.status})`,
      );
    }

    const data = (await res.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    return { text, provider: this.id, model: this.model };
  }
}
