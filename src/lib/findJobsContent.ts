/**
 * Body content for the /find-jobs page (§6), from find-jobs.md.
 *
 * Section headings live in messages/* (via i18n, for later translation); the
 * link lists, apply steps and scam-safety rules live here as structured data the
 * page renders. Prose fields are {en, hi} pairs (see lib/i18n/localized); URLs
 * and brand names aren't translated.
 */

import type { LangText } from "./i18n/localized";

/** A link to a job/portal, with a short plain-language description. */
export interface JobLink {
  name: string;
  url: string;
  /** One-line "what it is". */
  desc?: LangText;
  /** Optional caution rendered distinctly (e.g. the official PM Internship site). */
  note?: LangText;
}

/** "In school" / "finished school" guidance — a bold lead plus the rest. */
export interface LeadLine {
  lead: LangText;
  rest: LangText;
}

export const AUDIENCE: LeadLine[] = [
  {
    lead: { en: "In school (Class 9–12):", hi: "स्कूल में (क्लास 9–12):" },
    rest: {
      en: " make a simple CV and a free LinkedIn profile. Some internships are open to you too!",
      hi: " एक आसान CV और एक मुफ़्त LinkedIn प्रोफाइल बनाएँ। कुछ इंटर्नशिप आपके लिए भी खुली हैं!",
    },
  },
  {
    lead: {
      en: "Finished Class 12 / ITI / diploma / graduation:",
      hi: "क्लास 12 / ITI / डिप्लोमा / ग्रेजुएशन पूरा कर लिया:",
    },
    rest: {
      en: " every option below is open to you, including government schemes.",
      hi: " नीचे का हर विकल्प आपके लिए खुला है, सरकारी योजनाओं समेत।",
    },
  },
];

export const INTERNSHIP_LINKS: JobLink[] = [
  {
    name: "Internshala",
    url: "https://internshala.com",
    desc: {
      en: "India's most popular site for student internships and fresher jobs",
      hi: "स्टूडेंट इंटर्नशिप और फ्रेशर जॉब्स के लिए भारत की सबसे मशहूर साइट",
    },
  },
  {
    name: "LinkedIn",
    url: "https://linkedin.com",
    desc: {
      en: "jobs, plus a free profile that works like an online CV",
      hi: "नौकरियाँ, साथ ही एक मुफ़्त प्रोफाइल जो ऑनलाइन CV की तरह काम करती है",
    },
  },
  {
    name: "Naukri",
    url: "https://www.naukri.com",
    desc: {
      en: "big job site — use the “fresher” filter",
      hi: "बड़ी जॉब साइट — “fresher” फ़िल्टर का इस्तेमाल करें",
    },
  },
  {
    name: "Indeed",
    url: "https://in.indeed.com",
    desc: {
      en: "search lots of companies at once",
      hi: "एक साथ कई कंपनियों में सर्च करें",
    },
  },
];

export const GOVERNMENT_LINKS: JobLink[] = [
  {
    name: "National Career Service",
    url: "https://www.ncs.gov.in",
    desc: {
      en: "government site: jobs and free career help",
      hi: "सरकारी साइट: नौकरियाँ और मुफ़्त करियर मदद",
    },
  },
  {
    name: "PM Internship Scheme",
    url: "https://pminternship.mca.gov.in",
    desc: {
      en: "paid internships at big companies (mostly after school or college)",
      hi: "बड़ी कंपनियों में पेड इंटर्नशिप (ज़्यादातर स्कूल या कॉलेज के बाद)",
    },
    note: {
      en: "Use only this official site. Check it for the latest rules.",
      hi: "सिर्फ़ इसी ऑफिशियल साइट का इस्तेमाल करें। ताज़ा नियम यहीं चेक करें।",
    },
  },
  {
    name: "Apprenticeships — NAPS",
    url: "https://www.apprenticeshipindia.gov.in",
    desc: {
      en: "earn while you learn — good for ITI, diploma or degree",
      hi: "सीखते हुए कमाएँ — ITI, डिप्लोमा या डिग्री वालों के लिए अच्छा",
    },
  },
];

/** Government-jobs portals (rendered inline, separated by · ). */
export const SARKARI_PORTALS: JobLink[] = [
  { name: "National Career Service", url: "https://www.ncs.gov.in" },
  { name: "Employment News", url: "https://www.employmentnews.gov.in" },
];

/** Exam bodies for government jobs; `desc` is the short tag in brackets. */
export const SARKARI_EXAMS: JobLink[] = [
  { name: "SSC", url: "https://ssc.gov.in", desc: { en: "staff posts", hi: "स्टाफ़ पद" } },
  { name: "RRB", url: "https://www.rrbcdg.gov.in", desc: { en: "railways", hi: "रेलवे" } },
  { name: "IBPS", url: "https://www.ibps.in", desc: { en: "banking", hi: "बैंकिंग" } },
];

/** One step of "how to apply". Some steps point to another page on the site. */
export interface ApplyStep {
  text: LangText;
  /** Optional internal cross-reference, e.g. the CV Templates page. */
  see?: { label: LangText; href: string };
}

export const APPLY_STEPS: ApplyStep[] = [
  {
    text: { en: "Make a CV", hi: "एक CV बनाएँ" },
    see: { label: { en: "CV Templates page", hi: "CV टेम्प्लेट्स पेज" }, href: "/cv-templates" },
  },
  {
    text: {
      en: "Make accounts on Internshala and LinkedIn. Fill in the whole profile.",
      hi: "Internshala और LinkedIn पर अकाउंट बनाएँ। पूरी प्रोफाइल भरें।",
    },
  },
  {
    text: {
      en: "Use filters to search — your city, “fresher” or “internship”, your field.",
      hi: "सर्च के लिए फ़िल्टर इस्तेमाल करें — अपना शहर, “fresher” या “internship”, अपनी फ़ील्ड।",
    },
  },
  {
    text: {
      en: "Apply to many, not just one. No reply doesn't mean you failed — keep going!",
      hi: "सिर्फ़ एक नहीं, कई जगह अप्लाई करें। जवाब न आना नाकामी नहीं है — लगे रहें!",
    },
  },
  {
    text: {
      en: "Add a short note if you can — 2–3 honest lines on why you want the job.",
      hi: "हो सके तो एक छोटा नोट जोड़ें — 2–3 ईमानदार लाइनें कि आप यह नौकरी क्यों चाहते हैं।",
    },
  },
  {
    text: {
      en: "Track where and when you applied.",
      hi: "कहाँ और कब अप्लाई किया, इसका हिसाब रखें।",
    },
  },
  {
    text: { en: "Prepare for the interview", hi: "इंटरव्यू की तैयारी करें" },
    see: { label: { en: "Interview Prep", hi: "इंटरव्यू की तैयारी" }, href: "/interview-prep" },
  },
];

export const SCAM_RULES: LeadLine[] = [
  {
    lead: { en: "Don't pay to get a job.", hi: "नौकरी पाने के लिए पैसे न दें।" },
    rest: {
      en: " A “registration fee”, “deposit”, or “₹X for a sure job” is a scam. Real employers pay you. Government schemes are free.",
      hi: " “रजिस्ट्रेशन फीस”, “डिपॉजिट”, या “पक्की नौकरी के लिए ₹X” एक धोखा है। असली कंपनियाँ आपको पैसे देती हैं। सरकारी योजनाएँ मुफ़्त हैं।",
    },
  },
  {
    lead: { en: "Don't share", hi: "शेयर न करें" },
    rest: {
      en: " your bank password, OTP, or full bank details.",
      hi: " अपना बैंक पासवर्ड, OTP, या पूरी बैंक डिटेल्स।",
    },
  },
  {
    lead: { en: "Sounds too good to be true?", hi: "हद से ज़्यादा अच्छा लग रहा है?" },
    rest: {
      en: " Big pay for little work, or an offer with no interview — that's usually fake.",
      hi: " थोड़े काम में बड़ी सैलरी, या बिना इंटरव्यू के ऑफर — यह आमतौर पर फ़र्ज़ी होता है।",
    },
  },
  {
    lead: { en: "Check the web address", hi: "वेब एड्रेस चेक करें" },
    rest: {
      en: " — real government sites end in .gov.in or .nic.in. Type it yourself instead of trusting forwarded links.",
      hi: " — असली सरकारी साइट्स .gov.in या .nic.in पर खत्म होती हैं। फ़ॉरवर्ड किए लिंक पर भरोसा करने के बजाय इसे ख़ुद टाइप करें।",
    },
  },
  {
    lead: { en: "Not sure?", hi: "पक्का नहीं है?" },
    rest: {
      en: " Slow down and ask a teacher or someone you trust. A real chance will still be there tomorrow.",
      hi: " रुकें और किसी टीचर या भरोसेमंद इंसान से पूछें। असली मौका कल भी रहेगा।",
    },
  },
];
