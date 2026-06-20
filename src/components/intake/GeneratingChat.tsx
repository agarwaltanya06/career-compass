"use client";

/**
 * Chatbot-style loading screen shown while /api/generate runs (intake "finish").
 *
 * It's deliberately *honest* about progress: an animated typing indicator, a
 * rotating sequence of real status messages, an elapsed-time counter (never a
 * fake "time remaining"), and a badge naming the actual LLM the server picked —
 * which arrives live over the stream, so it updates if the backend falls back.
 *
 * On error it freezes the timer and shows a friendly bubble with retry / restart.
 */

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** How long (ms) each rotating status message stays before the next appears. */
const STEP_INTERVAL_MS = 6000;

/** mm:ss for the elapsed counter. */
function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function GeneratingChat({
  modelLabel,
  profile,
  error,
  onRetry,
  onStartOver,
}: {
  /** Friendly name of the LLM in use, or null until the server reports it. */
  modelLabel: string | null;
  /** Short human labels of what the student picked (e.g. ["Class 9", "CBSE",
   *  "Architecture"]), shown as chips so they can see what's being worked on. */
  profile?: string[];
  /** A user-friendly error message, or null while still working. */
  error: string | null;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  const { t, tList } = useI18n();
  const steps = tList("intake.generatingChat.steps");

  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  // Recorded in an effect (not during render — Date.now is impure). Callers
  // remount this component per attempt (via `key`), so it starts fresh each time.
  const startedAt = useRef<number | null>(null);

  // Tick the elapsed counter every second; stop once an error lands.
  useEffect(() => {
    if (error) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const id = setInterval(() => {
      if (startedAt.current !== null) setElapsed(Date.now() - startedAt.current);
    }, 1000);
    return () => clearInterval(id);
  }, [error]);

  // Reveal the next status bubble on a fixed cadence, capping at the last one
  // ("Almost ready…") — we never loop, so it reads as steady forward progress.
  useEffect(() => {
    if (error) return;
    if (step >= steps.length - 1) return;
    const id = setTimeout(() => setStep((s) => s + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [step, steps.length, error]);

  const visibleSteps = steps.slice(0, step + 1);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {/* Header: assistant identity + live model badge + elapsed time */}
        <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-lg"
          >
            🧭
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">
              {t("intake.generatingChat.assistant")}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${
                  error ? "bg-rose-400" : "bg-emerald-400 animate-pulse"
                }`}
              />
              {modelLabel
                ? `${t("intake.generatingChat.modelPrefix")} ${modelLabel}`
                : t("intake.generatingChat.connecting")}
            </p>
          </div>
          {!error && (
            <span
              className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-stone-500 ring-1 ring-stone-200"
              aria-live="off"
            >
              ⏱ {formatElapsed(elapsed)}
            </span>
          )}
        </div>

        {/* What the student picked — so they can see what we're working on. */}
        {profile && profile.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-stone-100 px-4 py-3">
            {profile.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800 ring-1 ring-orange-100"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Chat body: status bubbles appear one by one. */}
        <div className="space-y-3 px-4 py-5" aria-live="polite">
          {visibleSteps.map((message, i) => (
            <Bubble key={i}>{message}</Bubble>
          ))}

          {error ? (
            <div className="rounded-2xl rounded-tl-sm border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-800">
                {t("intake.generatingChat.errorTitle")}
              </p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
            </div>
          ) : (
            <TypingIndicator />
          )}
        </div>

        {/* Footer actions — only on error (otherwise the work is in flight). */}
        {error && (
          <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-4 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-orange-500 px-6 text-base font-semibold text-white hover:bg-orange-600"
            >
              {t("intake.generatingChat.retry")}
            </button>
            <button
              type="button"
              onClick={onStartOver}
              className="min-h-11 rounded-xl border border-stone-300 px-6 text-base font-medium text-stone-700 hover:bg-stone-100"
            >
              {t("intake.generatingChat.startOver")}
            </button>
          </div>
        )}
      </div>

      {/* Subtle reassurance; intentionally NOT an ETA. */}
      {!error && (
        <p className="mt-3 text-center text-xs text-stone-400">
          {t("intake.generatingChat.footnote")}
        </p>
      )}
    </div>
  );
}

/** An assistant chat bubble. */
function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-orange-50 px-4 py-2.5 text-sm text-stone-800">
      {children}
    </div>
  );
}

/** Three bouncing dots — the "assistant is typing" affordance. */
function TypingIndicator() {
  return (
    <div
      className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-3"
      role="status"
      aria-label="Working"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="h-2 w-2 animate-bounce rounded-full bg-stone-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
