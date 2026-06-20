"use client";

/**
 * Bookmarkable journey page (spec §bookmarkable): /journey/[slug] where the slug
 * is the non-personal `career_board_stream_class` cache key — never a name or any
 * personal data. Visiting loads that journey from the cache (verified default or
 * newest candidate). If nothing is cached (e.g. a candidate was discarded), we
 * show a friendly "being refreshed" message and offer to regenerate it live.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  fetchJourneyBySlug,
  profileFromSlug,
  requestJourneyStream,
  storeJourney,
} from "@/lib/generate/client";
import { modelDisplayName } from "@/lib/generate/modelLabel";
import type { JourneyStatus } from "@/lib/generate/types";
import type { Journey } from "@/lib/types";
import { JourneyView } from "@/components/journey/JourneyView";
import GeneratingChat from "@/components/intake/GeneratingChat";

type Served = { journey: Journey; status: JourneyStatus };
type Phase = "loading" | "ready" | "missing" | "regenerating";

export default function BookmarkedJourneyPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const router = useRouter();
  const { t, locale } = useI18n();

  const [phase, setPhase] = useState<Phase>("loading");
  const [served, setServed] = useState<Served | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // Bumped per attempt so the chat screen remounts fresh (timer + steps) on retry.
  const [attempt, setAttempt] = useState(0);

  // The plan's language rides in ?lang= so a shared link reopens in its own
  // language; fall back to the visitor's UI locale. Read on the client only.
  const lang =
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("lang")) ||
    locale;

  // Load the cached journey on mount (and whenever the slug/lang changes).
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // Reset to the loading state whenever the slug/lang changes before refetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("loading");
    fetchJourneyBySlug(slug, lang).then((result) => {
      if (cancelled) return;
      if (result) {
        setServed({ journey: result.journey, status: result.status });
        setPhase("ready");
      } else {
        setPhase("missing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  // Live regeneration for an evicted bookmark: rebuild the minimal profile from
  // the slug and stream a fresh plan, then render it in place.
  async function regenerate() {
    const profile = profileFromSlug(slug, lang, new Date().toISOString().slice(0, 10));
    if (!profile) {
      setGenError(t("journey.notFound.badLink"));
      return;
    }
    setGenError(null);
    setModelLabel(null);
    setPhase("regenerating");
    setAttempt((n) => n + 1);
    try {
      const payload = await requestJourneyStream(profile, (event) => {
        if (event.model) setModelLabel(modelDisplayName(event.provider, event.model));
      });
      storeJourney(payload);
      setServed({ journey: payload.journey, status: payload.status });
      setPhase("ready");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : t("journey.notFound.error"));
    }
  }

  if (phase === "ready" && served) {
    return <JourneyView journey={served.journey} status={served.status} />;
  }

  if (phase === "regenerating") {
    return (
      <GeneratingChat
        key={attempt}
        modelLabel={modelLabel}
        error={genError}
        onRetry={regenerate}
        onStartOver={() => router.push("/intake")}
      />
    );
  }

  if (phase === "missing") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <div aria-hidden className="text-4xl">🧭</div>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">
            {t("journey.notFound.title")}
          </h1>
          <p className="mt-3 text-stone-600">{t("journey.notFound.body")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={regenerate}
              className="flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-6 text-base font-semibold text-white hover:bg-orange-600"
            >
              {t("journey.notFound.regenerate")}
            </button>
            <Link
              href="/intake"
              className="flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-6 text-base font-medium text-stone-700 hover:bg-stone-100"
            >
              {t("journey.notFound.startOver")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading.
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div
        aria-hidden
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500"
      />
      <p className="mt-4 text-stone-500">{t("journey.notFound.loading")}</p>
    </div>
  );
}
