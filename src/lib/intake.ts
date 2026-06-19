/**
 * The adaptive intake flow (section 1 of the spec).
 *
 * Each question is data, not hard-coded UI, so the flow stays easy to extend.
 * The component in app/intake/page.tsx walks these questions in order, skips
 * any whose `askWhen` returns false given the answers so far, and applies the
 * branch notes when building the final journey request.
 *
 * Neither cost nor location is an intake question — see the spec. We fetch all
 * price bands India-wide, then let the user filter the rendered results by cost
 * bucket and by the states/cities actually present in their results.
 */

/** Keys we collect during intake. Mirrors StudentProfile plus intent fields. */
export interface IntakeAnswers {
  class?: string;
  board?: string;
  /** Free-text sub-answer, e.g. the state name for "State board". */
  boardState?: string;
  stream?: string;
  /** The career goal, or the sentinel "__explore__" for "Not sure". */
  goal?: string;
  /** Free-text career when the user typed their own. */
  goalCustom?: string;
  language?: string;
}

/** A tappable option. `value` is stored; `labelKey` is looked up via t(). */
export interface IntakeOption {
  value: string;
  /** i18n key under `intake.options.*`. */
  labelKey: string;
  /** If set, selecting this option reveals a free-text follow-up field. */
  followUp?: {
    /** Which IntakeAnswers field the typed value writes to. */
    field: keyof IntakeAnswers;
    /** i18n key for the input placeholder. */
    placeholderKey: string;
  };
  /** Marks the "Not sure — help me explore" branch. */
  isExplore?: boolean;
}

export interface IntakeQuestion {
  id: string;
  /** Which IntakeAnswers field this question's choice writes to. */
  field: keyof IntakeAnswers;
  /** i18n key for the question text, under `intake.questions.*`. */
  promptKey: string;
  options: IntakeOption[];
  /**
   * If set, the question also offers a free-text input in addition to the
   * tappable options, writing the typed value to this IntakeAnswers field.
   */
  customField?: keyof IntakeAnswers;
  /** Return false to skip this question given answers collected so far. */
  askWhen?: (a: IntakeAnswers) => boolean;
}

/** Sentinel value stored when the user picks "Not sure — help me explore". */
export const EXPLORE_GOAL = "__explore__";

/** Classes that skip the stream question (Q3 only asked when class >= 11). */
const CLASSES_BELOW_11 = new Set(["9", "10"]);

export const intakeQuestions: IntakeQuestion[] = [
  {
    id: "class",
    field: "class",
    promptKey: "intake.questions.class",
    options: [
      { value: "9", labelKey: "intake.options.class9" },
      { value: "10", labelKey: "intake.options.class10" },
      { value: "11", labelKey: "intake.options.class11" },
      { value: "12", labelKey: "intake.options.class12" },
      { value: "passed12", labelKey: "intake.options.passed12" },
      { value: "college", labelKey: "intake.options.inCollege" },
      { value: "gap", labelKey: "intake.options.gapYear" },
    ],
  },
  {
    id: "board",
    field: "board",
    promptKey: "intake.questions.board",
    options: [
      { value: "cbse", labelKey: "intake.options.cbse" },
      { value: "icse", labelKey: "intake.options.icse" },
      {
        value: "state",
        labelKey: "intake.options.stateBoard",
        followUp: {
          field: "boardState",
          placeholderKey: "intake.placeholders.whichState",
        },
      },
      { value: "nios", labelKey: "intake.options.nios" },
      { value: "other", labelKey: "intake.options.other" },
    ],
  },
  {
    id: "stream",
    field: "stream",
    promptKey: "intake.questions.stream",
    // Only asked for class 11 and up — don't ask stream to a class-9 student.
    askWhen: (a) => !!a.class && !CLASSES_BELOW_11.has(a.class),
    options: [
      { value: "pcm", labelKey: "intake.options.sciencePCM" },
      { value: "pcb", labelKey: "intake.options.sciencePCB" },
      { value: "pcmb", labelKey: "intake.options.sciencePCMB" },
      { value: "commerce-maths", labelKey: "intake.options.commerceMaths" },
      { value: "commerce-no-maths", labelKey: "intake.options.commerceNoMaths" },
      { value: "arts", labelKey: "intake.options.arts" },
      { value: "vocational", labelKey: "intake.options.vocational" },
      { value: "not-chosen", labelKey: "intake.options.notChosen" },
    ],
  },
  {
    id: "goal",
    field: "goal",
    promptKey: "intake.questions.goal",
    customField: "goalCustom",
    // The ~20 common careers, sorted alphabetically so ordering is never a
    // judgment call (spec §1). "Type your own" (the customField above) and
    // "Not sure — help me explore" sit *outside* the alphabetical block, at the end.
    options: [
      { value: "architecture", labelKey: "intake.options.architecture" },
      { value: "cabin-crew", labelKey: "intake.options.cabinCrew" },
      { value: "ca", labelKey: "intake.options.ca" },
      { value: "civil-services", labelKey: "intake.options.civilServices" },
      { value: "defence", labelKey: "intake.options.defence" },
      { value: "design", labelKey: "intake.options.design" },
      { value: "doctor", labelKey: "intake.options.doctor" },
      { value: "engineer", labelKey: "intake.options.engineer" },
      { value: "fashion-design", labelKey: "intake.options.fashionDesign" },
      { value: "govt-job", labelKey: "intake.options.govtJob" },
      { value: "hospitality", labelKey: "intake.options.hospitality" },
      { value: "iti-polytechnic", labelKey: "intake.options.itiPolytechnic" },
      { value: "journalism", labelKey: "intake.options.journalism" },
      { value: "law", labelKey: "intake.options.law" },
      { value: "merchant-navy", labelKey: "intake.options.merchantNavy" },
      { value: "nursing", labelKey: "intake.options.nursing" },
      { value: "paramedical", labelKey: "intake.options.paramedical" },
      { value: "pharmacy", labelKey: "intake.options.pharmacy" },
      { value: "teaching", labelKey: "intake.options.teaching" },
      { value: "social-work", labelKey: "intake.options.socialWork" },
      {
        value: EXPLORE_GOAL,
        labelKey: "intake.options.notSureExplore",
        isExplore: true,
      },
    ],
  },
  {
    id: "language",
    field: "language",
    promptKey: "intake.questions.language",
    options: [
      { value: "en", labelKey: "intake.options.english" },
      { value: "hi", labelKey: "intake.options.hindi" },
    ],
  },
];

/**
 * Compute the ordered list of questions to actually ask, given the answers so
 * far. Pure function so it's trivial to test and reason about.
 */
export function visibleQuestions(answers: IntakeAnswers): IntakeQuestion[] {
  return intakeQuestions.filter((q) => (q.askWhen ? q.askWhen(answers) : true));
}

/**
 * A short, human-readable note describing how the journey will *lead*, based on
 * the branching rules in the spec. Shown on the summary screen so the user
 * understands the adaptation. (The real journey would be generated server-side.)
 */
export function branchLead(answers: IntakeAnswers): string {
  if (answers.goal === EXPLORE_GOAL) {
    return "Exploration mode: we'll suggest a few careers that fit you, each with a one-line reason, then expand the one you pick.";
  }
  if (answers.class && CLASSES_BELOW_11.has(answers.class)) {
    return "Because you're in Class 9/10, your plan will lead with the stream to pick in Class 11 and why.";
  }
  if (answers.class === "passed12" || answers.class === "gap") {
    return "Because you've finished Class 12, your plan will lead with the nearest entry exam or fallback route, not subject choices.";
  }
  return "Your plan will lead with the best-fit route for your stream and goal.";
}
