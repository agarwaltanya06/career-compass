/**
 * GET /api/journey/[slug] — load a bookmarked journey from the cache.
 *
 * The slug is the non-personal `career_board_stream_class` cache key (no names,
 * no contact, no location — spec §bookmarkable). We serve a VERIFIED default if
 * one exists, else the newest UNVERIFIED CANDIDATE (still better than a dead
 * link), and 404 when nothing is cached so the client can offer to regenerate.
 *
 * Read-only: this never calls the model. Generation stays on POST /api/generate.
 */

import { NextResponse } from "next/server";
import {
  cacheFileName,
  isValidSlug,
  slugToCacheKey,
} from "@/lib/generate/cacheKey";
import { readVerified, readLatestCandidate } from "@/lib/generate/store";
import type { GenerateResponseBody } from "@/lib/generate/types";

// fs access requires the Node runtime; this route is always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Not a valid plan link." }, { status: 400 });
  }

  // Language rides in the query so a shared link reopens in the plan's own
  // language regardless of the visitor's cookie; default to English.
  const url = new URL(request.url);
  const locale = (url.searchParams.get("lang") || "en").toLowerCase();

  const cacheKey = slugToCacheKey(slug);
  const fileName = cacheFileName(cacheKey, locale);

  const verified = await readVerified(fileName);
  if (verified) {
    const body: GenerateResponseBody = { journey: verified, status: "verified", cacheKey };
    return NextResponse.json(body);
  }

  const candidate = await readLatestCandidate(fileName);
  if (candidate) {
    const body: GenerateResponseBody = { journey: candidate, status: "candidate", cacheKey };
    return NextResponse.json(body);
  }

  return NextResponse.json(
    { error: "This plan isn't cached yet." },
    { status: 404 },
  );
}
