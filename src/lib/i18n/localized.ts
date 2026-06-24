/**
 * A tiny helper for content modules (CV templates, free resources, interview
 * prep, find jobs) that hold structured data — URLs paired with prose. Their
 * prose needs translating but the URLs do not, so instead of duplicating whole
 * arrays per locale we write each translatable string inline as a {en, hi} pair
 * (the URL stays a plain string, written once) and resolve it at render time.
 *
 * A plain string is treated as not-yet-translated and used for every locale, so
 * a field can be upgraded to a pair later without touching call sites.
 */

import type { Locale } from "./config";

/** Either a single string (same in every locale) or a per-locale pair. */
export type LangText = string | { en: string; hi: string };

/** Resolve a {@link LangText} for the active locale, falling back to English. */
export function localize(value: LangText, locale: Locale): string {
  if (typeof value === "string") return value;
  return locale === "hi" ? value.hi || value.en : value.en;
}
