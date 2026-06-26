"use client";

/**
 * The adaptive intake flow (spec §1): one question at a time, every answer a
 * tap, with branching. Questions are defined as data in lib/intake.ts; this
 * component just walks the *visible* subset (branching hides e.g. the stream
 * question for class 9/10) and collects answers.
 *
 * On finish we show a summary + the branch lead, then link to the journey view.
 * (The journey itself is a hard-coded sample for now — no LLM call yet.)
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  visibleQuestions,
  branchLead,
  intakeQuestions,
  type IntakeAnswers,
  type IntakeOption,
  type IntakeQuestion,
} from "@/lib/intake";
import {
  GenerationFailedError,
  isExplore,
  profileFromAnswers,
  requestJourneyStream,
  storeJourney,
} from "@/lib/generate/client";
import { modelDisplayName } from "@/lib/generate/modelLabel";
import {
  CAREER_INPUT_MAX,
  classifyCareerInput,
  type CareerInputVerdict,
} from "@/lib/inputSafety";
import GeneratingChat from "@/components/intake/GeneratingChat";
import SafetyNotice from "@/components/intake/SafetyNotice";

export default function IntakePage() {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  // Result of the free-text career safety check (null = nothing to show). Set
  // when the user tries to advance with an unsafe/over-length goal; cleared as
  // soon as they edit the field or move on.
  const [safety, setSafety] = useState<Exclude<CareerInputVerdict, "ok"> | null>(null);

  // Recomputed every render so branching changes (e.g. skipping stream) are
  // always reflected in the question order and the progress count.
  const visible = visibleQuestions(answers);
  const question = visible[Math.min(step, visible.length - 1)];

  /** Move forward, or finish if this was the last visible question. */
  function advance(updated: IntakeAnswers) {
    const nextVisible = visibleQuestions(updated);
    if (step + 1 >= nextVisible.length) {
      setFinished(true);
    } else {
      setStep(step + 1);
    }
  }

  function goBack() {
    setSafety(null);
    if (finished) {
      setFinished(false);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }

  /** Tap a tappable option. Plain options advance instantly; ones with a */
  /* follow-up (or when a custom field exists) wait for the Continue button.  */
  function selectOption(q: IntakeQuestion, opt: IntakeOption) {
    const updated: IntakeAnswers = { ...answers, [q.field]: opt.value };
    // Picking an option clears any free-text the user had typed.
    if (q.customField) updated[q.customField] = "";
    setSafety(null);
    setAnswers(updated);
    if (!opt.followUp) {
      advance(updated);
    }
  }

  function setFollowUp(field: keyof IntakeAnswers, value: string) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  function setCustom(q: IntakeQuestion, value: string) {
    if (!q.customField) return;
    // Editing the free-text answer clears any prior safety message and
    // deselects the option chips.
    setSafety(null);
    setAnswers((a) => ({ ...a, [q.customField!]: value, [q.field]: "" }));
  }

  /**
   * Advance from the current question, but gate the free-text career field
   * through the safety filter first (spec: enforced before Next / any model
   * call). The goal question is the only path to generation, so checking here
   * means an unsafe career can never reach the model.
   */
  function handleContinue() {
    if (question.customField === "goalCustom" && customValue.trim().length > 0) {
      if (customValue.length > CAREER_INPUT_MAX) return; // button is disabled anyway
      const verdict = classifyCareerInput(customValue);
      if (verdict !== "ok") {
        setSafety(verdict);
        return;
      }
    }
    setSafety(null);
    advance(answers);
  }

  function restart() {
    setSafety(null);
    setAnswers({});
    setStep(0);
    setFinished(false);
  }

  if (finished) {
    return <IntakeSummary answers={answers} onRestart={restart} onBack={goBack} />;
  }

  // The option the user has currently selected for this question (if any).
  const selectedOption = question.options.find(
    (o) => o.value === answers[question.field]
  );
  const followUp = selectedOption?.followUp;
  const followUpValue = followUp ? (answers[followUp.field] ?? "") : "";
  const customValue = question.customField
    ? (answers[question.customField] ?? "")
    : "";

  // The free-text career field is hard-capped; over the cap, Continue is locked.
  const isCareerField = question.customField === "goalCustom";
  const overLimit = isCareerField && customValue.length > CAREER_INPUT_MAX;

  // When do we need an explicit Continue button (vs. auto-advance on tap)?
  const needsContinue = Boolean(followUp) || customValue.length > 0;
  const canContinue = followUp
    ? followUpValue.trim().length > 0
    : customValue.trim().length > 0 && !overLimit;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-stone-500">
          <span>{t("intake.title")}</span>
          <span>
            {t("intake.progress", { current: step + 1, total: visible.length })}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${((step + 1) / visible.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h1 className="text-2xl font-bold text-stone-900">
        {t(question.promptKey)}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((opt) => {
          const selected = answers[question.field] === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectOption(question, opt)}
              aria-pressed={selected}
              className={`min-h-12 rounded-xl border px-4 py-3 text-left text-base font-medium transition-colors ${
                selected
                  ? "border-orange-500 bg-orange-50 text-orange-800 ring-2 ring-orange-200"
                  : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
              } ${opt.isExplore ? "sm:col-span-2" : ""}`}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Follow-up text input revealed by an option (e.g. which state/city). */}
      {followUp && (
        <input
          type="text"
          autoFocus
          value={followUpValue}
          onChange={(e) => setFollowUp(followUp.field, e.target.value)}
          placeholder={t(followUp.placeholderKey)}
          className="mt-4 min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
      )}

      {/* Free-text "type your own" for questions that allow it (e.g. goal). */}
      {question.customField && (
        <div className="mt-4">
          <div className="mb-2 text-center text-xs uppercase tracking-wide text-stone-400">
            {t("common.typeYourOwn")}
          </div>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustom(question, e.target.value)}
            placeholder={t("intake.placeholders.typeGoal")}
            maxLength={isCareerField ? CAREER_INPUT_MAX : undefined}
            aria-invalid={safety !== null}
            className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          {isCareerField && customValue.length >= CAREER_INPUT_MAX - 10 && (
            <p className="mt-1 text-right text-xs text-stone-400">
              {customValue.length}/{CAREER_INPUT_MAX}
            </p>
          )}

          {/* Heuristic gate result: a neutral nudge, or a calm helpline message. */}
          {safety && (
            <div className="mt-3">
              <SafetyNotice kind={safety} />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="min-h-11 rounded-lg px-4 text-base font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        >
          ← {t("common.back")}
        </button>

        {needsContinue && (
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="min-h-11 rounded-xl bg-orange-500 px-6 text-base font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {t("common.continue")} →
          </button>
        )}
      </div>
    </div>
  );
}

/** Final screen: how the plan will adapt + a recap of what we collected. */
function IntakeSummary({
  answers,
  onRestart,
  onBack,
}: {
  answers: IntakeAnswers;
  onRestart: () => void;
  onBack: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  // `generating` swaps the summary for the chat screen; `genError` is shown
  // inside that screen (with retry), while `error` covers the pre-generation
  // explore case shown on the summary itself.
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // When both providers are busy, the failure carries a copyable prompt the
  // student can paste into a free AI tool — surfaced on the chat error screen.
  const [genPrompt, setGenPrompt] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the server input-safety gate rejects the typed career. Shows the
  // calm SafetyNotice on the summary instead of the generic failure screen.
  const [safetyBlock, setSafetyBlock] = useState<"blocked" | "distress" | null>(null);
  // Bumped on each attempt so the chat screen remounts fresh (resets its
  // elapsed timer and status sequence) on a retry.
  const [attempt, setAttempt] = useState(0);

  const explore = isExplore(answers);

  // Holds the in-flight generation's controller so "Cancel" can abort it.
  const abortRef = useRef<AbortController | null>(null);

  // Kick off live generation, then hand the result to the journey page via
  // sessionStorage (spec §7 phase 6: intake "finish" calls /api/generate, not
  // the sample data). Streams progress so the chat screen can show the real
  // model and honest phases during the long grounded call.
  async function generate() {
    const currentDate = new Date().toISOString().slice(0, 10);
    const profile = profileFromAnswers(answers, locale, currentDate);
    if (!profile) {
      setError(t("intake.done.exploreNote"));
      return;
    }
    setError(null);
    setGenError(null);
    setGenPrompt(null);
    setSafetyBlock(null);
    setModelLabel(null);
    setGenerating(true);
    setAttempt((n) => n + 1);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const payload = await requestJourneyStream(
        profile,
        (event) => {
          if (event.model) setModelLabel(modelDisplayName(event.provider, event.model));
        },
        { signal: controller.signal },
      );
      storeJourney(payload);
      router.push("/journey");
    } catch (err) {
      // A user-initiated cancel surfaces as an AbortError — already handled by
      // cancelGenerate (which reset the screen), so don't show it as a failure.
      if (controller.signal.aborted) return;
      // Input-safety rejection: leave the generating screen and show the calm
      // SafetyNotice on the summary — not the generic "failed, retry" screen.
      if (err instanceof GenerationFailedError && err.safety) {
        setGenerating(false);
        setSafetyBlock(err.safety);
        return;
      }
      // Stay on the chat screen so the friendly error + retry live there.
      setGenError(err instanceof Error ? err.message : t("intake.done.generateError"));
      if (err instanceof GenerationFailedError && err.externalPrompt) {
        setGenPrompt(err.externalPrompt);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  // Abort an in-flight generation and return to the review screen.
  function cancelGenerate() {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setGenError(null);
    setGenPrompt(null);
  }

  // Turn a stored answer value back into a human label by finding the option
  // that defined it; fall back to the raw value (custom text, city names…).
  function labelFor(field: keyof IntakeAnswers, value?: string): string | null {
    if (!value) return null;
    for (const q of intakeQuestions) {
      const opt = q.options.find((o) => o.value === value);
      if (opt) return t(opt.labelKey);
    }
    return value;
  }

  const goalDisplay =
    answers.goalCustom || labelFor("goal", answers.goal) || null;

  // The student's key picks, shown as chips on the loading screen so they can
  // see what's being worked on (e.g. "Class 9", "CBSE", "Architecture").
  const profileChips = [
    labelFor("class", answers.class),
    labelFor("board", answers.board),
    labelFor("stream", answers.stream),
    goalDisplay,
  ].filter((v): v is string => Boolean(v));

  // Live generation (and its error state) takes over the whole screen as a
  // chatbot-style progress view.
  if (generating) {
    return (
      <GeneratingChat
        key={attempt}
        modelLabel={modelLabel}
        profile={profileChips}
        error={genError}
        externalPrompt={genPrompt}
        onRetry={generate}
        onStartOver={onRestart}
        onCancel={cancelGenerate}
      />
    );
  }

  // The input-safety gate rejected the typed career — take over the whole screen
  // with the calm SafetyNotice, NOT the celebratory "Your journey is ready"
  // summary (which would be misleading here).
  if (safetyBlock) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <SafetyNotice kind={safetyBlock} />
          {safetyBlock === "blocked" && (
            <p className="mt-3 text-sm text-stone-500">{t("intake.safety.editHint")}</p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-orange-500 px-6 text-base font-semibold text-white hover:bg-orange-600"
            >
              ← {t("common.back")}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="min-h-12 rounded-xl border border-stone-300 px-6 text-base font-medium text-stone-700 hover:bg-stone-100"
            >
              {t("intake.done.restart")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rows: { label: string; value: string | null }[] = [
    { label: t("intake.questions.class"), value: labelFor("class", answers.class) },
    { label: t("intake.questions.board"), value: labelFor("board", answers.board) },
    { label: t("intake.questions.stream"), value: labelFor("stream", answers.stream) },
    { label: t("intake.questions.goal"), value: goalDisplay },
    { label: t("intake.questions.language"), value: labelFor("language", answers.language) },
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div aria-hidden className="text-4xl">🎉</div>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">
          {t("intake.done.title")}
        </h1>

        {/* Branch lead — explains how the plan adapts to this profile. */}
        <p className="mt-3 text-stone-600">{t("intake.done.lead")}</p>
        <p className="mt-2 rounded-xl bg-orange-50 p-4 text-stone-800">
          {branchLead(answers)}
        </p>

        {/* Recap */}
        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {t("intake.done.profileHeading")}
        </h2>
        <dl className="mt-2 divide-y divide-stone-100">
          {rows
            .filter((r) => r.value)
            .map((r) => (
              <div key={r.label} className="flex justify-between gap-4 py-2">
                <dt className="text-stone-500">{r.label}</dt>
                <dd className="text-right font-medium text-stone-900">{r.value}</dd>
              </div>
            ))}
        </dl>

        <p className="mt-4 text-xs text-stone-400">{t("intake.done.sampleNote")}</p>

        {/* Exploration mode has no single journey to generate yet. */}
        {explore && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {t("intake.done.exploreNote")}{" "}
            <Link href="/plan-it-yourself" className="font-semibold underline">
              {t("footer.diy")}
            </Link>
          </p>
        )}

        {/* Generation error (server message or a generic fallback). */}
        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!explore && (
            <button
              type="button"
              onClick={generate}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-orange-500 px-6 text-base font-semibold text-white hover:bg-orange-600"
            >
              {error ? t("intake.done.retry") : t("intake.done.generate")}
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="min-h-12 rounded-xl border border-stone-300 px-6 text-base font-medium text-stone-700 hover:bg-stone-100"
          >
            {t("intake.done.restart")}
          </button>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 min-h-11 text-sm text-stone-500 hover:underline"
        >
          ← {t("common.back")}
        </button>
      </div>
    </div>
  );
}
