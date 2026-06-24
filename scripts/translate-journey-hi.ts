/**
 * scripts/translate-journey-hi.ts — build a Hindi journey from a VERIFIED English
 * one by translating only its prose, then write it as the Hindi verified default.
 *
 *   npx tsx scripts/translate-journey-hi.ts engineer_cbse_none_class10
 *   npx tsx scripts/translate-journey-hi.ts engineer_cbse_none_class10 engineer_cbse_pcm_class11 engineer_cbse_pcm_class12
 *
 * Why translate instead of regenerate in Hindi: a fresh Hindi generation hydrates
 * its colleges/exams from the ENGLISH reference table, so those cards come back
 * partly in English. Translating the finished English journey (whose facts are
 * already the trusted table values) gives a fully-Hindi plan with identical
 * structure and numbers — proper nouns and links stay English.
 *
 * What is translated: narrative prose only (summary, day-in-life, demand, pay
 * notes, requirements; per route: name/bestFor/feasibilityReason/duration, step
 * titles & descriptions, core skills, upskilling name/why, exam
 * purpose/eligibility/window, college feesNote/entranceRequired, fallback
 * options; prep-resource titles; disclaimers; grounding claims; meta.career).
 * What is NOT: ids, enums, costBands, dates, cacheKey, offsets, ₹ amounts,
 * URLs, and the proper-noun `name` fields of colleges/exams (kept English).
 *
 * Output is validated with parseJourney + auditJourney before writing. This is a
 * build-time script; promote/pin separately (npm run promote -- <slug> --lang hi
 * or it's pinned for you when run with --pin).
 */

import "./_env"; // populate process.env from .env.local (GEMINI_API_KEY)
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { parseJourney } from "@/lib/journeySchema";
import { auditJourney } from "@/lib/generate/audit";
import { markPinned } from "@/lib/generate/store";
import { isValidSlug } from "@/lib/generate/cacheKey";
import type { Journey } from "@/lib/types";

const MODEL = "gemini-2.5-flash";
const CHUNK_SIZE = 30;
const JOURNEYS_DIR = path.join(process.cwd(), "journeys");

// --- env (mirrors scripts/translate-hi.ts) ---------------------------------

function loadApiKey(): string {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv) return fromEnv;
  const envFile = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const match = envFile.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!match) throw new Error("GEMINI_API_KEY not found in env or .env.local");
  return match[1].trim();
}

// --- leaf collection (field-aware, never generic) --------------------------

interface Leaf {
  value: string;
  set: (translated: string) => void;
}

/** Push a leaf for `obj[key]` when it's a non-empty string. */
function pushStr(leaves: Leaf[], obj: unknown, key: string): void {
  const o = obj as Record<string, unknown>;
  const v = o[key];
  if (typeof v === "string" && v.trim().length > 0) {
    leaves.push({ value: v, set: (t) => (o[key] = t) });
  }
}

/** Push a leaf for every non-empty string in a string array (mutates in place). */
function pushArr(leaves: Leaf[], arr: unknown): void {
  if (!Array.isArray(arr)) return;
  arr.forEach((item, i) => {
    if (typeof item === "string" && item.trim().length > 0) {
      leaves.push({ value: item, set: (t) => ((arr as string[])[i] = t) });
    }
  });
}

/**
 * Collect exactly the prose leaves we want translated. Proper-noun `name` fields
 * (colleges/exams), URLs, ids, enums, dates and ₹ amounts are deliberately left
 * out so they survive verbatim.
 */
function collectJourneyLeaves(j: Journey): Leaf[] {
  const leaves: Leaf[] = [];

  pushStr(leaves, j.meta, "career");

  const ov = j.overview;
  pushStr(leaves, ov, "summary");
  pushStr(leaves, ov, "dayInLife");
  pushStr(leaves, ov, "demandOutlook");
  pushStr(leaves, ov.payRange, "entry");
  pushStr(leaves, ov.payRange, "experienced");
  pushStr(leaves, ov.payRange, "note");
  pushArr(leaves, ov.requirements);

  for (const route of j.routes) {
    pushStr(leaves, route, "name");
    pushStr(leaves, route, "bestFor");
    pushStr(leaves, route, "feasibilityReason");
    pushStr(leaves, route, "duration");

    for (const step of route.steps) {
      pushStr(leaves, step, "title");
      pushStr(leaves, step, "description");
    }

    pushArr(leaves, route.skills.coreSkills);
    for (const up of route.skills.upskilling) {
      pushStr(leaves, up, "name");
      pushStr(leaves, up, "why");
    }

    // Exams/colleges: prose only — `name` and `officialUrl` stay English.
    for (const exam of route.exams) {
      pushStr(leaves, exam, "purpose");
      pushStr(leaves, exam, "eligibility");
      pushStr(leaves, exam, "typicalWindow");
    }
    for (const college of route.colleges) {
      pushStr(leaves, college, "feesNote");
      pushStr(leaves, college, "entranceRequired");
    }

    pushArr(leaves, route.missedDeadlineFallback.options);
  }

  for (const res of j.prepResources) pushStr(leaves, res, "title");
  for (const g of j.groundingSources) pushStr(leaves, g, "claim");
  pushArr(leaves, j.disclaimers);

  return leaves;
}

// --- Gemini (mirrors scripts/translate-hi.ts, prose-tuned) ------------------

const SYSTEM_INSTRUCTION = `You translate content for an Indian career-guidance website aimed at school students into Hindi.

Rules:
- Use plain, everyday spoken Hindi that a school student reads easily. Do NOT use formal, literary, or heavily Sanskritized Hindi. Prefer common words people actually say (e.g. "कॉलेज" not "महाविद्यालय", "नौकरी" not "रोज़गार" where natural). Common English words written in Devanagari are fine if that is how students normally say them (e.g. "इंजीनियर", "ऑनलाइन कोर्स").
- Keep proper nouns and technical tokens UNCHANGED in English: exam names (JEE, JEE Main, JEE Advanced, BITSAT, VITEEE, MET, MHT-CET, KCET, WBJEE, NEET, NTA, JoSAA, COMEDK), institute/college/university/board names (IIT, NIT, IIIT, BITS, VIT, Manipal, COEP, VJTI, UVCE, CBSE), brand/product names, degree names (B.Tech, B.E., M.Tech, MS), "AI", "PDF", "Word", ".txt", file extensions, and URLs.
- Keep all numbers, ₹ amounts, percentages, ranks and dates EXACTLY as written (e.g. "₹1,98,000 - ₹3,98,000", "60%", "4 years").
- Preserve EVERY placeholder token exactly, including the curly braces, e.g. {current}, {total}, {date}, {year}, {exam}, {name}.
- Preserve emoji, punctuation and any quotes as-is.
- Keep the length and tone close to the source; UI labels stay short.
- Return ONLY the translations, one per input item, in the same order.`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function translateOne(slug: string, apiKey: string, pin: boolean): Promise<boolean> {
  const enPath = path.join(JOURNEYS_DIR, `${slug}__en.json`);
  if (!existsSync(enPath)) {
    console.error(`✗ ${slug}: no English verified default at ${path.relative(process.cwd(), enPath)}`);
    return false;
  }

  // Deep-clone so we mutate a copy, leaving the English source untouched.
  const source = JSON.parse(readFileSync(enPath, "utf8")) as Journey;
  const out = JSON.parse(JSON.stringify(source)) as Journey;
  out.meta.studentProfile.language = "hi";

  const leaves = collectJourneyLeaves(out);
  console.log(`${slug}: translating ${leaves.length} strings…`);

  for (let i = 0; i < leaves.length; i += CHUNK_SIZE) {
    const chunk = leaves.slice(i, i + CHUNK_SIZE);
    const translations = await withRetry(
      () => translateChunk(chunk.map((l) => l.value), apiKey),
      `${slug} chunk ${i / CHUNK_SIZE + 1}`,
    );
    chunk.forEach((leaf, j) => leaf.set(translations[j]));
    console.log(`  ${Math.min(i + CHUNK_SIZE, leaves.length)}/${leaves.length}`);
  }

  // Validate + audit the same way the live pipeline does before we trust it.
  const parsed = parseJourney(out);
  if (!parsed) {
    console.error(`✗ ${slug}: translated journey failed parseJourney — not written.`);
    return false;
  }
  const audit = auditJourney(parsed);
  if (audit.structural.length > 0) {
    console.error(`✗ ${slug}: structural audit issues — not written:\n   ${audit.structural.join("\n   ")}`);
    return false;
  }
  if (audit.review.length > 0) {
    console.warn(`  ⚠ ${slug}: review notes (non-blocking):\n   ${audit.review.join("\n   ")}`);
  }

  const hiPath = path.join(JOURNEYS_DIR, `${slug}__hi.json`);
  writeFileSync(hiPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  console.log(`✓ ${slug} → ${path.relative(process.cwd(), hiPath)}`);

  if (pin) {
    await markPinned({ slug, language: "hi", verifiedAt: new Date().toISOString().slice(0, 10) });
    console.log(`  pinned ${slug} [hi]`);
  }
  return true;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pin = args.includes("--pin");
  const slugs = args.filter((a) => !a.startsWith("--"));
  if (slugs.length === 0) {
    console.error("Usage: npx tsx scripts/translate-journey-hi.ts <slug> [<slug> ...] [--pin]");
    process.exit(1);
  }
  const apiKey = loadApiKey();

  let ok = 0;
  let failed = 0;
  for (const slug of slugs) {
    if (!isValidSlug(slug)) {
      console.error(`✗ ${slug}: not a valid career_board_stream_class slug — skipping.`);
      failed++;
      continue;
    }
    if (await translateOne(slug, apiKey, pin)) ok++;
    else failed++;
  }
  console.log(`\nTranslated ${ok}, failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
