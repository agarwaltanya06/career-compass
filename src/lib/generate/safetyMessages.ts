/**
 * Localized text for a safety rejection raised by the server LLM gate, read from
 * the SAME message files the UI uses (messages/en.json, messages/hi.json) so the
 * wording stays in one place. The friendly `SafetyNotice` component re-renders
 * the rich version (helpline buttons) client-side from these keys; `message`
 * here is the plain-text fallback carried on the error for non-UI callers.
 */

import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";

interface SafetyDict {
  blocked: string;
  distressTitle: string;
  distressBody: string;
  helplineTeleManas: string;
  helplineKiran: string;
}

/** Pick the safety strings for a locale, falling back to English. */
export function safetyStrings(locale: string): SafetyDict {
  const dict = locale.toLowerCase().startsWith("hi") ? hi : en;
  return dict.intake.safety as SafetyDict;
}

/** A single plain-text distress message (title + body + both helplines). */
export function distressMessage(locale: string): string {
  const s = safetyStrings(locale);
  return `${s.distressTitle}. ${s.distressBody} ${s.helplineTeleManas} · ${s.helplineKiran}`;
}
