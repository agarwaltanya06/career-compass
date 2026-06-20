/**
 * File-based journey cache (spec §3 phase 3 / §4).
 *
 * Two states, the trust invariant:
 *   - VERIFIED defaults live at `journeys/<key>__<lang>.json` — human-reviewed,
 *     committed, served to everyone. Written only by a human approving a
 *     candidate; this code NEVER auto-overwrites them.
 *   - CANDIDATES live in `journeys/candidates/` — fresh, unreviewed machine
 *     generations. Each gets a timestamped filename so multiple candidates can
 *     sit alongside a verified default. The folder IS the review queue.
 *
 * Git is the audit trail (spec §7 phase 3). Move to a KV store only when miss
 * volume is high.
 */

import { promises as fs } from "fs";
import path from "path";
import type { Journey } from "@/lib/types";
import { parseJourney } from "@/lib/journeySchema";

const ROOT = path.join(process.cwd(), "journeys");
const CANDIDATES = path.join(ROOT, "candidates");
/**
 * The PINNED registry (spec §4). "Verified" is encoded by file *location* (a
 * journey at `journeys/<key>__<lang>.json` is verified); "pinned" — exempt from
 * staleness auto-churn and never live-regenerated — has no home in the Journey
 * schema (meta is sanitized on read), so it's tracked here, out of band. The
 * future serving/staleness layer consults this list; the promote script writes
 * it. Each entry also carries the "last verified" date §4 calls for.
 */
const PINNED = path.join(ROOT, "pinned.json");

/**
 * Read and validate a verified default for `fileName`. Returns null on a miss or
 * if the stored file is somehow malformed (we validate even our own data so a
 * bad commit can't crash the route).
 */
export async function readVerified(fileName: string): Promise<Journey | null> {
  try {
    const raw = await fs.readFile(path.join(ROOT, fileName), "utf8");
    return parseJourney(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Read the NEWEST candidate for `fileName` (the same `key__lang.json` shape
 * {@link readVerified} takes), or null if none validates. Candidates are stored
 * as `key__lang__<ISO-stamp>.json`, so a lexicographic sort puts the freshest
 * last. Used to serve a bookmarked journey whose verified default doesn't exist
 * yet — the most recent machine generation is still better than a dead link
 * (spec §bookmarkable). Falls through older candidates if the newest is corrupt.
 */
export async function readLatestCandidate(fileName: string): Promise<Journey | null> {
  const prefix = fileName.replace(/\.json$/, "") + "__";
  let entries: string[];
  try {
    entries = await fs.readdir(CANDIDATES);
  } catch {
    return null; // No candidates folder yet.
  }
  const matches = entries
    .filter((n) => n.startsWith(prefix) && n.endsWith(".json"))
    .sort();
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const raw = await fs.readFile(path.join(CANDIDATES, matches[i]), "utf8");
      const journey = parseJourney(JSON.parse(raw));
      if (journey) return journey;
    } catch {
      // Try the next-newest candidate.
    }
  }
  return null;
}

/**
 * Persist a fresh generation as an UNVERIFIED CANDIDATE for human review. Never
 * touches the verified path. Returns the repo-relative path written, for logging
 * (the path contains no secrets).
 */
export async function writeCandidate(
  fileName: string,
  journey: Journey,
): Promise<string> {
  await fs.mkdir(CANDIDATES, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = fileName.replace(/\.json$/, `__${stamp}.json`);
  const full = path.join(CANDIDATES, name);
  await fs.writeFile(full, JSON.stringify(journey, null, 2) + "\n", "utf8");
  return path.relative(process.cwd(), full);
}

/**
 * Promote a journey to the VERIFIED default path (`journeys/<fileName>`), the
 * human-reviewed copy served to everyone (spec §4). Unlike {@link writeCandidate}
 * this DOES write the trusted location, so it's only ever called by an explicit
 * human action (the promote script), never by the live route. Returns the
 * repo-relative path written.
 */
export async function writeVerified(
  fileName: string,
  journey: Journey,
): Promise<string> {
  await fs.mkdir(ROOT, { recursive: true });
  const full = path.join(ROOT, fileName);
  await fs.writeFile(full, JSON.stringify(journey, null, 2) + "\n", "utf8");
  return path.relative(process.cwd(), full);
}

/** One row of the pinned registry: a journey slug + language, with its review date. */
export interface PinnedEntry {
  /** The `career_board_stream_class` slug (cacheKeyToSlug of the cache key). */
  slug: string;
  /** Language code, e.g. "en" — en/hi of the same slug pin independently. */
  language: string;
  /** ISO date (YYYY-MM-DD) the journey was last verified. */
  verifiedAt: string;
}

/** Read the pinned registry (spec §4), or an empty list if it doesn't exist yet. */
export async function readPinned(): Promise<PinnedEntry[]> {
  try {
    const raw = await fs.readFile(PINNED, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as PinnedEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Add (or refresh) a pinned entry for `slug` + `language`, keeping the registry
 * sorted and free of duplicates. Idempotent: re-pinning just updates the date.
 */
export async function markPinned(entry: PinnedEntry): Promise<void> {
  const list = await readPinned();
  const next = list.filter(
    (e) => !(e.slug === entry.slug && e.language === entry.language),
  );
  next.push(entry);
  next.sort((a, b) =>
    a.slug === b.slug ? a.language.localeCompare(b.language) : a.slug.localeCompare(b.slug),
  );
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(PINNED, JSON.stringify(next, null, 2) + "\n", "utf8");
}
