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
    rest: " make a simple CV and a free LinkedIn profile. Some internships are open to you too!",
  },
  {
    lead: "Finished Class 12 / ITI / diploma / graduation:",
    rest: " every option below is open to you, including government schemes.",
  },
];

export const INTERNSHIP_LINKS: JobLink[] = [
  { name: "Internshala", url: "https://internshala.com", desc: "India's most popular site for student internships and fresher jobs" },
  { name: "LinkedIn", url: "https://linkedin.com", desc: "jobs, plus a free profile that works like an online CV" },
  { name: "Naukri", url: "https://www.naukri.com", desc: "big job site — use the “fresher” filter" },
  { name: "Indeed", url: "https://in.indeed.com", desc: "search lots of companies at once" },
];

export const GOVERNMENT_LINKS: JobLink[] = [
  { name: "National Career Service", url: "https://www.ncs.gov.in", desc: "government site: jobs and free career help" },
  {
    name: "PM Internship Scheme",
    url: "https://pminternship.mca.gov.in",
    desc: "paid internships at big companies (mostly after school or college)",
    note: "Use only this official site. Check it for the latest rules.",
  },
  { name: "Apprenticeships — NAPS", url: "https://www.apprenticeshipindia.gov.in", desc: "earn while you learn — good for ITI, diploma or degree" },
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
  { text: "Make accounts on Internshala and LinkedIn. Fill in the whole profile." },
  { text: "Use filters to search — your city, “fresher” or “internship”, your field." },
  { text: "Apply to many, not just one. No reply doesn't mean you failed — keep going!" },
  { text: "Add a short note if you can — 2–3 honest lines on why you want the job." },
  { text: "Track where and when you applied." },
  { text: "Prepare for the interview", see: { label: "Interview Prep", href: "/interview-prep" } },
];

export const SCAM_RULES: LeadLine[] = [
  {
    lead: "Don't pay to get a job.",
    rest: " A “registration fee”, “deposit”, or “₹X for a sure job” is a scam. Real employers pay you. Government schemes are free.",
  },
  {
    lead: "Don't share",
    rest: " your bank password, OTP, or full bank details.",
  },
  {
    lead: "Sounds too good to be true?",
    rest: " Big pay for little work, or an offer with no interview — that's usually fake.",
  },
  {
    lead: "Check the web address",
    rest: " — real government sites end in .gov.in or .nic.in. Type it yourself instead of trusting forwarded links.",
  },
  {
    lead: "Not sure?",
    rest: " Slow down and ask a teacher or someone you trust. A real chance will still be there tomorrow.",
  },
];
