/**
 * A tiny helper for content modules (CV templates, free resources, interview
 * prep, find jobs) that hold structured data — URLs paired with prose. Their
 * prose needs translating but the URLs do not.
 *
 * English and Hindi are written inline as a {en, hi} pair (the URL stays a plain
 * string, written once). The later machine-translated locales (Marathi,
 * Gujarati) are NOT written inline — that would mean editing every .ts module by
 * hand. Instead they live in generated sidecar maps (messages/content.<locale>.
 * json), keyed by the English source string, and we look them up at render time.
 * See scripts/translate-locale.ts, which produces both messages/<locale>.json
 * (the UI strings) and these content sidecars from the same translation pass.
 *
 * A plain string is treated as not-yet-translated and used for every locale, so
 * a field can be upgraded to a pair later without touching call sites.
 */

import type { Locale } from "./config";
import contentMr from "../../../messages/content.mr.json";
import contentGu from "../../../messages/content.gu.json";

/** Either a single string (same in every locale) or an en/hi pair. */
export type LangText = string | { en: string; hi: string };

/** Generated en-string → translation maps for the machine-translated locales. */
const SIDECARS: Partial<Record<Locale, Record<string, string>>> = {
  mr: contentMr as Record<string, string>,
  gu: contentGu as Record<string, string>,
};

/** Resolve a {@link LangText} for the active locale, falling back to English. */
export function localize(value: LangText, locale: Locale): string {
  if (typeof value === "string") return value;
  if (locale === "hi") return value.hi || value.en;
  // Marathi / Gujarati: look the English source up in the generated sidecar;
  // fall back to English when a string isn't translated yet.
  const sidecar = SIDECARS[locale];
  if (sidecar) return sidecar[value.en] || value.en;
  return value.en;
}
