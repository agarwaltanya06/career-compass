import type { Journey } from "./types";

/**
 * A hard-coded sample journey so the entire UI is viewable offline, before any
 * LLM call exists. The shape is the real contract (see types.ts); the *values*
 * are illustrative placeholders, exactly as the spec warns — not verified facts.
 * Every high-stakes specific carries `verified: false` so the UI shows the
 * "confirm on official site" tag, which is what we want to demonstrate.
 */
export const sampleJourney: Journey = {
  meta: {
    career: "Chartered Accountant",
    careerAliases: ["CA", "सीए"],
    studentProfile: {
      class: "12",
      board: "CBSE",
      stream: "Commerce + Maths",
      state: "Rajasthan",
      city: "Jaipur",
      englishComfort: "okay",
      language: "en",
    },
    generatedAt: "2026-06-18",
    confidence: "high",
    cacheKey: "ca|cbse|commerce-maths|class12|rajasthan",
  },

  overview: {
    summary:
      "A Chartered Accountant audits accounts, files taxes, and advises businesses on money. In India the qualification is awarded by ICAI and is highly respected. You can start right after Class 12, which suits your Commerce + Maths background well.",
    dayInLife:
      "Mornings often go to reviewing a client's books or preparing tax filings; afternoons to meetings, audits, or studying for the next exam level. Early on you'll spend ~3 years in a practical 'articleship' under a practising CA, learning on real cases.",
    payRange: {
      entry: "₹6–8 lakh / year",
      experienced: "₹20 lakh+ / year",
      note: "approximate — varies widely by city, firm, and specialisation; verify before relying on it",
    },
    demandOutlook:
      "Steady, long-term demand. Every registered company needs audited accounts, and tax work grows with the economy.",
    requirements: [
      "No height/vision/age bars for this career",
      "Strong with numbers and attention to detail",
      "Comfortable with long, multi-year exam preparation",
    ],
  },

  routes: [
    {
      id: "route-1",
      name: "ICAI Foundation route after Class 12",
      bestFor: "Commerce students who want to start right after 12th",
      feasibility: "high",
      feasibilityReason:
        "You're already in Commerce + Maths — the ideal starting point for the Foundation route.",
      costBand: "low",
      duration: "~4.5–5 years",
      steps: [
        {
          order: 1,
          type: "education",
          title: "Register for the ICAI CA Foundation",
          timing: "After Class 12 results",
          description:
            "Register with ICAI and prepare for the Foundation exam, the entry level of the CA programme.",
        },
        {
          order: 2,
          type: "exam",
          title: "Clear CA Foundation",
          timing: "~Within a year of registering",
          description:
            "Four papers covering accounting, law, maths/stats, and economics. Clearing it unlocks the Intermediate level.",
        },
        {
          order: 3,
          type: "exam",
          title: "Clear CA Intermediate (both groups)",
          timing: "After Foundation",
          description:
            "The middle level. Many students clear one group at a time alongside starting articleship.",
        },
        {
          order: 4,
          type: "experience",
          title: "Complete 3 years of Articleship",
          timing: "After clearing Intermediate (one group)",
          description:
            "Practical training under a practising CA. This is where the real learning happens — audits, tax, and client work.",
        },
        {
          order: 5,
          type: "exam",
          title: "Clear CA Final",
          timing: "In the last months of / after articleship",
          description:
            "The final level. Clear it and complete articleship to become a member of ICAI and a qualified CA.",
        },
      ],
      exams: [
        {
          name: "CA Foundation",
          purpose: "Entry-level exam to begin the CA programme",
          eligibility: "Passed Class 12 (any stream, Commerce is the natural fit)",
          typicalWindow: "exams usually held around May and November each year",
          costBand: "low",
          officialUrl: "https://www.icai.org/",
          verified: false,
        },
        {
          name: "CA Intermediate",
          purpose: "Mid-level exam after Foundation",
          eligibility: "Cleared CA Foundation (or eligible via graduation route)",
          typicalWindow: "exams usually held around May and November each year",
          costBand: "low",
          officialUrl: "https://www.icai.org/",
          verified: false,
        },
      ],
      colleges: [
        {
          name: "ICAI (the institute itself — not a college)",
          type: "government",
          location: "Pan-India, with a regional office in Jaipur",
          approxAnnualFees: "₹10,000–60,000 total across levels",
          feesNote: "approximate — confirm current fee structure on the official site",
          entranceRequired: "CA Foundation",
          costBand: "low",
          officialUrl: "https://www.icai.org/",
          verified: false,
        },
      ],
      missedDeadlineFallback: {
        applies: true,
        options: [
          "Missed the Foundation registration window? Register for the next cycle — exams run twice a year.",
          "Prefer to study a degree first? Enter via the graduation (direct-entry) route after a B.Com.",
          "Bridge the gap with a free online accounting course in the meantime.",
        ],
      },
    },
    {
      id: "route-2",
      name: "Graduation-first (B.Com) then direct entry",
      bestFor: "Students who want a degree as a safety net alongside CA",
      feasibility: "medium",
      feasibilityReason:
        "A solid, lower-risk path — you earn a B.Com degree first, but it adds time before you qualify as a CA.",
      costBand: "mid",
      duration: "~5–6 years",
      steps: [
        {
          order: 1,
          type: "education",
          title: "Enrol in a B.Com degree",
          timing: "After Class 12",
          description:
            "A 3-year commerce degree at a college near you. Gives you a fallback qualification and covers much of the CA syllabus.",
        },
        {
          order: 2,
          type: "education",
          title: "Use the CA direct-entry route",
          timing: "After / near graduation",
          description:
            "Graduates with the required marks can skip Foundation and register directly for CA Intermediate.",
        },
        {
          order: 3,
          type: "experience",
          title: "Articleship + CA Final",
          timing: "After Intermediate",
          description:
            "Same practical training and final exam as the Foundation route.",
        },
      ],
      exams: [
        {
          name: "CA Intermediate (direct entry)",
          purpose: "Entry point for graduates skipping Foundation",
          eligibility: "B.Com with the marks threshold set by ICAI",
          typicalWindow: "exams usually held around May and November each year",
          costBand: "low",
          officialUrl: "https://www.icai.org/",
          verified: false,
        },
      ],
      colleges: [
        {
          name: "University of Rajasthan",
          type: "government",
          location: "Jaipur, Rajasthan",
          approxAnnualFees: "₹8,000–20,000 / year",
          feesNote: "approximate — confirm on official site",
          entranceRequired: "Merit / university admission process",
          costBand: "low",
          officialUrl: "https://www.uniraj.ac.in/",
          verified: false,
        },
        {
          name: "St. Xavier's College, Jaipur",
          type: "private",
          location: "Jaipur, Rajasthan",
          approxAnnualFees: "₹40,000–90,000 / year",
          feesNote: "approximate — confirm on official site",
          entranceRequired: "Merit-based admission",
          costBand: "mid",
          officialUrl: "https://www.stxaviersjaipur.org/",
          verified: false,
        },
      ],
      missedDeadlineFallback: {
        applies: true,
        options: [
          "Missed a college admission cycle? Most B.Com programmes admit once a year — plan for the next intake.",
          "Didn't meet the direct-entry marks? Switch to the Foundation route instead.",
        ],
      },
    },
  ],

  prepResources: [
    {
      title: "ICAI Board of Studies — official study material",
      type: "official-guide",
      costBand: "free",
      language: "en",
      url: "https://www.icai.org/",
      verified: false,
    },
    {
      title: "Free CA Foundation accounting lectures (YouTube)",
      type: "video",
      costBand: "free",
      language: "hi",
      url: "https://www.youtube.com/",
      verified: false,
    },
    {
      title: "Introduction to Financial Accounting (free online course)",
      type: "free-course",
      costBand: "free",
      language: "en",
      url: "https://www.coursera.org/",
      verified: false,
    },
  ],

  groundingSources: [
    {
      claim: "CA programme structure and levels",
      url: "https://www.icai.org/",
      fetchedAt: "2026-06-18",
    },
    {
      claim: "exam window (held twice a year)",
      url: "https://www.icai.org/",
      fetchedAt: "2026-06-18",
    },
  ],

  disclaimers: [
    "Dates, fees and eligibility change every year. Always confirm on the official links before acting.",
    "Pay ranges are rough estimates and vary widely by city, firm, and experience.",
  ],
};
