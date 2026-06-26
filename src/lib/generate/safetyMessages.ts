/**
 * Localized text for a safety rejection raised by the server LLM gate, read from
 * the SAME message files the UI uses (messages/en.json, messages/hi.json) so the
 * wording stays in one place. The friendly `SafetyNotice` component re-renders
 * the rich version (helpline buttons) client-side from these keys; `message`
 * here is the plain-text fallback carried on the error for non-UI callers.
 */

import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import mr from "../../../messages/mr.json";
import gu from "../../../messages/gu.json";

interface SafetyDict {
  blocked: string;
  distressTitle: string;
  distressBody: string;
  helplineTeleManas: string;
  helplineKiran: string;
}

const DICTS: Record<string, { intake: { safety: unknown } }> = { en, hi, mr, gu };

/**
 * Pick the safety strings for a locale, falling back to English. The distress
 * helpline message and the blocked notice are safety content, so every supported
 * language carries its own (machine-) translation rather than reverting to
 * English — a distressed reader should see the helplines in their language.
 */
export function safetyStrings(locale: string): SafetyDict {
  const code = locale.toLowerCase().slice(0, 2);
  const dict = DICTS[code] ?? en;
  return dict.intake.safety as SafetyDict;
}

/** A single plain-text distress message (title + body + both helplines). */
export function distressMessage(locale: string): string {
  const s = safetyStrings(locale);
  return `${s.distressTitle}. ${s.distressBody} ${s.helplineTeleManas} · ${s.helplineKiran}`;
}
