/**
 * scripts/translate-hi.ts — one-time build-time helper to fill messages/hi.json.
 *
 *   npx tsx scripts/translate-hi.ts
 *
 * Walks messages/en.json, translates every non-empty string leaf into plain,
 * everyday Hindi (the kind a school student reads easily — NOT formal/literary
 * Hindi) via the Gemini API, and writes a messages/hi.json that mirrors the
 * English structure exactly.
 *
 * Rules:
 *   • Proper nouns stay in English/as-is: NEET, JEE, college/institute names,
 *     "AI", "PDF", "Word", ".txt", URLs, board names, etc.
 *   • Placeholders like {current}, {total}, {date}, {year}, {exam}, {name} are
 *     preserved verbatim.
 *   • The two SAFETY-banner keys (journey.candidateBannerTitle and
 *     journey.candidateBanner) are NOT touched — their existing hand-checked
 *     Hindi is carried over from the current messages/hi.json (and is pinned by
 *     scripts/check-i18n-banner.ts).
 *   • Empty strings ("") in en.json stay empty (the t() helper falls back to EN).
 *
 * This is a build-time script, not a production call path.
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const MODEL = "gemini-2.5-flash";
const CHUNK_SIZE = 30;

/** journey.* keys to leave exactly as they already are in messages/hi.json. */
const BANNER_KEYS = new Set(["candidateBannerTitle", "candidateBanner"]);

// --- env -------------------------------------------------------------------

function loadApiKey(): string {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv) return fromEnv;
  const envFile = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const match = envFile.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!match) throw new Error("GEMINI_API_KEY not found in env or .env.local");
  return match[1].trim();
}

// --- JSON tree walking -----------------------------------------------------

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/**
 * Collect every translatable string leaf with a callback that writes the
 * translation back into a clone. We translate strings inside objects and
 * arrays-of-strings; numbers/booleans/empty strings are left untouched. The
 * safety-banner keys are skipped here (handled separately in main).
 */
interface Leaf {
  value: string;
  set: (translated: string) => void;
}

function collectLeaves(node: Json): Leaf[] {
  const leaves: Leaf[] = [];

  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      if (typeof item === "string") {
        if (item.trim().length === 0) return;
        leaves.push({ value: item, set: (t) => (node[i] = t) });
      } else {
        leaves.push(...collectLeaves(item));
      }
    });
    return leaves;
  }

  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (typeof child === "string") {
        if (BANNER_KEYS.has(key)) continue; // safety banner — handled separately
        if (child.trim().length === 0) continue; // keep empty → falls back to EN
        leaves.push({ value: child, set: (t) => ((node as Record<string, Json>)[key] = t) });
      } else {
        leaves.push(...collectLeaves(child));
      }
    }
  }

  return leaves;
}

// --- Gemini ----------------------------------------------------------------

const SYSTEM_INSTRUCTION = `You translate UI strings for an Indian career-guidance website aimed at school students into Hindi.

Rules:
- Use plain, everyday spoken Hindi that a school student reads easily. Do NOT use formal, literary, or heavily Sanskritized Hindi. Prefer common words people actually say (e.g. "कॉलेज" not "महाविद्यालय", "नौकरी" not "रोज़गार" where natural). Common English words written in Devanagari are fine if that is how students normally say them.
- Keep proper nouns and technical tokens UNCHANGED in English: exam names (NEET, JEE, UPSC, SSC, NDA, NIOS, CBSE, ICSE, ISC), institute/college/board names, brand/product names, "AI", "PDF", "Word", ".doc", ".txt", file extensions, URLs, and similar.
- Preserve EVERY placeholder token exactly, including the curly braces, e.g. {current}, {total}, {date}, {year}, {exam}, {name}. Do not translate or reorder the token text inside braces.
- Preserve emoji, punctuation style, and any markdown/quotes as-is.
- Keep it concise — UI labels should stay short.
- Return ONLY the translations, one per input item, in the same order.`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry transient failures (503 overload, parse hiccups) with backoff. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const MAX = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX) throw err;
      const wait = 2000 * 2 ** (attempt - 1);
      console.log(`  ${label} failed (attempt ${attempt}/${MAX}): ${(err as Error).message}. Retrying in ${wait}ms…`);
      await sleep(wait);
    }
  }
}

async function translateChunk(strings: string[], apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const prompt =
    `Translate each item in this JSON array into plain everyday Hindi following the rules. ` +
    `Return a JSON array of strings of EXACTLY the same length (${strings.length}), ` +
    `where element i is the Hindi translation of input element i.\n\n` +
    JSON.stringify(strings, null, 0);

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: { type: "STRING" } },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok || data.error) {
    throw new Error(`Gemini error (${res.status}): ${data.error?.message ?? "unknown"}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");

  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== strings.length) {
    throw new Error(
      `Gemini returned ${Array.isArray(parsed) ? parsed.length : "non-array"} items, expected ${strings.length}`,
    );
  }
  return parsed.map(String);
}

// --- main ------------------------------------------------------------------

async function main(): Promise<void> {
  const apiKey = loadApiKey();
  const messagesDir = path.join(process.cwd(), "messages");

  const en = JSON.parse(readFileSync(path.join(messagesDir, "en.json"), "utf8")) as Record<string, Json>;
  const existingHi = JSON.parse(
    readFileSync(path.join(messagesDir, "hi.json"), "utf8"),
  ) as Record<string, Json>;

  // Output mirrors en.json's structure exactly. Work on a deep clone.
  const out = JSON.parse(JSON.stringify(en)) as Record<string, Json>;

  // Carry over the two hand-checked safety-banner strings unchanged.
  const enJourney = (en.journey ?? {}) as Record<string, Json>;
  const hiJourney = (existingHi.journey ?? {}) as Record<string, Json>;
  const outJourney = out.journey as Record<string, Json>;
  for (const key of BANNER_KEYS) {
    const carried = hiJourney[key];
    if (typeof carried === "string" && carried.trim().length > 0) {
      outJourney[key] = carried;
    } else {
      // Should not happen — the banner is required Hindi — but fail loud if so.
      throw new Error(`Existing hi.json is missing safety-banner key journey.${key}`);
    }
    if (!enJourney[key]) throw new Error(`en.json missing journey.${key}`);
  }

  const leaves = collectLeaves(out);
  console.log(`Collected ${leaves.length} translatable strings.`);

  for (let i = 0; i < leaves.length; i += CHUNK_SIZE) {
    const chunk = leaves.slice(i, i + CHUNK_SIZE);
    const translations = await withRetry(
      () => translateChunk(chunk.map((l) => l.value), apiKey),
      `chunk ${i / CHUNK_SIZE + 1}`,
    );
    chunk.forEach((leaf, j) => leaf.set(translations[j]));
    console.log(`Translated ${Math.min(i + CHUNK_SIZE, leaves.length)}/${leaves.length}`);
  }

  writeFileSync(path.join(messagesDir, "hi.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("✓ Wrote messages/hi.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
