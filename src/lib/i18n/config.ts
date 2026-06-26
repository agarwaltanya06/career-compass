/**
 * Internationalization config. Designed to be extended: add a locale here, add
 * its message file in /messages, and wire it into the provider's `dictionaries`
 * map. The LanguageSwitcher reads `locales` to build its dropdown.
 */

export type Locale = "en" | "hi" | "mr" | "gu";

/** The locale used when no cookie is set and nothing else is known. */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Locales the app knows about. The switcher only offers `enabled` locales;
 * set `enabled: false` to keep a locale in code (and translatable) but hide it
 * from the dropdown while its message file is still being filled.
 */
export const locales: { code: Locale; labelKey: string; enabled: boolean }[] = [
  { code: "en", labelKey: "lang.english", enabled: true },
  { code: "hi", labelKey: "lang.hindi", enabled: true },
  { code: "mr", labelKey: "lang.marathi", enabled: true },
  { code: "gu", labelKey: "lang.gujarati", enabled: true },
];

/**
 * Locales whose copy is machine-translated and NOT yet human-verified. Pages
 * show an honest "machine-translated — may contain errors" note for these so the
 * safety content (scam rules, disclaimers) carries the same honesty as a
 * runtime-generated journey's "AI-generated" banner. English and Hindi are
 * human-reviewed, so they're absent here.
 */
export const UNVERIFIED_LOCALES: readonly Locale[] = ["mr", "gu"];

/** True when the locale's static copy is machine-translated and unverified. */
export function isMachineTranslated(locale: Locale): boolean {
  return UNVERIFIED_LOCALES.includes(locale);
}

/** Cookie that persists the user's locale choice across visits. */
export const LOCALE_COOKIE = "cc_locale";

/** One year, in seconds — used when writing the locale cookie. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrow an arbitrary string to a known Locale, falling back to default. */
export function normalizeLocale(value: string | undefined | null): Locale {
  return locales.some((l) => l.code === value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
