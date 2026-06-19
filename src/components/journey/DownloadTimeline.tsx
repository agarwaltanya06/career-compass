"use client";

/**
 * The "Download timeline" controls shown under each route's timeline: export the
 * dated steps as an `.ics` calendar (capped to the next two years, every event
 * flagged "approximate — verify") or as a printable / Save-as-PDF document
 * (the full plan). All work happens client-side — see lib/timelineExport.ts.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { JourneyStep } from "@/lib/types";
import { buildTimelineRows, computeTargetPeriod } from "@/lib/timeline";
import {
  buildTimelineIcs,
  buildTimelinePrintHtml,
  downloadTextFile,
  printHtmlDocument,
  safeFilename,
  type ExportContext,
  type ExportLabels,
  type PrintStep,
} from "@/lib/timelineExport";

export default function DownloadTimeline({
  steps,
  anchor,
  career,
  routeName,
  routeId,
  disclaimers,
}: {
  steps: JourneyStep[];
  anchor: string;
  career: string;
  routeName: string;
  routeId: string;
  disclaimers: string[];
}) {
  const { t } = useI18n();

  const labels: ExportLabels = {
    approxNote: t("download.approxNote"),
    optional: t("journey.stepOptional"),
    eitherOr: t("journey.stepEitherOr"),
    cappedNote: t("download.calendarCappedNote"),
    generatedBy: t("download.generatedBy"),
  };
  const ctx: ExportContext = { career, routeName, routeId };

  const handleIcs = () => {
    const { ics } = buildTimelineIcs(steps, anchor, ctx, labels);
    downloadTextFile(
      `${safeFilename(`${career}-${routeName}`)}.ics`,
      "text/calendar",
      ics,
    );
  };

  const handlePrint = () => {
    // Flatten the timeline rows into ordered print steps, tagging fork members so
    // the printout mirrors the on-screen either/or branching.
    const printSteps: PrintStep[] = [];
    for (const row of buildTimelineRows(steps)) {
      const isFork = row.length > 1;
      row.forEach((step, i) => {
        const p = computeTargetPeriod(anchor, step.offsetMonths);
        printSteps.push({
          period: t(`journey.season.${p.season}`, { year: p.year }),
          title: step.title,
          type: step.type,
          description: step.description,
          optional: Boolean(step.optional),
          forkStart: isFork && i === 0,
          forkMember: isFork && i > 0,
        });
      });
    }

    const html = buildTimelinePrintHtml(printSteps, ctx, labels, disclaimers, {
      forCareer: t("journey.forCareer"),
      timeline: t("journey.timeline"),
      important: t("journey.disclaimers"),
    });
    printHtmlDocument(html);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {t("download.heading")}
      </span>
      <DownloadButton onClick={handleIcs} icon="📅">
        {t("download.ics")}
      </DownloadButton>
      <DownloadButton onClick={handlePrint} icon="🖨️">
        {t("download.print")}
      </DownloadButton>
    </div>
  );
}

/** A small, outline action button matching the journey view's aesthetic. */
function DownloadButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-orange-300 bg-white px-3 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50"
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
