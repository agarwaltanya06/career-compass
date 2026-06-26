"use client";

/**
 * CV / résumé templates (§6). A fully static, offline-friendly page with three
 * parts, none of which touch the network:
 *
 *   1. Quickly make my CV — fill a short form and download a finished CV with
 *      your details, as an editable Word file or a print/Save-as-PDF.
 *   2. Blank templates — download a clean, one-page fill-in template (Word or
 *      plain text) to complete in your own way.
 *   3. Free CV builders — a couple of reputable, genuinely-free online tools.
 *
 * Everything the student types is held in component state and turned into a
 * document in the browser (see lib/cvTemplates) — nothing is uploaded or saved.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { localize } from "@/lib/i18n/localized";
import {
  CV_TEMPLATES,
  buildCvDocHtml,
  buildCvText,
  entryFieldKey,
  fieldKey,
  type CvField,
  type CvSection,
  type CvTemplate,
  type CvValues,
} from "@/lib/cvTemplates";
import MachineTranslatedNote from "@/components/MachineTranslatedNote";
import {
  downloadTextFile,
  printHtmlDocument,
  safeFilename,
} from "@/lib/timelineExport";

const PREFIX = "static.cvTemplates";
// Word opens an HTML document served with this type; keeps the file editable.
const WORD_MIME = "application/msword";

// Reputable, genuinely-free builders. URLs/names aren't translated; the short
// "what it is" note is read from messages so it can be localised.
const BUILDERS: { name: string; url: string; noteKey: string }[] = [
  {
    name: "Google Docs — Resume templates",
    url: "https://docs.google.com/document/u/0/?ftv=1&tgif=d",
    noteKey: `${PREFIX}.builders.googleDocs`,
  },
  {
    name: "Canva — Free resume builder",
    url: "https://www.canva.com/resumes/templates/",
    noteKey: `${PREFIX}.builders.canva`,
  },
  {
    name: "FlowCV",
    url: "https://flowcv.com",
    noteKey: `${PREFIX}.builders.flowcv`,
  },
  {
    name: "Indeed Resume Builder",
    url: "https://www.indeed.com/create-resume",
    noteKey: `${PREFIX}.builders.indeed`,
  },
];

export default function CvTemplatesPage() {
  const { t, locale } = useI18n();

  // Translated display name, falling back to the name baked into the data.
  const nameOf = (tpl: CvTemplate) => t(`${PREFIX}.templates.${tpl.id}.name`);
  const fileBase = (tpl: CvTemplate) => safeFilename(nameOf(tpl)) || "cv-template";

  // "Quickly make my CV" — selected template + the values typed into each form.
  // Values are kept per template so switching templates never mixes answers up.
  const [selectedId, setSelectedId] = useState<string>(CV_TEMPLATES[0].id);
  const [byTemplate, setByTemplate] = useState<Record<string, CvValues>>({});
  const selected = CV_TEMPLATES.find((tpl) => tpl.id === selectedId) ?? CV_TEMPLATES[0];
  const values = byTemplate[selectedId] ?? {};

  const setField = (key: string, value: string) =>
    setByTemplate((prev) => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] ?? {}), [key]: value },
    }));

  // How many entry slots each repeatable section shows (grows via the "+").
  // Keyed by template+section so each template keeps its own count.
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const countKeyOf = (si: number) => `${selectedId}-${si}`;
  const entryCountOf = (sec: CvSection, si: number) =>
    entryCounts[countKeyOf(si)] ?? sec.entry?.initial ?? 1;
  const addEntry = (sec: CvSection, si: number) =>
    setEntryCounts((p) => ({ ...p, [countKeyOf(si)]: entryCountOf(sec, si) + 1 }));

  // One labelled input (or textarea). For single-field repeatable entries the
  // visible label is dropped (the heading already says it) but kept for a11y.
  const renderField = (
    si: number,
    ei: number,
    fi: number,
    field: CvField,
    opts?: { multiline?: boolean; hideLabel?: boolean },
  ) => {
    const key = entryFieldKey(si, ei, fi);
    const id = `${selectedId}-${key}`;
    const label = localize(field.label, locale);
    const hint = field.hint ? localize(field.hint, locale) : undefined;
    const className =
      "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200";
    return (
      <div key={key}>
        {!opts?.hideLabel && (
          <label htmlFor={id} className="block text-sm font-medium text-stone-700">
            {label}
          </label>
        )}
        {opts?.multiline ? (
          <textarea
            id={id}
            rows={2}
            value={values[key] ?? ""}
            placeholder={hint ?? ""}
            onChange={(e) => setField(key, e.target.value)}
            className={className}
          />
        ) : (
          <input
            id={id}
            type="text"
            value={values[key] ?? ""}
            placeholder={hint ?? label}
            aria-label={opts?.hideLabel ? label : undefined}
            onChange={(e) => setField(key, e.target.value)}
            className={`${className} min-h-11`}
          />
        )}
      </div>
    );
  };

  // Filename from the typed name, e.g. "asha-verma-cv.doc".
  const filledFileBase = () => {
    const typed = (values[fieldKey(0, 0)] ?? "").trim();
    return typed ? `${safeFilename(typed)}-cv` : "my-cv";
  };

  const handleMakeWord = () =>
    downloadTextFile(
      `${filledFileBase()}.doc`,
      WORD_MIME,
      buildCvDocHtml(selected, values, false),
    );
  const handleMakePdf = () =>
    printHtmlDocument(buildCvDocHtml(selected, values, false));

  // Blank-template downloads (no values, no title/tips baked in). The downloaded
  // CV is always English (the form UI above is Hindi) — see lib/cvTemplates.
  const handleBlankWord = (tpl: CvTemplate) =>
    downloadTextFile(`${fileBase(tpl)}.doc`, WORD_MIME, buildCvDocHtml(tpl, {}, true));
  const handleBlankText = (tpl: CvTemplate) =>
    downloadTextFile(`${fileBase(tpl)}.txt`, "text/plain", buildCvText(tpl));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <MachineTranslatedNote />
      <h1 className="text-3xl font-extrabold text-stone-900">{t(`${PREFIX}.title`)}</h1>
      <p className="mt-3 text-lg text-stone-600">{t(`${PREFIX}.intro`)}</p>

      {/* 1. Quickly make my CV ------------------------------------------------ */}
      <section className="mt-8 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">{t(`${PREFIX}.quickTitle`)}</h2>
        <p className="mt-1 text-stone-600">{t(`${PREFIX}.quickIntro`)}</p>

        {/* Template chooser */}
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-stone-700">
            {t(`${PREFIX}.quickPickLabel`)}
          </legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            {CV_TEMPLATES.map((tpl) => {
              const active = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(tpl.id)}
                  className={`min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                    active
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {nameOf(tpl)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* The form: details, an About paragraph, and repeatable entry lists. */}
        <div className="mt-5 space-y-6">
          {selected.sections.map((sec, si) => (
            <div key={`${selectedId}-${si}`}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
                {localize(sec.heading, locale)}
              </h3>
              {sec.note && <p className="mt-0.5 text-xs text-stone-500">{localize(sec.note, locale)}</p>}

              {sec.kind === "about" ? (
                renderField(si, 0, 0, sec.fields[0], { multiline: true })
              ) : sec.kind === "details" ? (
                <div className="mt-2 space-y-3">
                  {sec.fields.map((f, fi) => renderField(si, 0, fi, f))}
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  {Array.from({ length: entryCountOf(sec, si) }).map((_, ei) => (
                    <div
                      key={ei}
                      className={
                        sec.fields.length > 1
                          ? "space-y-2 rounded-lg border border-stone-200 p-3"
                          : ""
                      }
                    >
                      {sec.fields.map((f, fi) =>
                        renderField(si, ei, fi, f, { hideLabel: sec.fields.length === 1 }),
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addEntry(sec, si)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-amber-400 px-4 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <span aria-hidden className="text-base leading-none">＋</span>
                    {sec.entry ? localize(sec.entry.addLabel, locale) : "Add another"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleMakeWord}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
          >
            <span aria-hidden>⬇️</span>
            {t(`${PREFIX}.quickDownloadWord`)}
          </button>
          <button
            type="button"
            onClick={handleMakePdf}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-amber-300 bg-white px-5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
          >
            <span aria-hidden>🖨️</span>
            {t(`${PREFIX}.quickDownloadPdf`)}
          </button>
        </div>
        <p className="mt-3 text-xs text-stone-500">{t(`${PREFIX}.privacyNote`)}</p>
      </section>

      {/* 2. Blank templates -------------------------------------------------- */}
      <h2 className="mt-12 text-2xl font-bold text-stone-900">{t(`${PREFIX}.blankTitle`)}</h2>
      <p className="mt-1 text-stone-600">{t(`${PREFIX}.blankIntro`)}</p>

      <div className="mt-5 space-y-6">
        {CV_TEMPLATES.map((tpl) => (
          <section
            key={tpl.id}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-lg font-bold text-stone-900">{nameOf(tpl)}</h3>

            <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-amber-700">
              {t(`${PREFIX}.guideLabel`)}
            </p>
            <p className="mt-1 text-stone-700">{t(`${PREFIX}.templates.${tpl.id}.guide`)}</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleBlankWord(tpl)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-amber-300 bg-white px-5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
              >
                <span aria-hidden>⬇️</span>
                {t(`${PREFIX}.downloadWordLabel`)}
              </button>
              <button
                type="button"
                onClick={() => handleBlankText(tpl)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
              >
                <span aria-hidden>📄</span>
                {t(`${PREFIX}.downloadTxtLabel`)}
              </button>
            </div>
          </section>
        ))}
      </div>

      {/* 3. Free online builders --------------------------------------------- */}
      <section className="mt-10 rounded-2xl bg-amber-50 p-5">
        <h2 className="text-xl font-bold text-stone-900">{t(`${PREFIX}.buildersTitle`)}</h2>
        <p className="mt-1 text-stone-700">{t(`${PREFIX}.buildersIntro`)}</p>
        <ul className="mt-4 space-y-3">
          {BUILDERS.map((b) => (
            <li key={b.url}>
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
              >
                {b.name}
              </a>
              <span className="block text-sm text-stone-600">{t(b.noteKey)}</span>
            </li>
          ))}
        </ul>
        {/* Many "free" builders only charge at the download step — warn first. */}
        <p className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-sm text-amber-900">
          <span aria-hidden>⚠️ </span>
          {t(`${PREFIX}.buildersAvoid`)}
        </p>
      </section>
    </div>
  );
}
