/**
 * Friendly display names for the backends we run, so the UI can honestly show
 * "Powered by Gemini 2.0 Flash" / "Claude Haiku 4.5" instead of a raw model id.
 *
 * Kept deliberately small and explicit: it maps only the providers/models this
 * project actually configures (see providers/index.ts). Unknown ids fall back to
 * the raw string rather than guessing a marketing name.
 */

import type { ProviderId } from "./types";

export function modelDisplayName(
  provider: ProviderId | undefined,
  model?: string,
): string {
  const m = (model ?? "").toLowerCase();
  if (provider === "anthropic") {
    if (m.includes("haiku")) return "Claude Haiku 4.5";
    if (m.includes("sonnet")) return "Claude Sonnet";
    if (m.includes("opus")) return "Claude Opus";
    return "Claude";
  }
  if (provider === "gemini") {
    if (m.includes("2.5-flash")) return "Gemini 2.5 Flash";
    if (m.includes("2.0-flash")) return "Gemini 2.0 Flash";
    if (m.includes("flash")) return "Gemini Flash";
    if (m.includes("pro")) return "Gemini Pro";
    return "Gemini";
  }
  return model || "AI model";
}
