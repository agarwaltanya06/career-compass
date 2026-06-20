/**
 * Browser-side glue for the generation endpoint.
 *
 * The intake flow builds a minimal profile from the collected answers, POSTs it
 * to /api/generate, and stashes the result in sessionStorage so the journey page
 * can render it. We deliberately send only the fields the model needs — never
 * any free-text the user might have typed beyond the career goal.
 */

import { EXPLORE_GOAL, type IntakeAnswers } from "@/lib/intake";
import type {
  GenerateResponseBody,
  GenerateStatusEvent,
  GenerationProfile,
} from "@/lib/generate/types";

/** sessionStorage key holding the most recent generated/served journey. */
export const JOURNEY_STORAGE_KEY = "career-compass:journey";

/** Whether the chosen goal is the "help me explore" branch (no single journey). */
export function isExplore(answers: IntakeAnswers): boolean {
  return answers.goal === EXPLORE_GOAL && !answers.goalCustom?.trim();
}

/**
 * Build the minimal generation profile from intake answers. `locale` is the
 * language the user picked for the plan, falling back to the UI locale. Returns
 * null if there's nothing usable to generate from.
 */
export function profileFromAnswers(
  answers: IntakeAnswers,
  uiLocale: string,
  currentDate: string,
): GenerationProfile | null {
  const career = answers.goalCustom?.trim() || answers.goal?.trim();
  if (!answers.class || !career || career === EXPLORE_GOAL) return null;
  return {
    class: answers.class,
    board: answers.board || undefined,
    stream: answers.stream || undefined,
    career,
    locale: answers.language || uiLocale,
    currentDate,
  };
}

/** Call the endpoint. Throws an Error with a user-friendly message on failure. */
export async function requestJourney(
  profile: GenerationProfile,
): Promise<GenerateResponseBody> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  const data = (await res.json().catch(() => null)) as
    | (GenerateResponseBody & { error?: string })
    | { error: string }
    | null;
  if (!res.ok || !data || "error" in data) {
    const message =
      data && "error" in data && data.error
        ? data.error
        : "Couldn't generate a plan right now. Please try again.";
    throw new Error(message);
  }
  return data as GenerateResponseBody;
}

/**
 * Streaming variant of {@link requestJourney}. POSTs with an SSE `Accept` so the
 * route streams progress: `onProgress` fires for each live status event (cache
 * check, model selected, fallback) — letting the UI show the real model name and
 * honest phases during the long wait — and the promise resolves with the final
 * journey (or throws an Error with a user-friendly message).
 *
 * Falls back gracefully: a non-streaming JSON error response (e.g. a 400 for bad
 * input) is read as `{ error }` and thrown like the plain client does.
 */
export async function requestJourneyStream(
  profile: GenerationProfile,
  onProgress: (event: GenerateStatusEvent) => void,
): Promise<GenerateResponseBody> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ profile }),
  });

  // Validation / config errors come back as a normal JSON response, not a stream.
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      data?.error || "Couldn't generate a plan right now. Please try again.",
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: GenerateResponseBody | null = null;
  let errorMessage: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line; process every complete one.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame
        .split("\n")
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      let event: { type?: string; [k: string]: unknown };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.type === "status") {
        onProgress(event as unknown as GenerateStatusEvent);
      } else if (event.type === "result") {
        const { type: _omit, ...body } = event;
        void _omit;
        result = body as unknown as GenerateResponseBody;
      } else if (event.type === "error") {
        errorMessage = typeof event.message === "string" ? event.message : null;
      }
    }
    if (done) break;
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!result) {
    throw new Error("Couldn't generate a plan right now. Please try again.");
  }
  return result;
}

/** Persist a served journey for the journey page to pick up after navigation. */
export function storeJourney(payload: GenerateResponseBody): void {
  try {
    sessionStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota: the journey page falls back to the sample.
  }
}

/** Read a previously stored journey, or null if none/parse fails. */
export function loadStoredJourney(): GenerateResponseBody | null {
  try {
    const raw = sessionStorage.getItem(JOURNEY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GenerateResponseBody) : null;
  } catch {
    return null;
  }
}
