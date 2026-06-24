/**
 * Free learning resources for the /free-resources page (§6), from
 * free-resources.md.
 *
 * The markdown groups the same links under several "what it's for" headings;
 * here each unique resource is listed once and carries a set of `tags` instead,
 * so the page can offer tag-filter buttons (a resource that helps with both
 * board exams and JEE shows up under either filter). URLs/titles aren't
 * translated; the one-line `desc` is a {en, hi} pair (see lib/i18n/localized),
 * and tag *labels* are read from messages so the filters can be.
 */

import type { LangText } from "./i18n/localized";

/** Filterable need-tags. Order here is the order the filter buttons appear in. */
export const RESOURCE_TAGS = [
  "school",
  "boards",
  "jeeNeet",
  "college",
  "english",
  "digital",
] as const;

export type ResourceTag = (typeof RESOURCE_TAGS)[number];

export interface Resource {
  title: string;
  url: string;
  /** One-line "what it is" ({en, hi} so the list reads in either language). */
  desc: LangText;
  tags: ResourceTag[];
}

export const RESOURCES: Resource[] = [
  {
    title: "Khan Academy",
    url: "https://www.khanacademy.org",
    desc: {
      en: "Maths, science and more — free videos and practice.",
      hi: "मैथ्स, साइंस और बहुत कुछ — मुफ़्त वीडियो और प्रैक्टिस।",
    },
    tags: ["school", "boards", "jeeNeet"],
  },
  {
    title: "NCERT textbooks",
    url: "https://ncert.nic.in/textbook.php",
    desc: {
      en: "Official books, free to download — the base of most board exams.",
      hi: "ऑफिशियल किताबें, मुफ़्त डाउनलोड — ज़्यादातर बोर्ड एग्ज़ाम इन्हीं पर बनते हैं।",
    },
    tags: ["school", "boards"],
  },
  {
    title: "DIKSHA",
    url: "https://diksha.gov.in",
    desc: {
      en: "Government school app — many subjects and languages, matched to your board.",
      hi: "सरकारी स्कूल ऐप — कई विषय और भाषाएँ, आपके बोर्ड के हिसाब से।",
    },
    tags: ["school", "boards"],
  },
  {
    title: "e-PathShala",
    url: "https://epathshala.nic.in",
    desc: {
      en: "Free NCERT e-books and content.",
      hi: "मुफ़्त NCERT ई-बुक्स और कंटेंट।",
    },
    tags: ["school"],
  },
  {
    title: "Physics Wallah (free YouTube)",
    url: "https://www.youtube.com/@PhysicsWallah",
    desc: {
      en: "Popular free entrance-exam prep.",
      hi: "एंट्रेंस एग्ज़ाम की मशहूर मुफ़्त तैयारी।",
    },
    tags: ["jeeNeet"],
  },
  {
    title: "NEET official site",
    url: "https://neet.nta.nic.in",
    desc: {
      en: "Syllabus, past papers and exam info.",
      hi: "सिलेबस, पुराने पेपर और एग्ज़ाम की जानकारी।",
    },
    tags: ["jeeNeet"],
  },
  {
    title: "JEE Main official site",
    url: "https://jeemain.nta.nic.in",
    desc: {
      en: "Syllabus, dates and exam info.",
      hi: "सिलेबस, तारीखें और एग्ज़ाम की जानकारी।",
    },
    tags: ["jeeNeet"],
  },
  {
    title: "SWAYAM",
    url: "https://swayam.gov.in",
    desc: {
      en: "Free government online courses with certificates — including IT and computing.",
      hi: "सर्टिफिकेट के साथ मुफ़्त सरकारी ऑनलाइन कोर्स — IT और कंप्यूटिंग समेत।",
    },
    tags: ["college", "digital"],
  },
  {
    title: "NPTEL",
    url: "https://nptel.ac.in",
    desc: {
      en: "Free lectures from IIT / IISc professors.",
      hi: "IIT / IISc के प्रोफेसरों के मुफ़्त लेक्चर।",
    },
    tags: ["college"],
  },
  {
    title: "BBC Learning English",
    url: "https://www.bbc.co.uk/learningenglish",
    desc: {
      en: "Free lessons, audio and video.",
      hi: "मुफ़्त लेसन, ऑडियो और वीडियो।",
    },
    tags: ["english"],
  },
  {
    title: "Spoken English (free YouTube)",
    url: "https://www.youtube.com/results?search_query=spoken+english+course+for+beginners",
    desc: {
      en: "Free beginner spoken-English courses.",
      hi: "शुरुआती लोगों के लिए मुफ़्त स्पोकन इंग्लिश कोर्स।",
    },
    tags: ["english"],
  },
  {
    title: "Grow with Google",
    url: "https://grow.google/intl/en_in/",
    desc: {
      en: "Free digital-skills courses.",
      hi: "मुफ़्त डिजिटल स्किल्स कोर्स।",
    },
    tags: ["digital"],
  },
  {
    title: "Khan Academy — Computing",
    url: "https://www.khanacademy.org/computing",
    desc: {
      en: "Free programming and computer-science lessons.",
      hi: "मुफ़्त प्रोग्रामिंग और कंप्यूटर-साइंस लेसन।",
    },
    tags: ["digital"],
  },
];
