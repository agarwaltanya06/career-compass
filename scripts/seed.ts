/**
 * scripts/seed.ts — pre-generate and cache journeys (spec §4 "Pre-seeding").
 *
 * Walks the seed list (scripts/seed-list.ts) and, for each profile not already
 * cached, runs the SAME generation pipeline the live route uses
 * (src/lib/generate/run.ts → runGeneration), so seeded content is identical to
 * what a real cache miss would store. Each result lands in journeys/candidates/
 * as an UNVERIFIED candidate (§4) — you review them, then `npm run promote` the
 * good ones to verified + pinned.
 *
 *   npm run seed                   # whole list, 10s between calls
 *   npm run seed -- --limit 3      # just the first 3 misses (small test batch)
 *   npm run seed -- --delay 15     # 15s between calls
 *   npm run seed -- --career ca    # only this career's class 10/11/12
 *
 * Behaviour:
 *   - SEQUENTIAL only, never parallel — one call at a time with `--delay`
 *     seconds (default 10) between them to stay under Gemini's per-minute limit.
 *   - GEMINI FREE TIER FIRST. On a 429 / rate-limit: wait and retry with
 *     exponential backoff (30s, 60s, 120s) — 1 initial attempt + up to 3 retries.
 *   - HAIKU FALLBACK per profile: only once Gemini is exhausted (rate-limited
 *     after backoff, or no usable content — e.g. RECITATION) do we fall back to
 *     the paid Anthropic Haiku key for that one profile (spec §5). The result is
 *     cached regardless of which model produced it.
 *   - RESUMABLE: any profile that already has a verified default OR a candidate
 *     is skipped, so re-running continues where it left off.
 */

import "./_env"; // must be first: populates process.env from .env.local
import { seedProfiles, type SeedProfile } from "./seed-list";
import { buildCacheKey, cacheFileName, cacheKeyToSlug } from "@/lib/generate/cacheKey";
import { readVerified, readLatestCandidate } from "@/lib/generate/store";
import { runGeneration, GenerateError } from "@/lib/generate/run";
import type {
  GenerateResponseBody,
  GenerationProfile,
  ProviderChoice,
} from "@/lib/generate/types";

/** Stage 1: Gemini free tier (its own RECITATION retries live in the provider). */
const GEMINI: ProviderChoice = { provider: "gemini" };
/** Stage 2 fallback: the paid Anthropic Haiku key, per profile, only when needed. */
const ANTHROPIC: ProviderChoice = { provider: "anthropic" };

/** Backoff schedule for 429s: 1 initial try + up to these three retries. */
const RETRY_BACKOFFS_MS = [30_000, 60_000, 120_000];

const DEFAULT_DELAY_MS = 10_000;

interface Options {
  limit: number;
  delayMs: number;
  /** When set, seed only this career's profiles (intake code, case-insensitive). */
  career?: string;
}

/**
 * Parse `--limit N` / `--limit=N`, `--delay SECONDS` / `--delay=SECONDS`, and
 * `--career NAME` / `--career=NAME` (the career's intake code, e.g. `ca`).
 */
function parseArgs(argv: string[]): Options {
  let limit = Infinity;
  let delayMs = DEFAULT_DELAY_MS;
  let career: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (inline: string): string =>
      arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i] ?? inline;
    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const n = parseInt(value(""), 10);
      if (Number.isFinite(n) && n >= 0) limit = n;
    } else if (arg === "--delay" || arg.startsWith("--delay=")) {
      const s = parseFloat(value(""));
      if (Number.isFinite(s) && s >= 0) delayMs = Math.round(s * 1000);
    } else if (arg === "--career" || arg.startsWith("--career=")) {
      const c = value("").trim().toLowerCase();
      if (c) career = c;
    }
  }
  return { limit, delayMs, career };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turn a seed-list row into the minimal profile the pipeline expects. */
function toProfile(seed: SeedProfile, currentDate: string): GenerationProfile {
  return {
    class: seed.class,
    board: seed.board,
    // "none" is the seed-list sentinel for "no stream yet" (class 10); the
    // pipeline wants it absent. buildCacheKey maps undefined → "none" anyway.
    stream: seed.stream && seed.stream !== "none" ? seed.stream : undefined,
    career: seed.career,
    locale: seed.language,
    currentDate,
  };
}

/** Run Gemini for one profile, retrying with exponential backoff on 429s. */
async function generateOnGemini(profile: GenerationProfile): Promise<GenerateResponseBody> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runGeneration(profile, GEMINI, () => {});
    } catch (err) {
      const rateLimited = err instanceof GenerateError && err.rateLimited;
      if (rateLimited && attempt < RETRY_BACKOFFS_MS.length) {
        const wait = RETRY_BACKOFFS_MS[attempt];
        console.log(
          `      ↻ rate-limited; backing off ${wait / 1000}s (retry ${attempt + 1}/${RETRY_BACKOFFS_MS.length})`,
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Generate one profile: Gemini free tier first (with 429 backoff); only if that's
 * exhausted, fall back to paid Haiku for this profile. Returns the provider that
 * actually produced the cached candidate.
 */
async function generateProfile(profile: GenerationProfile): Promise<string> {
  try {
    const res = await generateOnGemini(profile);
    return res.generatedBy?.provider ?? "gemini";
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.log(`      ⚠ Gemini exhausted (${why}) — falling back to Haiku`);
  }
  const res = await runGeneration(profile, ANTHROPIC, () => {});
  return res.generatedBy?.provider ?? "anthropic";
}

async function main() {
  const { limit, delayMs, career } = parseArgs(process.argv.slice(2));

  // ---- Career filter (--career): seed only that career's class 10/11/12. With
  // no flag, seed everything. Match the intake code case-insensitively. ----
  const profiles = career
    ? seedProfiles.filter((p) => p.career.toLowerCase() === career)
    : seedProfiles;
  if (career && profiles.length === 0) {
    const known = [...new Set(seedProfiles.map((p) => p.career))].sort().join(", ");
    console.error(
      `✗ --career "${career}" matched no seed profiles. Known careers: ${known}.`,
    );
    process.exit(1);
  }

  // Fail fast if the primary (Gemini) isn't configured. Mirrors makeProvider's key lookup.
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error(
      "✗ GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. Seeding leads with the Gemini free tier — set the key and retry.",
    );
    process.exit(1);
  }
  // The Haiku fallback is optional but recommended: without it, content-heavy
  // careers that exhaust Gemini (RECITATION) will simply fail and stay unseeded.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠ ANTHROPIC_API_KEY not set — no Haiku fallback. Profiles Gemini can't produce will fail.\n",
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const total = profiles.length;
  console.log(
    `Seeding from ${total} profile(s)` +
      (career ? ` for career "${career}"` : "") +
      ` — Gemini free tier, ${delayMs / 1000}s between calls` +
      (Number.isFinite(limit) ? `, limit ${limit}` : "") +
      ".\n",
  );

  let done = 0;
  let skipped = 0;
  let failed = 0;
  let attempts = 0; // generations actually started (the thing --limit caps)

  for (let i = 0; i < profiles.length; i++) {
    const seed = profiles[i];
    const profile = toProfile(seed, today);
    const cacheKey = buildCacheKey(profile);
    const fileName = cacheFileName(cacheKey, profile.locale);
    const slug = cacheKeyToSlug(cacheKey);
    const label = `${slug} [${profile.locale}]`;

    // ---- Resumable skip: already verified or already has a candidate. ----
    if ((await readVerified(fileName)) || (await readLatestCandidate(fileName))) {
      skipped++;
      console.log(`• skip   ${label} (already cached)`);
      continue;
    }

    if (attempts >= limit) {
      console.log(`\nReached --limit ${limit}; stopping. Re-run to continue.`);
      break;
    }

    // Space out real API calls; no delay before the first or after a skip.
    if (attempts > 0) await sleep(delayMs);
    attempts++;

    console.log(`→ gen    ${label}  (${attempts}${Number.isFinite(limit) ? `/${limit}` : ""})`);
    try {
      const provider = await generateProfile(profile);
      done++;
      console.log(
        `  ✓ done  ${label} via ${provider}  [${done} ok, ${skipped} skipped, ${failed} failed]`,
      );
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ error ${label}: ${msg}`);
    }
  }

  console.log(
    `\nFinished: ${done} generated, ${skipped} skipped, ${failed} failed (of ${total} total).`,
  );
  if (done > 0) {
    console.log(
      "New candidates are in journeys/candidates/. Review them, then promote the good ones:\n" +
        "  npm run promote -- <slug> [<slug> ...]",
    );
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
