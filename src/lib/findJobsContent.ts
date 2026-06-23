/**
 * Body content for the /find-jobs page (§6), from find-jobs.md.
 *
 * Section headings live in messages/* (via i18n, for later translation); the
 * link lists, apply steps and scam-safety rules live here as structured English
 * data the page renders. URLs and brand names aren't translated.
 */

/** A link to a job/portal, with a short plain-language description. */
export interface JobLink {
  name: string;
  url: string;
  /** One-line "what it is". */
  desc?: string;
  /** Optional caution rendered distinctly (e.g. the official PM Internship site). */
  note?: string;
}

/** "In school" / "finished school" guidance — a bold lead plus the rest. */
export interface LeadLine {
  lead: string;
  rest: string;
}

export const AUDIENCE: LeadLine[] = [
  {
    lead: "In school (Class 9–12):",
    rest: " start a simple CV and a free LinkedIn profile. Some internships are open to you.",
  },
  {
    lead: "Finished Class 12 / ITI / diploma / graduation:",
    rest: " all the options below are open, including government schemes.",
  },
];

export const INTERNSHIP_LINKS: JobLink[] = [
  { name: "Internshala", url: "https://internshala.com", desc: "most popular in India for student internships + fresher jobs" },
  { name: "LinkedIn", url: "https://linkedin.com", desc: "jobs + a free profile that works like an online CV" },
  { name: "Naukri", url: "https://www.naukri.com", desc: "large job site (use the “fresher” filter)" },
  { name: "Indeed", url: "https://in.indeed.com", desc: "search many companies at once" },
];

export const GOVERNMENT_LINKS: JobLink[] = [
  { name: "National Career Service", url: "https://www.ncs.gov.in", desc: "govt portal: jobs + free career counselling" },
  {
    name: "PM Internship Scheme",
    url: "https://pminternship.mca.gov.in",
    desc: "paid internships at big companies (mostly after school/college)",
    note: "Use only this official site. Check it for current rules.",
  },
  { name: "Apprenticeships — NAPS", url: "https://www.apprenticeshipindia.gov.in", desc: "“earn while you learn”, good for ITI/diploma/degree" },
];

/** Government-jobs portals (rendered inline, separated by · ). */
export const SARKARI_PORTALS: JobLink[] = [
  { name: "National Career Service", url: "https://www.ncs.gov.in" },
  { name: "Employment News", url: "https://www.employmentnews.gov.in" },
];

/** Exam bodies for government jobs; `desc` is the short tag in brackets. */
export const SARKARI_EXAMS: JobLink[] = [
  { name: "SSC", url: "https://ssc.gov.in", desc: "staff posts" },
  { name: "RRB", url: "https://www.rrbcdg.gov.in", desc: "railways" },
  { name: "IBPS", url: "https://www.ibps.in", desc: "banking" },
];

/** One step of "how to apply". Some steps point to another page on the site. */
export interface ApplyStep {
  text: string;
  /** Optional internal cross-reference, e.g. the CV Templates page. */
  see?: { label: string; href: string };
}

export const APPLY_STEPS: ApplyStep[] = [
  { text: "Make a CV", see: { label: "CV Templates page", href: "/cv-templates" } },
  { text: "Create accounts — start with Internshala + LinkedIn. Fill the profile fully." },
  { text: "Search with filters — location, “fresher” / “internship”, your field." },
  { text: "Apply to many, not just one. No reply ≠ failure. It's a numbers game." },
  { text: "Add a short message if allowed — 2–3 honest lines on why you're interested." },
  { text: "Track where and when you applied." },
  { text: "Prepare for the interview", see: { label: "Interview Prep", href: "/interview-prep" } },
];

export const SCAM_RULES: LeadLine[] = [
  {
    lead: "Never pay to get a job.",
    rest: " Any “registration fee”, “deposit”, or “₹X for a guaranteed job” = scam. Real employers pay you. Government schemes are free.",
  },
  {
    lead: "Never share",
    rest: " your bank password, OTP, or full bank details.",
  },
  {
    lead: "“Too good to be true” = fake",
    rest: " — huge pay for little work, instant offers with no interview.",
  },
  {
    lead: "Check the address",
    rest: " — real government sites end in .gov.in or .nic.in. Type it yourself; don't trust forwarded links.",
  },
  {
    lead: "Unsure?",
    rest: " Slow down, ask a teacher or trusted adult. A real opportunity will still be there tomorrow.",
  },
];
