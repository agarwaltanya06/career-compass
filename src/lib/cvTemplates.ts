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
import { localize, type LangText } from "./i18n/localized";

/**
 * Resolve a {@link LangText} to its English string. The downloadable CV always
 * uses English (headings, labels, hints) even when the form UI is in Hindi —
 * see filledInnerHtml for why. The on-screen form localises these separately.
 */
const enText = (value: LangText) => localize(value, "en");

/** A single labelled blank a student fills in. */
export interface CvField {
  label: LangText;
  /** Plain-language example, e.g. "e.g. 98xxxxxx" — a placeholder, never CV text. */
  hint?: LangText;
}

/** Config for a repeatable "entries" section. */
export interface CvEntryConfig {
  /** How many entry slots the form shows before the student taps "+". */
  initial: number;
  /** Joins a multi-field entry into one CV line, e.g. " — " → "School — 82%". */
  joiner: string;
  /** Label for the "add another" button. */
  addLabel: LangText;
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
  heading: LangText;
  note?: LangText;
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
      heading: { en: "Your details", hi: "आपकी जानकारी" },
      kind: "details",
      fields: [
        { label: { en: "Full name", hi: "पूरा नाम" } },
        { label: { en: "Phone number", hi: "फ़ोन नंबर" }, hint: { en: "e.g. 98xxxxxxxx", hi: "जैसे 98xxxxxxxx" } },
        {
          label: { en: "Email", hi: "ईमेल" },
          hint: { en: "Keep it simple — firstname.lastname@…", hi: "आसान रखें — firstname.lastname@…" },
        },
        { label: { en: "City / town", hi: "शहर / कस्बा" } },
      ],
    },
    {
      heading: { en: "About me", hi: "मेरे बारे में" },
      kind: "about",
      note: {
        en: "Two short lines: what you're studying and what you're looking for.",
        hi: "दो छोटी लाइनें: आप क्या पढ़ रहे हैं और क्या ढूँढ रहे हैं।",
      },
      fields: [{ label: { en: "About me", hi: "मेरे बारे में" } }],
    },
    {
      heading: { en: "Education", hi: "शिक्षा" },
      kind: "entries",
      note: {
        en: "Most recent first. Add your marks or grade if you're proud of them.",
        hi: "सबसे नया पहले। अगर मार्क्स या ग्रेड पर गर्व है तो उन्हें जोड़ें।",
      },
      entry: { initial: 2, joiner: " — ", addLabel: { en: "Add another qualification", hi: "एक और योग्यता जोड़ें" } },
      fields: [
        {
          label: { en: "School / college, course", hi: "स्कूल / कॉलेज, कोर्स" },
          hint: {
            en: "e.g. Govt. Sr. Sec. School — Class 12 (Science)",
            hi: "जैसे गवर्नमेंट सीनियर सेकेंडरी स्कूल — क्लास 12 (साइंस)",
          },
        },
        { label: { en: "Year & result", hi: "साल और नतीजा" }, hint: { en: "e.g. 2026 · 82%", hi: "जैसे 2026 · 82%" } },
      ],
    },
    {
      heading: { en: "Projects & activities", hi: "प्रोजेक्ट्स और एक्टिविटीज़" },
      kind: "entries",
      note: {
        en: "No job needed — class projects, clubs, sports, helping at home or a shop all count.",
        hi: "नौकरी की ज़रूरत नहीं — क्लास प्रोजेक्ट, क्लब, खेल, घर या दुकान पर मदद, सब मायने रखते हैं।",
      },
      entry: { initial: 3, joiner: " — ", addLabel: { en: "Add another", hi: "एक और जोड़ें" } },
      fields: [
        {
          label: { en: "Something you did", hi: "कुछ जो आपने किया" },
          hint: { en: "One line: what it was and what you did", hi: "एक लाइन: यह क्या था और आपने क्या किया" },
        },
      ],
    },
    {
      heading: { en: "Skills", hi: "स्किल्स" },
      kind: "entries",
      note: {
        en: "Languages you speak, plus any computer or practical skills.",
        hi: "जो भाषाएँ आप बोलते हैं, साथ ही कोई कंप्यूटर या प्रैक्टिकल स्किल्स।",
      },
      entry: { initial: 3, joiner: " — ", addLabel: { en: "Add another skill", hi: "एक और स्किल जोड़ें" } },
      fields: [
        {
          label: { en: "Skill or language", hi: "स्किल या भाषा" },
          hint: { en: "e.g. Hindi & English, MS Word, Tally, drawing", hi: "जैसे हिंदी और इंग्लिश, MS Word, Tally, ड्रॉइंग" },
        },
      ],
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
      heading: { en: "Your details", hi: "आपकी जानकारी" },
      kind: "details",
      fields: [
        { label: { en: "Full name", hi: "पूरा नाम" } },
        { label: { en: "Phone number", hi: "फ़ोन नंबर" }, hint: { en: "e.g. 98xxxxxxxx", hi: "जैसे 98xxxxxxxx" } },
        { label: { en: "Email", hi: "ईमेल" } },
        { label: { en: "City / town", hi: "शहर / कस्बा" } },
        {
          label: { en: "Link (optional)", hi: "लिंक (ज़रूरी नहीं)" },
          hint: { en: "LinkedIn, portfolio or GitHub", hi: "LinkedIn, पोर्टफोलियो या GitHub" },
        },
      ],
    },
    {
      heading: { en: "About me", hi: "मेरे बारे में" },
      kind: "about",
      note: {
        en: "Two lines: what you study and the internship you want. Change this for each company.",
        hi: "दो लाइनें: आप क्या पढ़ते हैं और कौन सी इंटर्नशिप चाहते हैं। हर कंपनी के लिए इसे बदलें।",
      },
      fields: [{ label: { en: "About me", hi: "मेरे बारे में" } }],
    },
    {
      heading: { en: "Education", hi: "शिक्षा" },
      kind: "entries",
      note: { en: "Latest first.", hi: "सबसे नया पहले।" },
      entry: { initial: 2, joiner: " — ", addLabel: { en: "Add another qualification", hi: "एक और योग्यता जोड़ें" } },
      fields: [
        {
          label: { en: "Course & institution", hi: "कोर्स और संस्थान" },
          hint: { en: "e.g. B.Com, 2nd year — XYZ College", hi: "जैसे बी.कॉम, दूसरा साल — XYZ कॉलेज" },
        },
        {
          label: { en: "Year & result", hi: "साल और नतीजा" },
          hint: { en: "e.g. 2024–2027 · 7.8 CGPA", hi: "जैसे 2024–2027 · 7.8 CGPA" },
        },
      ],
    },
    {
      heading: { en: "Experience", hi: "अनुभव" },
      kind: "entries",
      note: {
        en: "Any work, volunteering or freelance task — even unpaid.",
        hi: "कोई भी काम, वॉलंटियरिंग या फ्रीलांस टास्क — भले ही बिना पैसे का हो।",
      },
      entry: { initial: 2, joiner: " — ", addLabel: { en: "Add another", hi: "एक और जोड़ें" } },
      fields: [
        {
          label: { en: "Role / task, where", hi: "रोल / काम, कहाँ" },
          hint: { en: "e.g. Volunteer, school book fair", hi: "जैसे वॉलंटियर, स्कूल बुक फेयर" },
        },
        { label: { en: "What you did & the result", hi: "आपने क्या किया और नतीजा" } },
      ],
    },
    {
      heading: { en: "Projects", hi: "प्रोजेक्ट्स" },
      kind: "entries",
      note: {
        en: "Course or personal work that shows your skills.",
        hi: "कोर्स या पर्सनल काम जो आपकी स्किल्स दिखाए।",
      },
      entry: { initial: 2, joiner: " — ", addLabel: { en: "Add another project", hi: "एक और प्रोजेक्ट जोड़ें" } },
      fields: [{ label: { en: "Project — what it was and your part", hi: "प्रोजेक्ट — यह क्या था और आपका हिस्सा" } }],
    },
    {
      heading: { en: "Skills", hi: "स्किल्स" },
      kind: "entries",
      note: { en: "Tools, software and languages.", hi: "टूल्स, सॉफ़्टवेयर और भाषाएँ।" },
      entry: { initial: 3, joiner: " — ", addLabel: { en: "Add another skill", hi: "एक और स्किल जोड़ें" } },
      fields: [
        {
          label: { en: "Skill or language", hi: "स्किल या भाषा" },
          hint: { en: "e.g. Excel, Canva, Python (basic), Tamil", hi: "जैसे Excel, Canva, Python (बेसिक), तमिल" },
        },
      ],
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

    // Hindi guidance, English output: the form is localised to help the student
    // fill it in, but the downloaded CV always uses English headings/structure —
    // Indian employers expect English CVs, and a Hindi-headed one could count
    // against the student. So the document builders always resolve English.
    const heading = enText(sec.heading);

    if (sec.kind === "about") {
      const about = (values[entryFieldKey(si, 0, 0)] ?? "").trim();
      if (about) parts.push(`<h2>${esc(heading)}</h2><p class="about">${esc(about)}</p>`);
      return;
    }

    // entries
    const lines = entryLines(sec, si, values);
    if (lines.length === 0) return;
    parts.push(`<h2>${esc(heading)}</h2>`);
    parts.push(`<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`);
  });

  return parts.join("\n");
}

/**
 * A blank, fill-in CV skeleton: headings + labelled blanks, no title or tips.
 * English-only (see filledInnerHtml): the blank template *is* the CV the student
 * submits, so it keeps English headings/structure regardless of the UI language.
 */
function blankInnerHtml(template: CvTemplate): string {
  const blankField = (f: CvField) => {
    const hint = f.hint ? `<span class="hint">${esc(enText(f.hint))}</span>` : "";
    return `<p class="field"><span class="label">${esc(enText(f.label))}:</span><span class="blank"></span>${hint}</p>`;
  };

  return template.sections
    .map((sec) => {
      const note = sec.note ? `<p class="note">${esc(enText(sec.note))}</p>` : "";
      // Entries sections get `initial` blank slots so there's room to write.
      const reps = sec.kind === "entries" ? sec.entry?.initial ?? 1 : 1;
      let body = "";
      for (let i = 0; i < reps; i++) body += sec.fields.map(blankField).join("");
      return `<h2>${esc(enText(sec.heading))}</h2>${note}${body}`;
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

/** Build a plain-text, fill-in-the-blank version of a blank template (English). */
export function buildCvText(template: CvTemplate): string {
  const lines: string[] = [];
  const blankField = (f: CvField) => {
    const hint = f.hint ? `   <- ${enText(f.hint)}` : "";
    lines.push(`${enText(f.label)}: ______________________________${hint}`);
  };

  for (const sec of template.sections) {
    lines.push(enText(sec.heading).toUpperCase());
    if (sec.note) lines.push(`(${enText(sec.note)})`);
    const reps = sec.kind === "entries" ? sec.entry?.initial ?? 1 : 1;
    for (let i = 0; i < reps; i++) {
      sec.fields.forEach(blankField);
      if (sec.kind === "entries" && reps > 1) lines.push("");
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
