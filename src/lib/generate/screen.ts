/**
 * Server-side LLM input gate (the second safety layer; the first is the instant
 * client heuristic in lib/inputSafety.ts).
 *
 * Before we spend a long, grounded web-search generation on a free-text career,
 * a CHEAP, search-less classification call decides whether the input is actually
 * a career/job worth planning. This catches what a word list can't: off-topic
 * but clean input ("bad person", a random name, a question), and harmful phrasing
 * the blocklist misses. If it isn't a real career, we never proceed to search.
 *
 * Cost shape mirrors the main pipeline: Gemini's free flash model first, the paid
 * Haiku key only as a fallback. It runs ONLY on a cache miss for a typed career
 * (known catalogue careers are served from cache), and never during offline
 * seeding. Keys are read from the environment and never logged.
 *
 * Fail-OPEN: if neither provider can classify (no key, quota, transport error),
 * we return "ok" so a transient outage never blocks a genuine student — the
 * client heuristic already stopped the obvious bad input, and the grounded
 * generation is itself constrained.
 */

import Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_ANTHROPIC_MODEL } from "./providers/anthropic";
import { DEFAULT_GEMINI_MODEL } from "./providers/gemini";

export type ScreenVerdict = "ok" | "unrelated" | "unsafe" | "distress";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

const SCREEN_SYSTEM = `You are a strict input gate for a career-guidance website for school and college students in India. You are given ONE short free-text phrase that a student typed as the career or job they want a plan for. Classify it into EXACTLY ONE category and reply with ONLY that single lowercase word — no punctuation, no explanation.

Categories:
- ok: a real, lawful job, profession, trade, vocation, or field of study, OR a clear career aspiration. Be generous: accept any genuine occupation in English, Hindi, or Hinglish (e.g. "fashion designer", "cabin crew at indigo", "chartered accountant", "ips officer", "youtuber", "merchant navy", "data scientist", "makeup artist", "farmer").
- unrelated: NOT a career or job — gibberish, a single random word, a person's name, a place, a food, a feeling, a general question, or anything off-topic for career planning (e.g. "bad person", "asdfgh", "my neighbour", "biryani", "what is love", "i am bored").
- unsafe: sexual, pornographic, violent, hateful, harassing, or illegal content, or a "career" that is abusive or designed to harm others.
- distress: any sign of self-harm, suicidal thoughts, or a person in crisis.

Reply with one word: ok, unrelated, unsafe, or distress.`;

/** Pull the first valid verdict word out of model text; null if none. */
function parseVerdict(text: string): ScreenVerdict | null {
  const m = text.toLowerCase().match(/\b(ok|unrelated|unsafe|distress)\b/);
  return (m?.[1] as ScreenVerdict | undefined) ?? null;
}

/** The user turn: the phrase, defended against prompt-injection by quoting. */
function userTurn(career: string): string {
  // Cap length and strip newlines so a long paste can't blow up the cheap call
  // or smuggle in extra "instructions".
  const cleaned = career.replace(/\s+/g, " ").trim().slice(0, 120);
  return `Phrase: "${cleaned}"`;
}

/** Gemini free-tier classification: no tools, no thinking, tiny output. */
async function geminiScreen(career: string, apiKey: string): Promise<ScreenVerdict | null> {
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(DEFAULT_GEMINI_MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SCREEN_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userTurn(career) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8,
        // No "thinking" — we want the one word immediately, not a budget spent
        // on reasoning tokens that would starve the tiny output cap.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) return null; // 429/5xx → caller tries the Haiku fallback
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
  return parseVerdict(text);
}

/** Anthropic Haiku classification: no tools, tiny max_tokens. */
async function anthropicScreen(career: string, apiKey: string): Promise<ScreenVerdict | null> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: FALLBACK_ANTHROPIC_MODEL,
    max_tokens: 8,
    temperature: 0,
    system: SCREEN_SYSTEM,
    messages: [{ role: "user", content: userTurn(career) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseVerdict(text);
}

/**
 * Classify a typed career. Tries Gemini (free) then Anthropic (paid); fails OPEN
 * to "ok" when neither can answer, so infra trouble never blocks a real student.
 */
export async function screenCareer(career: string): Promise<ScreenVerdict> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const verdict = await geminiScreen(career, geminiKey);
      if (verdict) return verdict;
    } catch {
      // fall through to the paid fallback
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const verdict = await anthropicScreen(career, anthropicKey);
      if (verdict) return verdict;
    } catch {
      // fall through to fail-open
    }
  }

  return "ok";
}
