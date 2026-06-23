/**
 * Free learning resources for the /free-resources page (§6), from
 * free-resources.md.
 *
 * The markdown groups the same links under several "what it's for" headings;
 * here each unique resource is listed once and carries a set of `tags` instead,
 * so the page can offer tag-filter buttons (a resource that helps with both
 * board exams and JEE shows up under either filter). URLs/titles aren't
 * translated; tag *labels* are read from messages so the filters can be.
 */

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
  /** One-line "what it is". */
  desc: string;
  tags: ResourceTag[];
}

export const RESOURCES: Resource[] = [
  {
    title: "Khan Academy",
    url: "https://www.khanacademy.org",
    desc: "Maths, science and more — free videos and practice.",
    tags: ["school", "boards", "jeeNeet"],
  },
  {
    title: "NCERT textbooks",
    url: "https://ncert.nic.in/textbook.php",
    desc: "Official books, free to download — the base of most board exams.",
    tags: ["school", "boards"],
  },
  {
    title: "DIKSHA",
    url: "https://diksha.gov.in",
    desc: "Government school app — many subjects and languages, matched to your board.",
    tags: ["school", "boards"],
  },
  {
    title: "e-PathShala",
    url: "https://epathshala.nic.in",
    desc: "Free NCERT e-books and content.",
    tags: ["school"],
  },
  {
    title: "Physics Wallah (free YouTube)",
    url: "https://www.youtube.com/@PhysicsWallah",
    desc: "Popular free entrance-exam prep.",
    tags: ["jeeNeet"],
  },
  {
    title: "NEET official site",
    url: "https://neet.nta.nic.in",
    desc: "Syllabus, past papers and exam info.",
    tags: ["jeeNeet"],
  },
  {
    title: "JEE Main official site",
    url: "https://jeemain.nta.nic.in",
    desc: "Syllabus, dates and exam info.",
    tags: ["jeeNeet"],
  },
  {
    title: "SWAYAM",
    url: "https://swayam.gov.in",
    desc: "Free government online courses with certificates — including IT and computing.",
    tags: ["college", "digital"],
  },
  {
    title: "NPTEL",
    url: "https://nptel.ac.in",
    desc: "Free lectures from IIT / IISc professors.",
    tags: ["college"],
  },
  {
    title: "BBC Learning English",
    url: "https://www.bbc.co.uk/learningenglish",
    desc: "Free lessons, audio and video.",
    tags: ["english"],
  },
  {
    title: "Spoken English (free YouTube)",
    url: "https://www.youtube.com/results?search_query=spoken+english+course+for+beginners",
    desc: "Free beginner spoken-English courses.",
    tags: ["english"],
  },
  {
    title: "Grow with Google",
    url: "https://grow.google/intl/en_in/",
    desc: "Free digital-skills courses.",
    tags: ["digital"],
  },
  {
    title: "Khan Academy — Computing",
    url: "https://www.khanacademy.org/computing",
    desc: "Free programming and computer-science lessons.",
    tags: ["digital"],
  },
];
