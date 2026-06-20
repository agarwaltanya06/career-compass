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
