/**
 * scripts/promote.ts — mark reviewed candidates as VERIFIED + PINNED (spec §4).
 *
 * After you've eyeballed a seeded candidate and the content looks good, promote
 * it: this copies the newest candidate to the verified default path (served to
 * everyone) and records it in the pinned registry (journeys/pinned.json) so it's
 * exempt from staleness churn and never live-regenerated.
 *
 *   npm run promote -- ca_cbse_commerce-maths_class12
 *   npm run promote -- doctor_cbse_pcb_class11 engineer_cbse_pcm_class12
 *   npm run promote -- ca_cbse_commerce-maths_class12 --lang hi
 *
 * A "slug" is the `career_board_stream_class` token shown by the seed script
 * (and used in journey URLs). `--lang` defaults to "en"; en/hi promote
 * independently. This is the only script that writes the trusted verified path —
 * it's an explicit, human-gated action, never automatic.
 */

import {
  readLatestCandidate,
  writeVerified,
  markPinned,
} from "@/lib/generate/store";
import { cacheFileName, slugToCacheKey, isValidSlug } from "@/lib/generate/cacheKey";

interface Options {
  slugs: string[];
  lang: string;
}

function parseArgs(argv: string[]): Options {
  const slugs: string[] = [];
  let lang = "en";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--lang" || arg.startsWith("--lang=")) {
      lang = (arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i]) || lang;
    } else if (arg.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
    } else {
      slugs.push(arg);
    }
  }
  return { slugs, lang };
}

async function main() {
  const { slugs, lang } = parseArgs(process.argv.slice(2));

  if (slugs.length === 0) {
    console.error(
      "Usage: npm run promote -- <slug> [<slug> ...] [--lang en]\n" +
        "  e.g. npm run promote -- ca_cbse_commerce-maths_class12",
    );
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  let promoted = 0;
  let failed = 0;

  for (const slug of slugs) {
    if (!isValidSlug(slug)) {
      failed++;
      console.error(`✗ ${slug}: not a valid career_board_stream_class slug — skipping.`);
      continue;
    }

    // cacheFileName takes a pipe-delimited key; the slug is that key with "_".
    const fileName = cacheFileName(slugToCacheKey(slug), lang);
    const candidate = await readLatestCandidate(fileName);
    if (!candidate) {
      failed++;
      console.error(
        `✗ ${slug} [${lang}]: no candidate found in journeys/candidates/ — generate it first (npm run seed).`,
      );
      continue;
    }

    const written = await writeVerified(fileName, candidate);
    await markPinned({ slug, language: lang, verifiedAt: today });
    promoted++;
    console.log(`✓ ${slug} [${lang}] → ${written}  (verified + pinned)`);
  }

  console.log(`\nPromoted ${promoted}, failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
