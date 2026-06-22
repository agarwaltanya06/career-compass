/**
 * scripts/check-i18n-banner.ts — guard the unverified-banner SAFETY DISCLAIMER.
 *
 *   npm run check:i18n
 *
 * The AI-generated/unverified banner (journey.candidateBannerTitle +
 * journey.candidateBanner) is a SAFETY message: it tells a student the plan is
 * machine-written and unreviewed, and to verify specifics on official sites. The
 * people reading in Hindi are exactly the ones who must understand it, so unlike
 * the rest of messages/hi.json — which is intentionally sparse and falls back to
 * English — these two keys MUST be real Hindi and must NOT fall back.
 *
 * This check fails (exit 1) if EITHER:
 *   1. a banner key is missing or empty in messages/hi.json (would fall back to
 *      English — the thing we forbid), OR
 *   2. the ENGLISH banner wording changed. We pin a hash of the English source;
 *      when the source text changes the hash no longer matches, so the check
 *      fails and forces whoever changed it to RE-READ the Hindi (it may now be a
 *      mistranslation) and then bump EXPECTED_EN_HASH below to acknowledge.
 *
 * To intentionally change the English wording: update messages/en.json, re-check
 * (and usually re-translate) messages/hi.json, then paste the new hash this
 * script prints into EXPECTED_EN_HASH.
 */

import { readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";

/** The two safety-disclaimer keys, under the `journey` namespace in each locale. */
const BANNER_KEYS = ["candidateBannerTitle", "candidateBanner"] as const;

/**
 * SHA-256 of the canonical English banner JSON (see {@link englishHash}). Bump
 * this ONLY after re-checking the Hindi against the new English wording — that's
 * the whole point of the gate. The failure message prints the value to paste.
 */
const EXPECTED_EN_HASH =
  "ac8ab8325e470ca95b4b0c8a04dba8726545169f962b90b6b0bc0f732bc602e3";

type Journey = Record<string, unknown>;

/** Read `messages/<file>` and return its `journey` namespace (or throw). */
function loadJourney(file: string): Journey {
  const full = path.join(process.cwd(), "messages", file);
  const data = JSON.parse(readFileSync(full, "utf8")) as { journey?: Journey };
  if (!data.journey || typeof data.journey !== "object") {
    throw new Error(`${file}: missing a "journey" namespace`);
  }
  return data.journey;
}

/** A non-empty string value, trimmed; null if missing/blank (would fall back). */
function nonEmpty(obj: Journey, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/** Hash the English banner strings in a stable, key-ordered way. */
function englishHash(en: Journey): string {
  const canonical = JSON.stringify(
    Object.fromEntries(BANNER_KEYS.map((k) => [k, en[k]])),
  );
  return createHash("sha256").update(canonical).digest("hex");
}

function main(): void {
  const en = loadJourney("en.json");
  const hi = loadJourney("hi.json");
  const errors: string[] = [];

  // 1. English source must itself be present (it's what Hindi is checked against).
  for (const key of BANNER_KEYS) {
    if (!nonEmpty(en, key)) {
      errors.push(`messages/en.json: journey.${key} is missing or empty.`);
    }
  }

  // 2. Hindi must be real (never empty → never falls back to English).
  for (const key of BANNER_KEYS) {
    if (!nonEmpty(hi, key)) {
      errors.push(
        `messages/hi.json: journey.${key} is missing or empty. This is the ` +
          `safety disclaimer — it must be translated, not left to fall back to ` +
          `English. Add an accurate Hindi string.`,
      );
    }
  }

  // 3. If the English wording moved, force a Hindi re-check via the pinned hash.
  const actual = englishHash(en);
  if (actual !== EXPECTED_EN_HASH) {
    errors.push(
      `The English unverified-banner wording changed (hash ${actual} ≠ pinned ` +
        `${EXPECTED_EN_HASH}). Re-read messages/hi.json against the new English ` +
        `(it may now be a mistranslation), update the Hindi if needed, then set ` +
        `EXPECTED_EN_HASH in scripts/check-i18n-banner.ts to:\n    ${actual}`,
    );
  }

  if (errors.length > 0) {
    console.error("✗ unverified-banner i18n check failed:\n");
    for (const e of errors) console.error(`  • ${e}\n`);
    process.exit(1);
  }

  console.log("✓ unverified-banner i18n check passed (Hindi present; English wording unchanged).");
}

main();
