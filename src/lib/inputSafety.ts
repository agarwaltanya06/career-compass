/**
 * Safety filter for the free-text "type the career you want" field.
 *
 * Enforced in the intake UI BEFORE the Next button advances or any model call
 * is made (see app/intake/page.tsx). Three layers, in priority order:
 *
 *   1. A hard character cap (CAREER_INPUT_MAX) — applied as the input's
 *      maxLength and re-checked before advancing. Real career names are short.
 *   2. Distress / self-harm detection → caller shows a gentle helpline message,
 *      never a blank rejection. Checked FIRST so "kill myself" routes to help,
 *      not to the blocklist.
 *   3. A conservative blocklist (slurs, explicit sexual, violent intent) →
 *      caller shows a neutral "please enter a career" prompt, not an accusation.
 *
 * This is the FAST first gate only — it runs with no network, instantly, on the
 * Next button. A second, smarter gate (an LLM relevance/safety check in
 * lib/generate/screen.ts) runs server-side before any web search, and catches
 * what a word list can't: off-topic-but-clean input ("bad person", a question, a
 * name) and harmful phrasing this list misses. So this list errs toward being
 * STRICT and accepts false positives — e.g. anything containing "sex" is blocked
 * even though that also stops "sexologist"/"sex educator". Better safe than
 * sorry; a genuine student can rephrase, and the LLM gate is the nuanced layer.
 */

/** Hard cap on the free-text career field. Real careers fit comfortably. */
export const CAREER_INPUT_MAX = 60;

export type CareerInputVerdict = "ok" | "blocked" | "distress";

/**
 * Self-harm / acute-distress phrases. Phrase-based (not lone words like "die",
 * which would catch "dietician") so we don't false-positive on careers.
 */
const DISTRESS_PATTERNS: RegExp[] = [
  /\bkill (myself|my self|me)\b/,
  /\b(suicide|suicidal)\b/,
  /\bend (my|this) life\b/,
  /\bend it all\b/,
  /\b(want|wanna|going|trying|need) to die\b/,
  /\bi (want|wanna) to? die\b/,
  /\bwant to end (it|my life|everything)\b/,
  /\bdon'?t (want|wanna) to? (live|be alive|exist)\b/,
  /\bno (reason|point) (to|in) (live|living|life)\b/,
  /\bself ?harm\b/,
  /\b(cut|hurt|harm|injure) (myself|my self|me)\b/,
  /\bhang myself\b/,
  /\boverdose\b/,
  /\bi (hate|want to end) my life\b/,
];

/**
 * Substring tokens we block ANYWHERE in the input — no word boundary — because
 * they almost never appear inside a legitimate career and the cost of a rare
 * false positive (the student rephrases) is far lower than letting them through.
 * Per product call, "sex" is here even though it also stops "sexologist".
 */
const BLOCKED_SUBSTRINGS: string[] = [
  "sex",
  "porn",
  "nude",
  "nsfw",
  "xxx",
  "fetish",
  "escort",
  "hentai",
  "incest",
  "bestial",
  "pedo",
  "paedo",
  "rape",
  "molest",
];

/**
 * Slurs, profanity, and violent intent — word-boundaried so a handful of real
 * terms still pass (e.g. "analyst", "assistant"), but otherwise strict.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // Profanity
  /\bfuck\w*/,
  /\bshit\b/,
  /\bbastard\b/,
  /\bbitch\b/,
  /\basshole\b/,
  /\bdickhead\b/,
  // Slurs (racial / ethnic / homophobic / ableist)
  /\bn[i1]gg(er|a|ers|as)\b/,
  /\bf[a4]gg?ots?\b/,
  /\bfags?\b/,
  /\bretards?\b/,
  /\bchinks?\b/,
  /\bspics?\b/,
  /\bkikes?\b/,
  /\bcoons?\b/,
  /\bdykes?\b/,
  /\btrann(y|ies)\b/,
  /\bpakis?\b/,
  // Explicit sexual (bare "sex"/"sexual"/"escort"/"stripper" intentionally NOT
  // blocked — sexologist, sex educator, paint-stripper, etc. are real terms)
  /\bporn\w*/,
  /\bprostitut\w*/,
  /\bwhores?\b/,
  /\bsluts?\b/,
  /\b(blow|hand) ?jobs?\b/,
  /\bdicks?\b/,
  /\bcocks?\b/,
  /\bpuss(y|ies)\b/,
  /\bpen(is|ises)\b/,
  /\bvaginas?\b/,
  /\bboobs?\b/,
  /\bnudes?\b/,
  // Violent intent (boundaried so "therapist"/"grape"/"scrape" are safe)
  /\bmurder\w*/,
  /\bhit ?man\b/,
  /\bterroris\w*/,
  /\brapists?\b/,
  /\brape\b/,
  /\bkill (people|them|him|her|everyone|someone)\b/,
  /\bshoot (people|up|them|everyone)\b/,
  /\bbehead\w*/,
  /\bmassacre\w*/,
  /\bgenocide\b/,
  // Common romanized Hindi abuse
  /\bchutiy\w*/,
  /\bmadar ?chod\w*/,
  /\bbehen ?chod\w*/,
  /\bbhosd\w*/,
  /\brandi\b/,
  /\bgaand\w*/,
  /\blund\b/,
  /\bharami\b/,
  /\bmc bc\b/,
];

/**
 * Classify a free-text career input. Returns "distress" for self-harm signals,
 * "blocked" for disallowed content, and "ok" otherwise. Over-length is handled
 * separately by the caller via CAREER_INPUT_MAX.
 */
export function classifyCareerInput(raw: string): CareerInputVerdict {
  // Lowercase + collapse separators so spacing/punctuation can't trivially mask
  // a term, while leaving apostrophes for the don't/can't patterns above.
  const text = raw
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s._\-]+/g, " ")
    .trim();
  if (!text) return "ok";

  // Distress is checked first so a cry for help routes to support, not a block.
  if (DISTRESS_PATTERNS.some((re) => re.test(text))) return "distress";
  // Strict substring tokens, then boundaried slur/violence patterns. (Spaced-out
  // evasions like "s e x" are left to the server LLM gate so we don't mistakenly
  // join words — e.g. "graphics expert" must NOT become "…sex…".)
  if (BLOCKED_SUBSTRINGS.some((s) => text.includes(s))) return "blocked";
  if (BLOCKED_PATTERNS.some((re) => re.test(text))) return "blocked";
  return "ok";
}
