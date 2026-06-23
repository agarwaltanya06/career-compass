/**
 * Provider resolution: turn a (provider, model) choice into a concrete
 * ModelProvider, keeping Gemini and Anthropic interchangeable behind the route.
 * Keys are read from the environment only — there is no bring-your-own-key path;
 * everyone uses the one configured free-tier-first pipeline. Keys are NEVER logged.
 */

import type { ModelProvider, ProviderChoice } from "../types";
import { ProviderUnavailableError } from "../types";
import { AnthropicProvider, FALLBACK_ANTHROPIC_MODEL } from "./anthropic";
import { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./gemini";

export { DEFAULT_GEMINI_MODEL, FALLBACK_ANTHROPIC_MODEL };

/** The default backend for everyone: Gemini's grounded free tier. */
export const DEFAULT_CHOICE: ProviderChoice = {
  provider: "gemini",
  model: DEFAULT_GEMINI_MODEL,
};

/** The paid fallback when the free tier is exhausted: your Haiku key. */
export const FALLBACK_CHOICE: ProviderChoice = {
  provider: "anthropic",
  model: FALLBACK_ANTHROPIC_MODEL,
};

/**
 * Build a provider for `choice` from the environment keys. Throws
 * ProviderUnavailableError when no key exists, so the route can fall back to the
 * other provider or surface the friendly busy-message + copyable prompt.
 */
export function makeProvider(choice: ProviderChoice): ModelProvider {
  if (choice.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new ProviderUnavailableError("Anthropic API key not configured");
    return new AnthropicProvider(choice.model || FALLBACK_ANTHROPIC_MODEL, key);
  }
  // Default: Gemini.
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new ProviderUnavailableError("Gemini API key not configured");
  return new GeminiProvider(choice.model || DEFAULT_GEMINI_MODEL, key);
}
