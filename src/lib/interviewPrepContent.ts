/**
 * Body content for the /interview-prep page (§6), from interview-prep.md.
 *
 * Section headings live in messages/* (read via i18n, so they can be translated
 * later); the longer English body — the question bank, the stage tips, and the
 * practice links — lives here as structured data the page renders. Keeping prose
 * out of the JSX keeps the page readable and the content easy to edit.
 */

/** One common question and a short, scannable answer. */
export interface InterviewQA {
  /** The question as an interviewer would ask it. */
  q: string;
  /** The core advice. */
  a: string;
  /** Optional one-line example answer, shown in quotes/italics. */
  eg?: string;
  /** Optional closing caveat (e.g. "Never say …"). */
  note?: string;
}

export const QUESTIONS: InterviewQA[] = [
  {
    q: "“Tell me about yourself.”",
    a: "Keep it under a minute: your class/course → one or two interests → why you want this role.",
  },
  {
    q: "“What are your strengths?”",
    a: "Pick one, add proof.",
    eg: "I'm reliable — I managed our event budget and kept it on track.",
  },
  {
    q: "“What is your weakness?”",
    a: "Name a real, fixable one, plus what you're doing about it.",
    eg: "I get nervous presenting, so I now volunteer to speak in class.",
    note: "Never say “I have none.”",
  },
  {
    q: "“Why do you want this internship/job?”",
    a: "Connect it to learning.",
    eg: "I want real experience in this field, not just from books.",
  },
  {
    q: "“Where do you see yourself in a few years?”",
    a: "Show direction, not a perfect plan.",
    eg: "Growing my skills and taking on more responsibility.",
  },
  {
    q: "“Tell me about a problem you faced.”",
    a: "Use the 3 steps. Small and real is fine.",
  },
  {
    q: "“Tell me about a mistake you made.”",
    a: "Be honest, then say what you learned. Owning it calmly looks good.",
  },
  {
    q: "“How do you handle pressure or deadlines?”",
    a: "Give your real method.",
    eg: "I make a list and do the most important thing first.",
  },
  {
    q: "“What do you know about us?”",
    a: "This is why you research the company for 10 minutes before the interview.",
  },
  {
    q: "“Do you have any questions for us?”",
    a: "Always say yes.",
    eg: "What would I do day to day?” or “What will I learn here?",
    note: "Never say “no questions.”",
  },
];

/** Practical tips grouped by stage. `id` keys each stage heading in messages. */
export interface InterviewTipGroup {
  id: "before" | "during" | "after";
  tips: string[];
}

export const TIP_GROUPS: InterviewTipGroup[] = [
  {
    id: "before",
    tips: [
      "Research the company — 10 minutes is enough.",
      "Practise answers out loud (with a friend or a mirror).",
      "Carry a clean CV and any marksheets.",
      "Reach 10–15 minutes early; test the video link beforehand.",
    ],
  },
  {
    id: "during",
    tips: [
      "Greet politely, sit up, make eye contact.",
      "Listen fully. Pausing to think is fine.",
      "Don't understand? Ask them to repeat.",
      "Be honest: “I haven't done that yet, but I'd like to learn.” Never make things up.",
      "English is hard? Speak slowly, or ask if you can answer in Hindi.",
    ],
  },
  {
    id: "after",
    tips: ["Thank them before leaving, or send a short thank-you message."],
  },
];

/** A free practice resource (external link). */
export interface PracticeLink {
  label: string;
  url: string;
}

export const PRACTICE_LINKS: PracticeLink[] = [
  {
    label: "How to answer “Tell me about yourself” (YouTube)",
    url: "https://www.youtube.com/results?search_query=tell+me+about+yourself+interview+answer+for+freshers",
  },
  {
    label: "Common interview questions for freshers (YouTube)",
    url: "https://www.youtube.com/results?search_query=fresher+interview+questions+and+answers",
  },
  {
    label: "Internshala interview prep guides",
    url: "https://internshala.com/blog/category/interview-tips/",
  },
];
