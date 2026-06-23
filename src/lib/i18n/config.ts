/**
 * Internationalization config. Designed to be extended: add a locale here, add
 * its message file in /messages, and wire it into the provider's `dictionaries`
 * map. The LanguageSwitcher reads `locales` to build its dropdown.
 */

export type Locale = "en" | "hi";

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
];

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
