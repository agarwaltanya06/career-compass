/**
 * Seed profiles for pre-generating (and caching) journeys.
 *
 * Each profile is the minimal intake the generation pipeline needs to build a
 * cache key (`career | board | stream | classBucket`, see
 * src/lib/generate/cacheKey.ts) and a prompt. All values are the intake *codes*
 * from src/lib/intake.ts — not display labels — so a seeded run lands on the same
 * cache key a real user would hit.
 *
 * Coverage: classes 10, 11 and 12 only (Class 9 is intentionally skipped), board
 * CBSE, language English. Each career is paired with the stream a student on that
 * track would realistically have taken. Class 10 students haven't picked a stream
 * yet, so they use `none` (the same sentinel cacheKey.ts uses for an absent
 * stream); Class 11 and 12 use the aligned stream.
 *
 * To add Hindi later, append `'hi'` to `languages` — that one line fans every
 * career × class out into its Hindi variant too.
 */

/** Languages to seed. Add `'hi'` here to also seed every Hindi variant. */
const languages = ["en"] as const;

/** Board to seed. CBSE only for now. */
const BOARD = "cbse";

/**
 * Classes to seed. Class 9 is deliberately excluded; Class 10 has no stream yet
 * (`none`), Class 11 and 12 carry the career's aligned stream.
 */
const CLASSES = ["10", "11", "12"] as const;

/** Sentinel stream for a class that hasn't chosen one yet (matches cacheKey.ts). */
const NO_STREAM = "none";

/**
 * Each career mapped to the stream a student aiming for it would have taken in
 * Class 11/12. Career and stream values are intake codes (src/lib/intake.ts):
 *   - "Commerce" → `commerce-maths` (intake has no bare "commerce"; CA and
 *     banking/finance both assume Maths).
 *   - "Banking/Finance" → `govt-job` (its label is "Government job (SSC / banking)",
 *     the only banking/finance slug in the intake).
 *   - "Humanities" → `arts`.
 */
const CAREER_STREAMS: ReadonlyArray<{ career: string; stream: string }> = [
  { career: "doctor", stream: "pcb" }, // Doctor → PCB
  { career: "engineer", stream: "pcm" }, // Engineer → PCM
  { career: "ca", stream: "commerce-maths" }, // CA → Commerce
  { career: "law", stream: "arts" }, // Lawyer → Humanities
  { career: "civil-services", stream: "arts" }, // Civil Services (UPSC) → Humanities
  { career: "nursing", stream: "pcb" }, // Nursing → PCB
  { career: "architecture", stream: "pcm" }, // Architect → PCM
  { career: "govt-job", stream: "commerce-maths" }, // Banking/Finance → Commerce
];

/** One profile to seed. All fields are intake codes, ready for the cache key. */
export interface SeedProfile {
  career: string;
  board: string;
  stream: string;
  class: string;
  language: string;
}

/**
 * The full cartesian seed list: every language × career × class. Class 10 gets
 * `none` for stream; Class 11/12 get the career's aligned stream.
 */
export const seedProfiles: SeedProfile[] = languages.flatMap((language) =>
  CAREER_STREAMS.flatMap(({ career, stream }) =>
    CLASSES.map((klass) => ({
      career,
      board: BOARD,
      stream: klass === "10" ? NO_STREAM : stream,
      class: klass,
      language,
    })),
  ),
);

export default seedProfiles;
