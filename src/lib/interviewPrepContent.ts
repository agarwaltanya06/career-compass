/**
 * Body content for the /interview-prep page (§6), from interview-prep.md.
 *
 * Section headings live in messages/* (read via i18n, so they can be translated
 * later); the longer body — the question bank, the stage tips, and the practice
 * links — lives here as structured data the page renders. Each prose field is a
 * {en, hi} pair (see lib/i18n/localized); URLs aren't translated. Keeping prose
 * out of the JSX keeps the page readable and the content easy to edit.
 */

import type { LangText } from "./i18n/localized";

/** One common question and a short, scannable answer. */
export interface InterviewQA {
  /** The question as an interviewer would ask it. */
  q: LangText;
  /** The core advice. */
  a: LangText;
  /** Optional one-line example answer, shown in quotes/italics. */
  eg?: LangText;
  /** Optional closing caveat (e.g. "Never say …"). */
  note?: LangText;
}

export const QUESTIONS: InterviewQA[] = [
  {
    q: { en: "“Tell me about yourself.”", hi: "“अपने बारे में बताइए।”" },
    a: {
      en: "Keep it under a minute: your class/course → one or two interests → why you want this role.",
      hi: "एक मिनट से कम में रखें: आपकी क्लास/कोर्स → एक-दो दिलचस्पी → आप यह रोल क्यों चाहते हैं।",
    },
  },
  {
    q: { en: "“What are your strengths?”", hi: "“आपकी ताक़त क्या हैं?”" },
    a: { en: "Pick one, add proof.", hi: "एक चुनें और उसका सबूत दें।" },
    eg: {
      en: "I'm reliable — I managed our event budget and kept it on track.",
      hi: "मैं भरोसेमंद हूँ — मैंने अपने इवेंट का बजट संभाला और उसे सही रखा।",
    },
  },
  {
    q: { en: "“What is your weakness?”", hi: "“आपकी कमज़ोरी क्या है?”" },
    a: {
      en: "Name a real, fixable one, plus what you're doing about it.",
      hi: "कोई सच्ची कमज़ोरी बताएँ जिसे सुधारा जा सके, और आप उस पर क्या कर रहे हैं।",
    },
    eg: {
      en: "I get nervous presenting, so I now volunteer to speak in class.",
      hi: "प्रेज़ेंटेशन में मैं घबरा जाता था, इसलिए अब मैं क्लास में बोलने के लिए आगे आता हूँ।",
    },
    note: { en: "Don't say “I have none.”", hi: "यह न कहें कि “मुझमें कोई कमी नहीं है।”" },
  },
  {
    q: {
      en: "“Why do you want this internship/job?”",
      hi: "“आप यह इंटर्नशिप/नौकरी क्यों चाहते हैं?”",
    },
    a: { en: "Connect it to learning.", hi: "इसे सीखने से जोड़ें।" },
    eg: {
      en: "I want real experience in this field, not just from books.",
      hi: "मैं इस फ़ील्ड में सिर्फ़ किताबों से नहीं, असली अनुभव लेना चाहता हूँ।",
    },
  },
  {
    q: {
      en: "“Where do you see yourself in a few years?”",
      hi: "“कुछ सालों में आप ख़ुद को कहाँ देखते हैं?”",
    },
    a: {
      en: "Show direction, not a perfect plan.",
      hi: "एक दिशा दिखाएँ, परफेक्ट प्लान नहीं।",
    },
    eg: {
      en: "Growing my skills and taking on more responsibility.",
      hi: "अपनी स्किल्स बढ़ाते हुए और ज़्यादा ज़िम्मेदारी लेते हुए।",
    },
  },
  {
    q: {
      en: "“Tell me about a problem you faced.”",
      hi: "“किसी मुश्किल के बारे में बताइए जो आपके सामने आई।”",
    },
    a: {
      en: "Use the 3 steps. Small and real is fine.",
      hi: "3 स्टेप्स इस्तेमाल करें। छोटी और सच्ची बात भी ठीक है।",
    },
  },
  {
    q: {
      en: "“Tell me about a mistake you made.”",
      hi: "“कोई ग़लती बताइए जो आपने की।”",
    },
    a: {
      en: "Be honest, then say what you learned. Owning it calmly looks good.",
      hi: "ईमानदार रहें, फिर बताएँ कि आपने क्या सीखा। शांति से ग़लती मानना अच्छा लगता है।",
    },
  },
  {
    q: {
      en: "“How do you handle pressure or deadlines?”",
      hi: "“आप प्रेशर या डेडलाइन को कैसे संभालते हैं?”",
    },
    a: { en: "Give your real method.", hi: "अपना असली तरीका बताएँ।" },
    eg: {
      en: "I make a list and do the most important thing first.",
      hi: "मैं एक लिस्ट बनाता हूँ और सबसे ज़रूरी काम पहले करता हूँ।",
    },
  },
  {
    q: { en: "“What do you know about us?”", hi: "“हमारे बारे में आप क्या जानते हैं?”" },
    a: {
      en: "Spend 10 minutes reading about the company before you go.",
      hi: "जाने से पहले 10 मिनट कंपनी के बारे में पढ़ लें।",
    },
  },
  {
    q: {
      en: "“Do you have any questions for us?”",
      hi: "“क्या आपके हमारे लिए कोई सवाल हैं?”",
    },
    a: { en: "Say yes!", hi: "हाँ कहें!" },
    eg: {
      en: "What would I do day to day?” or “What will I learn here?",
      hi: "रोज़ मेरा काम क्या होगा?” या “मैं यहाँ क्या सीखूँगा?",
    },
    note: { en: "Don't say “no questions.”", hi: "यह न कहें कि “कोई सवाल नहीं है।”" },
  },
];

/** Practical tips grouped by stage. `id` keys each stage heading in messages. */
export interface InterviewTipGroup {
  id: "before" | "during" | "after";
  tips: LangText[];
}

export const TIP_GROUPS: InterviewTipGroup[] = [
  {
    id: "before",
    tips: [
      {
        en: "Research the company — 10 minutes is enough.",
        hi: "कंपनी के बारे में पढ़ें — 10 मिनट काफ़ी हैं।",
      },
      {
        en: "Practise answers out loud (with a friend or a mirror).",
        hi: "जवाब बोल-बोलकर प्रैक्टिस करें (दोस्त के साथ या आईने के सामने)।",
      },
      {
        en: "Carry a clean CV and any marksheets.",
        hi: "एक साफ़ CV और अपनी मार्कशीट साथ रखें।",
      },
      {
        en: "Reach 10–15 minutes early; test the video link beforehand.",
        hi: "10–15 मिनट पहले पहुँचें; वीडियो लिंक पहले ही चेक कर लें।",
      },
    ],
  },
  {
    id: "during",
    tips: [
      {
        en: "Greet politely, sit up, make eye contact.",
        hi: "अदब से नमस्ते करें, सीधे बैठें, आँखों में देखकर बात करें।",
      },
      {
        en: "Listen fully. Pausing to think is fine.",
        hi: "पूरा सुनें। सोचने के लिए रुकना ठीक है।",
      },
      {
        en: "Don't understand? Ask them to repeat.",
        hi: "समझ नहीं आया? दोबारा बताने को कहें।",
      },
      {
        en: "Be honest: “I haven't done that yet, but I'd like to learn.” Don't make things up.",
        hi: "ईमानदार रहें: “मैंने अभी तक यह नहीं किया, पर मैं सीखना चाहूँगा।” बातें मत बनाएँ।",
      },
      {
        en: "English is hard? Speak slowly, or ask if you can answer in Hindi.",
        hi: "इंग्लिश मुश्किल लगे? धीरे बोलें, या पूछ लें कि क्या आप हिंदी में जवाब दे सकते हैं।",
      },
    ],
  },
  {
    id: "after",
    tips: [
      {
        en: "Thank them before leaving, or send a short thank-you message.",
        hi: "जाने से पहले धन्यवाद कहें, या एक छोटा थैंक-यू मैसेज भेजें।",
      },
    ],
  },
];

/** A free practice resource (external link). */
export interface PracticeLink {
  label: LangText;
  url: string;
}

export const PRACTICE_LINKS: PracticeLink[] = [
  {
    label: {
      en: "How to answer “Tell me about yourself” (YouTube)",
      hi: "“अपने बारे में बताइए” का जवाब कैसे दें (YouTube)",
    },
    url: "https://www.youtube.com/results?search_query=tell+me+about+yourself+interview+answer+for+freshers",
  },
  {
    label: {
      en: "Common interview questions for freshers (YouTube)",
      hi: "फ्रेशर्स के लिए आम इंटरव्यू सवाल (YouTube)",
    },
    url: "https://www.youtube.com/results?search_query=fresher+interview+questions+and+answers",
  },
  {
    label: {
      en: "Internshala interview prep guides",
      hi: "Internshala की इंटरव्यू तैयारी गाइड",
    },
    url: "https://internshala.com/blog/category/interview-tips/",
  },
];
