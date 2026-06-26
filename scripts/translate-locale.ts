/**
 * scripts/translate-locale.ts — build-time helper to fill a locale's message
 * file AND its content sidecar from English, via the Gemini API.
 *
 *   npx tsx scripts/translate-locale.ts <locale>        # mr | gu
 *   npx tsx scripts/translate-locale.ts mr gu           # both, in sequence
 *
 * This generalizes scripts/translate-hi.ts to any locale. It uses the Gemini
 * free-tier key (GEMINI_API_KEY) like the Hindi script; chunks are kept large so
 * the whole run stays under the free-tier request cap. It produces two artifacts
 * per locale, from the same translation pass:
 *
 *   1. messages/<locale>.json — mirrors messages/en.json exactly, every string
 *      leaf translated. Unlike the Hindi script, the SAFETY banner keys are
 *      translated too (mr/gu have no hand-checked banner to carry over — the
 *      machine translation is the honest, present-in-language safety text the
 *      check-i18n-banner gate requires).
 *
 *   2. messages/content.<locale>.json — a flat { "<english source>": "<trans>" }
 *      map for the prose held inline as {en, hi} pairs in the content modules
 *      (lib/cvTemplates, findJobsContent, interviewPrepContent,
 *      freeResourcesContent). localize() looks the English source up here for
 *      mr/gu (see src/lib/i18n/localized.ts), so the .ts modules stay untouched.
 *
 * Rules (same spirit as translate-hi.ts):
 *   • Proper nouns / technical tokens stay English (exam & institute names, AI,
 *     PDF, Word, .txt, URLs, board names, ₹ amounts, etc.).
 *   • {placeholder} tokens are preserved verbatim.
 *   • Plain everyday language a school student reads easily — not formal/literary.
 *
 * Build-time only; not a production call path.
 */

import "./_env";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const MODEL = "gemini-2.5-flash";
// Large chunks keep the total request count low (free-tier window is small).
const CHUNK_SIZE = 80;

/** Per-locale language metadata for the system prompt. */
const LOCALES: Record<string, { name: string; script: string; everyday: string }> = {
  mr: {
    name: "Marathi (मराठी)",
    script: "Devanagari",
    everyday:
      'plain, everyday spoken Marathi that a school student reads easily — NOT formal/literary or heavily Sanskritized Marathi. Common English words written in Devanagari are fine when that is how students normally say them (e.g. "कॉलेज").',
  },
  gu: {
    name: "Gujarati (ગુજરાતી)",
    script: "Gujarati",
    everyday:
      'plain, everyday spoken Gujarati that a school student reads easily — NOT formal/literary Gujarati. Common English words written in the Gujarati script are fine when that is how students normally say them (e.g. "કૉલેજ").',
  },
};

// --- JSON tree walking (messages/en.json) ----------------------------------

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Leaf {
  value: string;
  set: (translated: string) => void;
}

/** Collect every non-empty string leaf with a setter that writes into a clone. */
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
        if (child.trim().length === 0) continue; // keep empty → falls back to EN
        leaves.push({ value: child, set: (t) => ((node as Record<string, Json>)[key] = t) });
      } else {
        leaves.push(...collectLeaves(child));
      }
    }
  }

  return leaves;
}

// --- content modules: collect inline {en, hi} English strings ---------------

/** True for a LangText pair object: { en: string, hi: string }. */
function isLangPair(v: unknown): v is { en: string; hi: string } {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Record<string, unknown>).en === "string" &&
    typeof (v as Record<string, unknown>).hi === "string"
  );
}

/** Deep-walk a content module's exports, collecting every pair's English text. */
function collectPairEnglish(node: unknown, out: Set<string>): void {
  if (isLangPair(node)) {
    if (node.en.trim().length > 0) out.add(node.en);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectPairEnglish(item, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) collectPairEnglish(v, out);
  }
}

async function collectContentEnglish(): Promise<string[]> {
  // These modules hold the inline {en, hi} prose. Import their runtime exports
  // and harvest every English source string (deduped, stable order).
  const modules = await Promise.all([
    import("../src/lib/findJobsContent"),
    import("../src/lib/interviewPrepContent"),
    import("../src/lib/freeResourcesContent"),
    import("../src/lib/cvTemplates"),
  ]);
  const set = new Set<string>();
  for (const mod of modules) {
    for (const value of Object.values(mod)) {
      // Skip functions; walk exported data only.
      if (typeof value === "function") continue;
      collectPairEnglish(value, set);
    }
  }
  return [...set];
}

// --- Gemini ----------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadApiKey(): string {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv) return fromEnv;
  const envFile = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const match = envFile.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!match) throw new Error("GEMINI_API_KEY not found in env or .env.local");
  return match[1].trim();
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

function systemInstruction(locale: string): string {
  const { name, everyday } = LOCALES[locale];
  return `You translate UI strings for an Indian career-guidance website aimed at school students into ${name}.

Rules:
- Use ${everyday}
- Keep proper nouns and technical tokens UNCHANGED in English: exam names (NEET, JEE, UPSC, SSC, NDA, NIOS, CBSE, ICSE, ISC), institute/college/board names, brand/product names, "AI", "PDF", "Word", ".doc", ".txt", file extensions, URLs, ₹ amounts, and similar.
- Preserve EVERY placeholder token exactly, including the curly braces, e.g. {current}, {total}, {date}, {year}, {exam}, {name}. Do not translate or reorder the token text inside braces.
- Preserve emoji, punctuation style, and any markdown/quotes as-is.
- Keep it concise — UI labels should stay short.
- Return ONLY the translations, as a JSON array of strings of EXACTLY the same length and order as the input.`;
}

/** Translate one chunk of strings via Gemini, returning same-length array. */
async function translateChunk(
  apiKey: string,
  strings: string[],
  locale: string,
): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const prompt =
    `Translate each item in this JSON array into ${LOCALES[locale].name} following the rules. ` +
    `Return a JSON array of strings of EXACTLY length ${strings.length}, where element i is the ` +
    `translation of input element i.\n\n` +
    JSON.stringify(strings, null, 0);

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction(locale) }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: { type: "STRING" } },
    },
  };

  const MAX = 6;
  for (let attempt = 1; ; attempt++) {
    try {
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
    } catch (err) {
      if (attempt >= MAX) throw err;
      // Longer backoff than the Hindi script so a free-tier 429 can recover
      // within the next per-minute window instead of failing the run.
      const wait = 5000 * 2 ** (attempt - 1);
      console.log(`  chunk failed (attempt ${attempt}/${MAX}): ${(err as Error).message}. Retrying in ${wait}ms…`);
      await sleep(wait);
    }
  }
}

/** Translate a flat list of strings, chunked. */
async function translateAll(
  apiKey: string,
  strings: string[],
  locale: string,
  label: string,
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < strings.length; i += CHUNK_SIZE) {
    const chunk = strings.slice(i, i + CHUNK_SIZE);
    const translated = await translateChunk(apiKey, chunk, locale);
    out.push(...translated);
    console.log(`  ${label}: ${Math.min(i + CHUNK_SIZE, strings.length)}/${strings.length}`);
  }
  return out;
}

// --- main ------------------------------------------------------------------

async function translateLocale(apiKey: string, locale: string): Promise<void> {
  if (!LOCALES[locale]) throw new Error(`Unknown locale "${locale}" (expected one of ${Object.keys(LOCALES).join(", ")})`);
  console.log(`\n=== ${locale} (${LOCALES[locale].name}) ===`);
  const messagesDir = path.join(process.cwd(), "messages");

  // 1. messages/<locale>.json — mirror en.json, translate every leaf.
  const en = JSON.parse(readFileSync(path.join(messagesDir, "en.json"), "utf8")) as Record<string, Json>;
  const out = JSON.parse(JSON.stringify(en)) as Record<string, Json>;
  const leaves = collectLeaves(out);
  console.log(`Collected ${leaves.length} UI strings.`);
  const uiTranslations = await translateAll(apiKey, leaves.map((l) => l.value), locale, "ui");
  leaves.forEach((leaf, i) => leaf.set(uiTranslations[i]));
  writeFileSync(path.join(messagesDir, `${locale}.json`), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`✓ Wrote messages/${locale}.json`);

  // 2. messages/content.<locale>.json — flat en→translation map for the modules.
  const contentEn = await collectContentEnglish();
  console.log(`Collected ${contentEn.length} content strings.`);
  const contentTranslations = await translateAll(apiKey, contentEn, locale, "content");
  const contentMap: Record<string, string> = {};
  contentEn.forEach((src, i) => (contentMap[src] = contentTranslations[i]));
  writeFileSync(path.join(messagesDir, `content.${locale}.json`), JSON.stringify(contentMap, null, 2) + "\n", "utf8");
  console.log(`✓ Wrote messages/content.${locale}.json`);
}

async function main(): Promise<void> {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (targets.length === 0) {
    throw new Error("Usage: tsx scripts/translate-locale.ts <locale> [<locale>...]  (mr | gu)");
  }
  const apiKey = loadApiKey();
  for (const locale of targets) {
    await translateLocale(apiKey, locale);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
