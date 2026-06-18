"use client";

/** Filterable cards for exams and colleges, with the verify-first tagging. */

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { College, Exam } from "@/lib/types";
import { CostBadge, OfficialLink, VerifyTag } from "./badges";

/** One labelled row inside a card. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}

export function ExamCard({ exam }: { exam: Exam }) {
  const { t } = useI18n();
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-slate-900">{exam.name}</h4>
        <CostBadge band={exam.costBand} />
      </div>
      <dl>
        <Field label={t("journey.purpose")} value={exam.purpose} />
        <Field label={t("journey.eligibility")} value={exam.eligibility} />
        {/* typicalWindow is soft language — never a hard date — and unverified, */}
        {/* so it carries the verify tag. */}
        <div className="mt-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("journey.typicalWindow")}
          </dt>
          <dd className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
            {exam.typicalWindow}
            {!exam.verified && <VerifyTag />}
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <OfficialLink url={exam.officialUrl} />
      </div>
    </article>
  );
}

export function CollegeCard({ college }: { college: College }) {
  const { t } = useI18n();
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-slate-900">{college.name}</h4>
        <CostBadge band={college.costBand} />
      </div>
      <dl>
        <Field label={t("journey.collegeType")} value={college.type} />
        <Field label={t("journey.location")} value={college.location} />
        {/* Fees are an unverified specific → show the verify tag + the hedge. */}
        <div className="mt-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("journey.approxFees")}
          </dt>
          <dd className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
            {college.approxAnnualFees}
            {!college.verified && <VerifyTag />}
          </dd>
          <p className="mt-0.5 text-xs text-slate-400">{college.feesNote}</p>
        </div>
        <Field label={t("journey.entranceRequired")} value={college.entranceRequired} />
      </dl>
      <div className="mt-3">
        <OfficialLink url={college.officialUrl} />
      </div>
    </article>
  );
}
