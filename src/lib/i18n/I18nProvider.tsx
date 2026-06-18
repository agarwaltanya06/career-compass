"use client";

/**
 * The i18n runtime: a React context holding the current locale plus a `t(key)`
 * helper that reads from the active message file. The choice is persisted in a
 * cookie so it survives reloads, and the server seeds the initial locale from
 * that same cookie (see app/layout.tsx) to avoid a flash of the wrong language.
 *
 * Message files live in /messages. Both are imported at build time; switching
 * locale just swaps which dictionary we read from — no network request.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  normalizeLocale,
  type Locale,
} from "./config";

/** Each dictionary is an arbitrarily nested object of strings / string arrays. */
type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = {
  en,
  // hi is intentionally sparse; missing/empty values fall back to English.
  hi: hi as Messages,
};

/** Read a dot-path (e.g. "intake.questions.class") out of a dictionary. */
function resolve(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as object)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

/** Empty string / empty array / undefined all count as "not translated yet". */
function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Replace {name} tokens with values from `vars`. */
function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a string key, with English fallback and {var} interpolation. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Translate a key whose value is an array of strings (e.g. list items). */
  tList: (key: string) => string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    normalizeLocale(initialLocale)
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // Persist for next visit + so the server can seed the right locale.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const active = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
    const fallback = dictionaries[DEFAULT_LOCALE];

    const t = (key: string, vars?: Record<string, string | number>): string => {
      const raw = resolve(active, key);
      const chosen = isBlank(raw) ? resolve(fallback, key) : raw;
      if (typeof chosen !== "string") return key; // missing key → show the key
      return interpolate(chosen, vars);
    };

    const tList = (key: string): string[] => {
      const raw = resolve(active, key);
      const chosen = isBlank(raw) ? resolve(fallback, key) : raw;
      return Array.isArray(chosen) ? (chosen as string[]) : [];
    };

    return { locale, setLocale, t, tList };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the i18n helpers. Must be used under <I18nProvider>. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>");
  }
  return ctx;
}
