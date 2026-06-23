/**
 * CV / résumé templates for the /cv-templates page (§6). These are deliberately
 * plain, one-page layouts aimed at students and first-time job seekers — the
 * kind who have little or no work history and no money for a paid service.
 *
 * The page uses this module two ways, both entirely in the browser (no network):
 *   • Blank templates — a fill-in-yourself document the student downloads as an
 *     editable Word (.doc) file or a plain-text (.txt) file. The blank document
 *     is a real CV skeleton: section headings and labelled blanks only — it does
 *     NOT print the template's marketing name ("First internship CV") or any
 *     how-to tips, because those would end up inside the CV the student submits.
 *   • Quickly make my CV — a form whose typed values flow into a finished CV,
 *     downloadable as Word (to keep editing) or printed/saved as PDF (to send).
 *     Empty boxes are simply left out, so the result reads like a real CV.
 *
 * Sections come in three shapes (`kind`): the "details" header, the "about"
 * paragraph, and repeatable "entries" (education, experience, projects, skills).
 * An entry can be several fields that get joined onto ONE line in the finished CV
 * — e.g. school + result render as "St. Xavier's — 82%", not two bullets — and
 * the form lets the student add as many entries as they need.
 */

import { htmlEscape } from "./timelineExport";

/** A single labelled blank a student fills in. */
export interface CvField {
  label: string;
  /** Plain-language example, e.g. "e.g. 98xxxxxx" — a placeholder, never CV text. */
  hint?: string;
}

/** Config for a repeatable "entries" section. */
export interface CvEntryConfig {
  /** How many entry slots the form shows before the student taps "+". */
  initial: number;
  /** Joins a multi-field entry into one CV line, e.g. " — " → "School — 82%". */
  joiner: string;
  /** Label for the "add another" button. */
  addLabel: string;
}

/**
 * A résumé section. `kind` drives how a *filled* CV renders it:
 *   • "details" — the header block; the first field is the name (shown large),
 *     the rest become a single contact line.
 *   • "about"   — a short prose paragraph.
 *   • "entries" — a repeatable list. `fields` describes ONE entry; the finished
 *     CV joins each entry's filled fields with `entry.joiner` onto one line.
 */
export interface CvSection {
  heading: string;
  note?: string;
  kind: "details" | "about" | "entries";
  fields: CvField[];
  /** Required when kind === "entries". */
  entry?: CvEntryConfig;
}

export interface CvTemplate {
  /** Stable id; also used for the download filename and i18n lookups. */
  id: string;
  /** Fallback display name (the page prefers the translated name). */
  name: string;
  sections: CvSection[];
}

/** Values typed into the "Quickly make my CV" form, keyed by {@link entryFieldKey}. */
export type CvValues = Record<string, string>;

/** Stable key for section `si`, entry `ei`, field `fi`. */
export function entryFieldKey(si: number, ei: number, fi: number): string {
  return `s${si}e${ei}f${fi}`;
}

/** Convenience key for non-repeating sections (details/about live at entry 0). */
export function fieldKey(si: number, fi: number): string {
  return entryFieldKey(si, 0, fi);
}

/** Upper bound on entries read back from `values` when building a finished CV. */
const MAX_ENTRIES = 50;

// A no-experience student CV: leans entirely on education, projects and
// activities, because that is all most school students have to show.
const NO_EXPERIENCE: CvTemplate = {
  id: "student-no-experience",
  name: "Student CV — no work experience",
  sections: [
    {
      heading: "Your details",
      kind: "details",
      fields: [
        { label: "Full name" },
        { label: "Phone number", hint: "e.g. 98xxxxxxxx" },
        { label: "Email", hint: "Keep it simple — firstname.lastname@…" },
        { label: "City / town" },
      ],
    },
    {
      heading: "About me",
      kind: "about",
      note: "Two short lines: what you're studying and what you're looking for.",
      fields: [{ label: "About me" }],
    },
    {
      heading: "Education",
      kind: "entries",
      note: "Most recent first. Add your marks or grade if you're proud of them.",
      entry: { initial: 2, joiner: " — ", addLabel: "Add another qualification" },
      fields: [
        { label: "School / college, course", hint: "e.g. Govt. Sr. Sec. School — Class 12 (Science)" },
        { label: "Year & result", hint: "e.g. 2026 · 82%" },
      ],
    },
    {
      heading: "Projects & activities",
      kind: "entries",
      note: "No job needed — class projects, clubs, sports, helping at home or a shop all count.",
      entry: { initial: 3, joiner: " — ", addLabel: "Add another" },
      fields: [{ label: "Something you did", hint: "One line: what it was and what you did" }],
    },
    {
      heading: "Skills",
      kind: "entries",
      note: "Languages you speak, plus any computer or practical skills.",
      entry: { initial: 3, joiner: " — ", addLabel: "Add another skill" },
      fields: [{ label: "Skill or language", hint: "e.g. Hindi & English, MS Word, Tally, drawing" }],
    },
  ],
};

// A first-internship CV: adds an Experience block for any work, volunteering or
// freelance task, and a sharper About-me you can tailor per application.
const FIRST_INTERNSHIP: CvTemplate = {
  id: "first-internship",
  name: "First internship CV",
  sections: [
    {
      heading: "Your details",
      kind: "details",
      fields: [
        { label: "Full name" },
        { label: "Phone number", hint: "e.g. 98xxxxxxxx" },
        { label: "Email" },
        { label: "City / town" },
        { label: "Link (optional)", hint: "LinkedIn, portfolio or GitHub" },
      ],
    },
    {
      heading: "About me",
      kind: "about",
      note: "Two lines: what you study and the internship you want. Change this for each company.",
      fields: [{ label: "About me" }],
    },
    {
      heading: "Education",
      kind: "entries",
      note: "Latest first.",
      entry: { initial: 2, joiner: " — ", addLabel: "Add another qualification" },
      fields: [
        { label: "Course & institution", hint: "e.g. B.Com, 2nd year — XYZ College" },
        { label: "Year & result", hint: "e.g. 2024–2027 · 7.8 CGPA" },
      ],
    },
    {
      heading: "Experience",
      kind: "entries",
      note: "Any work, volunteering or freelance task — even unpaid.",
      entry: { initial: 2, joiner: " — ", addLabel: "Add another" },
      fields: [
        { label: "Role / task, where", hint: "e.g. Volunteer, school book fair" },
        { label: "What you did & the result" },
      ],
    },
    {
      heading: "Projects",
      kind: "entries",
      note: "Course or personal work that shows your skills.",
      entry: { initial: 2, joiner: " — ", addLabel: "Add another project" },
      fields: [{ label: "Project — what it was and your part" }],
    },
    {
      heading: "Skills",
      kind: "entries",
      note: "Tools, software and languages.",
      entry: { initial: 3, joiner: " — ", addLabel: "Add another skill" },
      fields: [{ label: "Skill or language", hint: "e.g. Excel, Canva, Python (basic), Tamil" }],
    },
  ],
};

export const CV_TEMPLATES: CvTemplate[] = [NO_EXPERIENCE, FIRST_INTERNSHIP];

/** Look up a template by id. */
export function getCvTemplate(id: string): CvTemplate | undefined {
  return CV_TEMPLATES.find((t) => t.id === id);
}

// ---------------------------------------------------------------------------
// HTML document (used for both the Word .doc download and the Save-as-PDF print)
// ---------------------------------------------------------------------------

const esc = htmlEscape;

/**
 * Wrap the body in a standalone HTML document. The Office namespaces let Word
 * open the .doc cleanly; browsers ignore them, so the same string also feeds
 * the print/Save-as-PDF path.
 */
function cvShell(docTitle: string, inner: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(docTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Calibri, Roboto, Arial, "Noto Sans", sans-serif;
    color: #1c1917; margin: 0; padding: 32px 36px; line-height: 1.5; }
  header { border-bottom: 2px solid #1c1917; padding-bottom: 10px; margin-bottom: 6px; }
  h1 { font-size: 26px; letter-spacing: .01em; margin: 0; }
  .contact { color: #44403c; font-size: 12.5px; margin: 4px 0 0; }
  h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .06em; color: #b45309;
    margin: 18px 0 6px; border-bottom: 1px solid #e7e5e4; padding-bottom: 3px; }
  .about { margin: 2px 0 0; font-size: 13px; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  li { font-size: 13px; margin: 0 0 5px; }
  /* Blank-skeleton bits (only used by the downloadable blank template). */
  .note { color: #78716c; font-size: 11px; margin: 0 0 8px; }
  .field { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 0 0 9px; }
  .label { font-weight: 700; font-size: 12px; color: #44403c; flex: none; }
  .blank { flex: 1; min-width: 140px; border-bottom: 1px solid #b8b2ab; height: 16px; }
  .hint { width: 100%; color: #a8a29e; font-size: 11px; font-style: italic; padding-left: 2px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
${inner}
</body>
</html>`;
}

/** Collect the non-empty, joined lines of an "entries" section from `values`. */
function entryLines(sec: CvSection, si: number, values: CvValues): string[] {
  const joiner = sec.entry?.joiner ?? " — ";
  const lines: string[] = [];
  for (let ei = 0; ei < MAX_ENTRIES; ei++) {
    const parts = sec.fields
      .map((_, fi) => (values[entryFieldKey(si, ei, fi)] ?? "").trim())
      .filter((v) => v.length > 0);
    if (parts.length > 0) lines.push(parts.join(joiner));
  }
  return lines;
}

/** A finished CV built from typed values; empty fields and sections are dropped. */
function filledInnerHtml(template: CvTemplate, values: CvValues): string {
  const parts: string[] = [];

  template.sections.forEach((sec, si) => {
    if (sec.kind === "details") {
      const name = (values[entryFieldKey(si, 0, 0)] ?? "").trim() || "Your Name";
      const contact = sec.fields
        .slice(1)
        .map((_, i) => (values[entryFieldKey(si, 0, i + 1)] ?? "").trim())
        .filter((v) => v.length > 0);
      parts.push(`<header><h1>${esc(name)}</h1>${
        contact.length ? `<p class="contact">${contact.map(esc).join(" &nbsp;•&nbsp; ")}</p>` : ""
      }</header>`);
      return;
    }

    if (sec.kind === "about") {
      const about = (values[entryFieldKey(si, 0, 0)] ?? "").trim();
      if (about) parts.push(`<h2>${esc(sec.heading)}</h2><p class="about">${esc(about)}</p>`);
      return;
    }

    // entries
    const lines = entryLines(sec, si, values);
    if (lines.length === 0) return;
    parts.push(`<h2>${esc(sec.heading)}</h2>`);
    parts.push(`<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`);
  });

  return parts.join("\n");
}

/** A blank, fill-in CV skeleton: headings + labelled blanks, no title or tips. */
function blankInnerHtml(template: CvTemplate): string {
  const blankField = (f: CvField) => {
    const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
    return `<p class="field"><span class="label">${esc(f.label)}:</span><span class="blank"></span>${hint}</p>`;
  };

  return template.sections
    .map((sec) => {
      const note = sec.note ? `<p class="note">${esc(sec.note)}</p>` : "";
      // Entries sections get `initial` blank slots so there's room to write.
      const reps = sec.kind === "entries" ? sec.entry?.initial ?? 1 : 1;
      let body = "";
      for (let i = 0; i < reps; i++) body += sec.fields.map(blankField).join("");
      return `<h2>${esc(sec.heading)}</h2>${note}${body}`;
    })
    .join("\n");
}

/**
 * Build a standalone CV document as HTML.
 *   • blank=true  → a fill-in skeleton (for the editable template download).
 *   • blank=false → a finished CV from `values` (for "Quickly make my CV").
 * The same string is downloaded as Word (.doc) or sent to print for PDF.
 */
export function buildCvDocHtml(
  template: CvTemplate,
  values: CvValues,
  blank: boolean,
): string {
  if (blank) return cvShell("My CV", blankInnerHtml(template));
  const name = (values[fieldKey(0, 0)] ?? "").trim();
  return cvShell(name ? `${name} — CV` : "My CV", filledInnerHtml(template, values));
}

// ---------------------------------------------------------------------------
// Plain-text version (edits anywhere, even offline on a basic phone)
// ---------------------------------------------------------------------------

/** Build a plain-text, fill-in-the-blank version of a blank template. */
export function buildCvText(template: CvTemplate): string {
  const lines: string[] = [];
  const blankField = (f: CvField) => {
    const hint = f.hint ? `   <- ${f.hint}` : "";
    lines.push(`${f.label}: ______________________________${hint}`);
  };

  for (const sec of template.sections) {
    lines.push(sec.heading.toUpperCase());
    if (sec.note) lines.push(`(${sec.note})`);
    const reps = sec.kind === "entries" ? sec.entry?.initial ?? 1 : 1;
    for (let i = 0; i < reps; i++) {
      sec.fields.forEach(blankField);
      if (sec.kind === "entries" && reps > 1) lines.push("");
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
