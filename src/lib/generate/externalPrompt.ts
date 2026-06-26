/**
 * A friendly, plain-language prompt a student can paste into Google's AI Mode or
 * any free AI chatbot to get a career plan, with their career / class / board
 * already filled in. Used in two places:
 *   - the both-providers-failed fallback (so a busy free tier never dead-ends —
 *     the user can still generate a plan elsewhere, for free);
 *   - a "copy this plan's prompt" action on a successful journey, so the student
 *     can regenerate or extend it in another tool.
 *
 * Unlike the internal SYSTEM_PROMPT (which demands strict JSON for our renderer),
 * this asks for a human-readable roadmap in prose — it's for a different tool and
 * a different reader. Kept dependency-free so it runs on both server and client.
 */

/** Inputs for the prompt — codes (intake values) or already-display text both work. */
export interface ExternalPromptInput {
  /** Career goal — a display name ("Chartered Accountant") or a known slug ("ca"). */
  career: string;
  /** Class code ("9".."12" | "passed12" | "college" | "gap") or free text. */
  classCode?: string;
  /** Board code ("cbse"…) or display text. Optional. */
  board?: string;
  /** Stream code ("commerce-maths"…) or display text. Optional. */
  stream?: string;
  /** Plan language, e.g. "en" | "hi". */
  locale?: string;
}

// Minimal label maps so coded intake values read naturally. These intentionally
// duplicate a subset of prompt.ts rather than import it: that module also exports
// the large SYSTEM_PROMPT, and we don't want it bundled into the client.
const CLASS_LABELS: Record<string, string> = {
  "9": "in Class 9",
  "10": "in Class 10",
  "11": "in Class 11",
  "12": "in Class 12",
  passed12: "done with Class 12",
  college: "in college",
  gap: "on a gap year",
};
const BOARD_LABELS: Record<string, string> = {
  cbse: "CBSE",
  icse: "ICSE / ISC",
  state: "a State board",
  nios: "NIOS / Open schooling",
  other: "another board",
};
const STREAM_LABELS: Record<string, string> = {
  pcm: "Science (PCM)",
  pcb: "Science (PCB)",
  pcmb: "Science (PCMB)",
  "commerce-maths": "Commerce with Maths",
  "commerce-no-maths": "Commerce without Maths",
  arts: "Arts / Humanities",
  vocational: "Vocational",
  "not-chosen": "not chosen yet",
};
const CAREER_LABELS: Record<string, string> = {
  architecture: "Architect",
  "cabin-crew": "Cabin crew member",
  ca: "Chartered Accountant (CA)",
  "civil-services": "Civil servant (UPSC)",
  defence: "Defence officer (NDA / forces)",
  design: "Designer (graphic / UX)",
  doctor: "Doctor (MBBS)",
  engineer: "Engineer",
  "fashion-design": "Fashion designer",
  "govt-job": "Government job (SSC / banking)",
  hospitality: "Hospitality / hotel management professional",
  "iti-polytechnic": "ITI / polytechnic tradesperson",
  journalism: "Journalist",
  law: "Lawyer",
  "merchant-navy": "Merchant navy officer",
  nursing: "Nurse",
  paramedical: "Paramedical / allied-health professional",
  pharmacy: "Pharmacist",
  teaching: "Teacher",
  "social-work": "Social worker",
};

function labelFor(map: Record<string, string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!v) return undefined;
  return map[v] ?? v;
}

/**
 * Build the copyable, plain-language prompt. Career/class/board/stream are filled
 * in when known; everything is framed for India and keeps our verify-on-official-
 * sites safety stance. For a non-English locale it asks for a reply in that
 * language (Hindi / Marathi / Gujarati).
 */
export function buildExternalPrompt(input: ExternalPromptInput): string {
  const career = labelFor(CAREER_LABELS, input.career) ?? input.career.trim();
  const classLine = labelFor(CLASS_LABELS, input.classCode);
  const board = labelFor(BOARD_LABELS, input.board);
  const stream = labelFor(STREAM_LABELS, input.stream);
  // Ask the chatbot to reply in the chosen Indian language (English needs no
  // instruction). Keep the native-script name so the model gets it right.
  const REPLY_LANGUAGES: Record<string, string> = {
    hi: "Hindi (हिन्दी)",
    mr: "Marathi (मराठी)",
    gu: "Gujarati (ગુજરાતી)",
  };
  const localeCode = (input.locale ?? "en").toLowerCase().slice(0, 2);
  const replyLanguage = REPLY_LANGUAGES[localeCode];

  const lines: (string | null)[] = [
    `I'm a student in India and I want to become a ${career}.`,
    classLine ? `I'm currently ${classLine}.` : null,
    board ? `My school board is ${board}.` : null,
    stream && stream !== "not chosen yet" ? `My stream is ${stream}.` : null,
    ``,
    `Please give me a clear, step-by-step roadmap to become a ${career} in India. Cover:`,
    `1. The main routes/pathways from where I am now.`,
    `2. The entrance exams or qualifications I need, and roughly when each one usually happens in the year.`,
    `3. Government and private colleges or institutes worth considering, with rough yearly fees.`,
    `4. Skills to build along the way, and free resources to learn them.`,
    `5. A realistic month-by-month or year-by-year timeline.`,
    `6. What to do if I miss a deadline or don't clear an exam the first time.`,
    ``,
    `Keep everything specific to India. For any exam date, fee, or eligibility rule, remind me to confirm it on the official website, since these change every year. Only give official website links you are sure about — please don't invent any.`,
    replyLanguage ? `Please reply in ${replyLanguage}.` : null,
  ];

  return lines.filter((l): l is string => l !== null).join("\n");
}
