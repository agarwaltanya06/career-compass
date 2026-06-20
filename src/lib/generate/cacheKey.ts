/**
 * The cache key (spec §4): `career | board | stream | classBucket`.
 *
 * No location, cost, or model/provider — once verified, a journey is just
 * content, identical regardless of who generated it or on which model. Dropping
 * budget and location also shrinks the key space → more cache hits → fewer API
 * calls (spec §1 note).
 *
 * Language is deliberately NOT in the visible key (it matches the §2 sample,
 * "ca|cbse|commerce-maths|class12"), but IS part of the stored filename so the
 * English and Hindi versions of the same path cache separately (spec §4).
 */

import type { GenerationProfile } from "./types";

/** Kebab-case a free-text or already-slugged career into a stable token. */
export function slugifyCareer(career: string): string {
  return career
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Collapse the class answer into a coarse bucket. Numeric classes become
 * `class9`…`class12`; the post-school answers (`passed12`, `college`, `gap`)
 * pass through as-is — they're already buckets.
 */
export function classBucket(cls: string): string {
  const c = cls.trim().toLowerCase();
  return /^(9|10|11|12)$/.test(c) ? `class${c}` : c;
}

/** Build the normalized, pipe-delimited cache key. */
export function buildCacheKey(p: GenerationProfile): string {
  const career = slugifyCareer(p.career) || "unknown";
  const board = (p.board || "none").trim().toLowerCase();
  const stream = (p.stream || "none").trim().toLowerCase();
  return `${career}|${board}|${stream}|${classBucket(p.class)}`;
}

/**
 * Filesystem-safe filename for a journey, with the language appended so en/hi
 * never collide. Pipes become underscores and any stray characters are dropped.
 */
export function cacheFileName(cacheKey: string, locale: string): string {
  const safe = cacheKey.replace(/\|/g, "_").replace(/[^a-z0-9_-]/gi, "");
  const lang = (locale || "en").toLowerCase().replace(/[^a-z0-9-]/g, "") || "en";
  return `${safe}__${lang}.json`;
}
