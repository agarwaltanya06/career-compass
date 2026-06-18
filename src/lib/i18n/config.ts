/**
 * Internationalization config. Designed to be extended: add a locale here, add
 * its message file in /messages, and wire it into the provider's `dictionaries`
 * map. The LanguageSwitcher reads `locales` to build its dropdown.
 */

export type Locale = "en" | "hi";

/** The locale used when no cookie is set and nothing else is known. */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Locales the app knows about. `enabled: false` keeps a locale visible in code
 * (and translatable) but not yet selectable — Hindi stays here until its
 * message file is filled. The switcher only offers `enabled` locales.
 */
export const locales: { code: Locale; labelKey: string; enabled: boolean }[] = [
  { code: "en", labelKey: "lang.english", enabled: true },
  // TODO: enable once messages/hi.json is filled.
  { code: "hi", labelKey: "lang.hindi", enabled: false },
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
