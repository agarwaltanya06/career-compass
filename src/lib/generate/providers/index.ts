/**
 * Provider resolution: turn a (provider, model) choice + an optional key into a
 * concrete ModelProvider, keeping Gemini and Anthropic interchangeable behind
 * the route (spec §5). Keys are read from env unless the caller supplies one
 * (bring-your-own-key); they are NEVER logged.
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
 * Build a provider for `choice`. `userKey` (a bring-your-own-key) takes
 * precedence over env keys. Throws ProviderUnavailableError when no key exists,
 * so the route can fall back or surface a friendly error.
 */
export function makeProvider(
  choice: ProviderChoice,
  userKey?: string,
): ModelProvider {
  if (choice.provider === "anthropic") {
    const key = userKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new ProviderUnavailableError("Anthropic API key not configured");
    return new AnthropicProvider(choice.model || FALLBACK_ANTHROPIC_MODEL, key);
  }
  // Default: Gemini.
  const key = userKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new ProviderUnavailableError("Gemini API key not configured");
  return new GeminiProvider(choice.model || DEFAULT_GEMINI_MODEL, key);
}
