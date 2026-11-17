/**
 * Knowledge Component (KC) Scaffolding Engine
 * 
 * Hybrid 2-Tier Architecture:
 * - Tier 1: Teacher custom hint/explanation override (if authored in Admin panel)
 * - Tier 2: Automated Criterion-Referenced KC Semantic Scaffolding (English + ASL Gloss)
 * 
 * Provides cognitive scaffolding for both:
 * 1. Hint Option Elimination (why an eliminated distractor is invalid)
 * 2. Post-Submission Wrong Answer Review (why student choice was wrong + correct answer concept)
 */

export interface KCDefinition {
  displayName: string;
  criterion: string;
  eliminationReasonEn: string;
  eliminationReasonAsl: string;
  wrongAnswerGuidanceEn: string;
  wrongAnswerGuidanceAsl: string;
}

export const KC_SCAFFOLDING_DICTIONARY: Record<string, KCDefinition> = {
  setting: {
    displayName: "Setting",
    criterion: "Where and When the story takes place (location or time).",
    eliminationReasonEn: "Setting requires a location (WHERE) or time (WHEN). This choice does not tell where or when the story happened.",
    eliminationReasonAsl: "SETTING MUST BE PLACE OR TIME. THIS CHOICE NOT PLACE/TIME.",
    wrongAnswerGuidanceEn: "Remember: Setting tells WHERE or WHEN the story happened. Look for a location, time, or place.",
    wrongAnswerGuidanceAsl: "SETTING MEAN PLACE OR TIME. LOOK WHERE / WHEN STORY HAPPEN.",
  },
  character: {
    displayName: "Character",
    criterion: "A person or animal who acts, talks, or feels in the story (WHO).",
    eliminationReasonEn: "A character must be a person or animal who takes action in the story. This choice is not an actor.",
    eliminationReasonAsl: "CHARACTER MUST BE PERSON OR ANIMAL. THIS CHOICE NOT ACTOR.",
    wrongAnswerGuidanceEn: "Remember: Characters are the people or animals in the story. Look for WHO is doing the actions.",
    wrongAnswerGuidanceAsl: "CHARACTER MEAN WHO (PERSON / ANIMAL). LOOK WHO DO ACTION.",
  },
  characters: {
    displayName: "Characters",
    criterion: "People or animals who act, talk, or feel in the story (WHO).",
    eliminationReasonEn: "Characters must be people or animals who take action in the story. This choice is not an actor.",
    eliminationReasonAsl: "CHARACTERS MUST BE PEOPLE OR ANIMALS. THIS CHOICE NOT ACTOR.",
    wrongAnswerGuidanceEn: "Remember: Characters are the people or animals in the story. Look for WHO is doing the actions.",
    wrongAnswerGuidanceAsl: "CHARACTER MEAN WHO (PERSON / ANIMAL). LOOK WHO DO ACTION.",
  },
  initiating_event: {
    displayName: "Initiating Event / Problem",
    criterion: "The trouble, conflict, or event that started the character's adventure.",
    eliminationReasonEn: "The initiating event is the problem or trouble that starts the story. This choice is not the conflict.",
    eliminationReasonAsl: "INITIATING EVENT MEAN TROUBLE START STORY. THIS CHOICE NOT TROUBLE.",
    wrongAnswerGuidanceEn: "Remember: Look for the trouble or unexpected event that caused the problem in the story.",
    wrongAnswerGuidanceAsl: "LOOK WHAT TROUBLE FIRST HAPPEN TO START PROBLEM.",
  },
  problem: {
    displayName: "Problem",
    criterion: "The conflict, challenge, or trouble the character needs to solve.",
    eliminationReasonEn: "A problem is the conflict or trouble in the story. This choice does not describe what went wrong.",
    eliminationReasonAsl: "PROBLEM MEAN TROUBLE / CONFLICT. THIS CHOICE NOT TROUBLE.",
    wrongAnswerGuidanceEn: "Remember: The problem is what went wrong. Look for the conflict the character faces.",
    wrongAnswerGuidanceAsl: "PROBLEM MEAN TROUBLE. LOOK WHAT WRONG NEED FIX.",
  },
  attempt: {
    displayName: "Attempt / Action",
    criterion: "The action taken by the character to solve the problem.",
    eliminationReasonEn: "An attempt is what the character does to try to fix the problem. This choice is not an action step.",
    eliminationReasonAsl: "ATTEMPT MEAN ACTION TO FIX PROBLEM. THIS CHOICE NOT ACTION.",
    wrongAnswerGuidanceEn: "Remember: An attempt is what the character DID to try to solve their problem.",
    wrongAnswerGuidanceAsl: "ATTEMPT MEAN ACTION. LOOK CHARACTER DO WHAT TO FIX PROBLEM.",
  },
  action: {
    displayName: "Action / Attempt",
    criterion: "The action taken by the character to solve the problem.",
    eliminationReasonEn: "An action describes what the character does. This choice does not describe an action step.",
    eliminationReasonAsl: "ACTION MEAN CHARACTER DO SOMETHING. THIS CHOICE NOT ACTION.",
    wrongAnswerGuidanceEn: "Remember: Look for the action the character performed to solve their problem.",
    wrongAnswerGuidanceAsl: "ACTION MEAN DO SOMETHING. LOOK CHARACTER ACTION.",
  },
  internal_response: {
    displayName: "Internal Response",
    criterion: "How the character feels, thinks, or reacts emotionally to the problem.",
    eliminationReasonEn: "An internal response describes feelings or thoughts. This choice is not an emotion or thought.",
    eliminationReasonAsl: "INTERNAL RESPONSE MEAN FEELING OR THOUGHT. THIS CHOICE NOT FEELING.",
    wrongAnswerGuidanceEn: "Remember: Internal response is how the character FELT inside (sad, worried, determined).",
    wrongAnswerGuidanceAsl: "INTERNAL RESPONSE MEAN FEELING INSIDE (SAD, WORRY, HAPPY).",
  },
  emotion: {
    displayName: "Emotion / Feeling",
    criterion: "How the character feels emotionally.",
    eliminationReasonEn: "This question asks for an emotion. This choice does not describe how the character feels.",
    eliminationReasonAsl: "QUESTION ASK EMOTION. THIS CHOICE NOT FEELING.",
    wrongAnswerGuidanceEn: "Remember: Look for the emotion or feeling word (worried, excited, scared, glad).",
    wrongAnswerGuidanceAsl: "LOOK FEELING WORD (WORRY, EXCITED, SCARED, GLAD).",
  },
  consequence: {
    displayName: "Consequence / Resolution",
    criterion: "The outcome or how the problem was solved at the end of the story.",
    eliminationReasonEn: "A consequence shows the outcome or ending. This choice does not show how the story finished.",
    eliminationReasonAsl: "CONSEQUENCE MEAN OUTCOME / ENDING. THIS CHOICE NOT RESULT.",
    wrongAnswerGuidanceEn: "Remember: Look for how the story ended or whether the problem was solved.",
    wrongAnswerGuidanceAsl: "LOOK HOW STORY END. PROBLEM SOLVED HOW?",
  },
  resolution: {
    displayName: "Resolution",
    criterion: "How the problem was solved or how the story ended.",
    eliminationReasonEn: "A resolution describes how the problem was solved. This choice does not show the fix or outcome.",
    eliminationReasonAsl: "RESOLUTION SHOW PROBLEM FIXED. THIS CHOICE NOT SHOW FIX.",
    wrongAnswerGuidanceEn: "Remember: The resolution is how everything was fixed or settled in the end.",
    wrongAnswerGuidanceAsl: "RESOLUTION MEAN PROBLEM FIXED IN END.",
  },
  reaction: {
    displayName: "Reaction",
    criterion: "The final feeling, lesson, or thought after the resolution.",
    eliminationReasonEn: "A reaction shows the final reflection or lesson learned. This choice is not a final reaction.",
    eliminationReasonAsl: "REACTION MEAN FINAL FEELING OR LESSON. THIS CHOICE NOT REACTION.",
    wrongAnswerGuidanceEn: "Remember: Look for what the character felt or learned at the very end.",
    wrongAnswerGuidanceAsl: "LOOK FINAL FEELING OR LESSON LEARNED IN END.",
  },
  vocabulary: {
    displayName: "Vocabulary Meaning",
    criterion: "Word definition or concept understanding based on story context.",
    eliminationReasonEn: "This question asks for the meaning of a key word. This choice does not fit the sentence context.",
    eliminationReasonAsl: "QUESTION ASK WORD MEANING. THIS CHOICE NOT FIT CONTEXT.",
    wrongAnswerGuidanceEn: "Remember: Read the sentence again and use the visual picture to find the word meaning.",
    wrongAnswerGuidanceAsl: "LOOK PICTURE AND SENTENCE CLUES TO FIND WORD MEANING.",
  },
  general: {
    displayName: "Reading Comprehension",
    criterion: "Understanding the main details and flow of the passage.",
    eliminationReasonEn: "This choice does not match the facts or sequence described in the story.",
    eliminationReasonAsl: "THIS CHOICE NOT MATCH STORY FACTS.",
    wrongAnswerGuidanceEn: "Remember: Check the details in the story to find which choice is supported by the passage.",
    wrongAnswerGuidanceAsl: "CHECK STORY DETAILS. FIND CHOICE MATCH PASSAGE.",
  },
};

/**
 * Normalizes any KC string to match dictionary keys.
 */
export function normalizeKC(rawKc?: string | null): string {
  if (!rawKc) return "general";
  // Remove common database prefixes like KC_STORY_, KC_, etc.
  const cleaned = rawKc
    .trim()
    .toLowerCase()
    .replace(/^kc_story_/, "")
    .replace(/^kc_/, "")
    .replace(/[\s-]+/g, "_");

  if (cleaned in KC_SCAFFOLDING_DICTIONARY) return cleaned;
  if (cleaned.includes("setting")) return "setting";
  if (cleaned.includes("character")) return "character";
  if (cleaned.includes("problem") || cleaned.includes("initiating")) return "initiating_event";
  if (cleaned.includes("attempt") || cleaned.includes("action")) return "attempt";
  if (cleaned.includes("response") || cleaned.includes("emotion")) return "internal_response";
  if (cleaned.includes("consequence") || cleaned.includes("resolution")) return "resolution";
  if (cleaned.includes("reaction")) return "reaction";
  if (cleaned.includes("vocab") || cleaned.includes("english")) return "vocabulary";
  return "general";
}

/**
 * Extracts key actor name from question stem if available (e.g. "Where does Leo play..." -> "Leo")
 */
function extractSubject(qText?: string): string {
  if (!qText) return "the character";
  const match = qText.match(/(?:does|did|is|was|will)\s+([A-Z][a-z]+)/);
  if (match && match[1]) return match[1];
  const nameMatch = qText.match(/\b([A-Z][a-z]+)'s\b/);
  if (nameMatch && nameMatch[1]) return nameMatch[1];
  return "the character";
}

/**
 * Hybrid 2-Tier Hint Elimination Scaffold:
 * Tier 1: Teacher custom hint (if authored)
 * Tier 2: Context-Aware Question & KC Invalidation (English + ASL Gloss)
 */
export function getEliminationScaffold(
  rawKc: string | undefined | null,
  optionText: string,
  customTeacherHint?: string | null,
  questionText?: string
): { reasonEn: string; reasonAsl: string; tier: 1 | 2 } {
  // Tier 1: Teacher custom hint override
  if (
    customTeacherHint &&
    customTeacherHint.trim().length > 0 &&
    !customTeacherHint.startsWith("Look closely") &&
    !customTeacherHint.startsWith("Think carefully")
  ) {
    return {
      reasonEn: customTeacherHint.trim(),
      reasonAsl: customTeacherHint.trim().toUpperCase(),
      tier: 1,
    };
  }

  // Tier 2: Automated Context-Aware Invalidation
  const kcKey = normalizeKC(rawKc);
  const qLower = (questionText || "").toLowerCase();
  const optLower = (optionText || "").toLowerCase();
  const subject = extractSubject(questionText);

  // 1. Setting Questions ("Where...", "When...")
  if (kcKey === "setting" || qLower.startsWith("where") || qLower.startsWith("when")) {
    const isPlaceLocation =
      optLower.startsWith("in ") ||
      optLower.startsWith("at ") ||
      optLower.startsWith("on ") ||
      optLower.startsWith("under ") ||
      optLower.startsWith("inside ") ||
      optLower.startsWith("behind ");

    if (isPlaceLocation) {
      return {
        reasonEn: `In the story, ${subject} does not start or play '${optionText}'. Look for where the adventure actually began.`,
        reasonAsl: `${subject.toUpperCase()} NOT AT '${optionText.toUpperCase()}' IN STORY. LOOK WHERE STORY BEGINS.`,
        tier: 2,
      };
    } else {
      return {
        reasonEn: `Setting requires a location (WHERE) or time (WHEN). '${optionText}' does not tell where or when.`,
        reasonAsl: `SETTING MEAN PLACE OR TIME. '${optionText.toUpperCase()}' NOT PLACE.`,
        tier: 2,
      };
    }
  }

  // 2. Character Questions ("Who...")
  if (kcKey === "character" || kcKey === "characters" || qLower.startsWith("who")) {
    return {
      reasonEn: `In the story, '${optionText}' is not the character who did this. Look for who took action.`,
      reasonAsl: `'${optionText.toUpperCase()}' NOT THE CHARACTER. LOOK WHO DO ACTION.`,
      tier: 2,
    };
  }

  // 3. Problem Questions ("What was the problem...", "What went wrong...")
  if (
    kcKey === "initiating_event" ||
    kcKey === "problem" ||
    qLower.includes("problem") ||
    qLower.includes("trouble")
  ) {
    return {
      reasonEn: `'${optionText}' was not the conflict or problem that started the trouble in the story.`,
      reasonAsl: `'${optionText.toUpperCase()}' NOT THE TROUBLE IN STORY.`,
      tier: 2,
    };
  }

  // 4. Resolution Questions ("How did it end...", "How was it solved...")
  if (
    kcKey === "resolution" ||
    kcKey === "consequence" ||
    qLower.includes("end") ||
    qLower.includes("solve")
  ) {
    return {
      reasonEn: `'${optionText}' is not how the story ended or how the problem was resolved.`,
      reasonAsl: `'${optionText.toUpperCase()}' NOT HOW STORY END OR FIX.`,
      tier: 2,
    };
  }

  // 5. Action / Attempt Questions ("Why did...", "What did...")
  if (kcKey === "attempt" || kcKey === "action" || qLower.startsWith("why")) {
    return {
      reasonEn: `In the story, '${optionText}' is not the action or reason described in the passage.`,
      reasonAsl: `'${optionText.toUpperCase()}' NOT REASON OR ACTION IN STORY.`,
      tier: 2,
    };
  }

  // Fallback to dictionary
  const def = KC_SCAFFOLDING_DICTIONARY[kcKey] || KC_SCAFFOLDING_DICTIONARY.general;
  return {
    reasonEn: def.eliminationReasonEn,
    reasonAsl: def.eliminationReasonAsl,
    tier: 2,
  };
}

/**
 * Hybrid 2-Tier Post-Submission Wrong Answer Scaffold
 */
export function getWrongAnswerScaffold(
  rawKc: string | undefined | null,
  selectedOptionText: string,
  correctOptionText: string,
  customTeacherHint?: string | null,
  questionText?: string
): {
  kcDisplayName: string;
  reasonEn: string;
  reasonAsl: string;
  correctAnswerText: string;
  tier: 1 | 2;
} {
  const kcKey = normalizeKC(rawKc);
  const def = KC_SCAFFOLDING_DICTIONARY[kcKey] || KC_SCAFFOLDING_DICTIONARY.general;
  const subject = extractSubject(questionText);

  // Tier 1: Teacher custom hint available
  if (
    customTeacherHint &&
    customTeacherHint.trim().length > 0 &&
    !customTeacherHint.startsWith("Look closely") &&
    !customTeacherHint.startsWith("Think carefully")
  ) {
    return {
      kcDisplayName: def.displayName,
      reasonEn: `${customTeacherHint.trim()} '${selectedOptionText}' is not the correct answer.`,
      reasonAsl: `${customTeacherHint.trim().toUpperCase()}. '${selectedOptionText.toUpperCase()}' WRONG.`,
      correctAnswerText: correctOptionText,
      tier: 1,
    };
  }

  // Setting contextual feedback
  if (kcKey === "setting") {
    return {
      kcDisplayName: "Setting (Location / Time)",
      reasonEn: `Remember: Setting tells WHERE or WHEN the story took place. In the story, ${subject} was at '${correctOptionText}', not '${selectedOptionText}'.`,
      reasonAsl: `SETTING MEAN PLACE. IN STORY, ${subject.toUpperCase()} AT '${correctOptionText.toUpperCase()}', NOT '${selectedOptionText.toUpperCase()}'.`,
      correctAnswerText: correctOptionText,
      tier: 2,
    };
  }

  // Character contextual feedback
  if (kcKey === "character" || kcKey === "characters") {
    return {
      kcDisplayName: "Character (Who)",
      reasonEn: `Remember: Look for who is acting in the story. In the story, '${correctOptionText}' is the character who did this, not '${selectedOptionText}'.`,
      reasonAsl: `CHARACTER MEAN WHO. '${correctOptionText.toUpperCase()}' IS CHARACTER, NOT '${selectedOptionText.toUpperCase()}'.`,
      correctAnswerText: correctOptionText,
      tier: 2,
    };
  }

  // Problem / Initiating Event contextual feedback
  if (kcKey === "initiating_event" || kcKey === "problem") {
    return {
      kcDisplayName: "Problem / Conflict",
      reasonEn: `Remember: The problem is what went wrong. In the story, the real trouble was '${correctOptionText}', not '${selectedOptionText}'.`,
      reasonAsl: `PROBLEM MEAN TROUBLE. IN STORY, TROUBLE WAS '${correctOptionText.toUpperCase()}', NOT '${selectedOptionText.toUpperCase()}'.`,
      correctAnswerText: correctOptionText,
      tier: 2,
    };
  }

  // Action / Attempt contextual feedback
  if (kcKey === "attempt" || kcKey === "action") {
    return {
      kcDisplayName: "Action / Attempt",
      reasonEn: `Remember: An attempt is what the character does to fix the problem. In the story, ${subject} did '${correctOptionText}', not '${selectedOptionText}'.`,
      reasonAsl: `ACTION MEAN WHAT DO. IN STORY, ${subject.toUpperCase()} DID '${correctOptionText.toUpperCase()}', NOT '${selectedOptionText.toUpperCase()}'.`,
      correctAnswerText: correctOptionText,
      tier: 2,
    };
  }

  // Resolution / Consequence contextual feedback
  if (kcKey === "consequence" || kcKey === "resolution") {
    return {
      kcDisplayName: "Resolution / Ending",
      reasonEn: `Remember: Resolution shows how the problem was solved. In the story, it was resolved by '${correctOptionText}', not '${selectedOptionText}'.`,
      reasonAsl: `RESOLUTION MEAN HOW FIX. IN STORY, SOLVED BY '${correctOptionText.toUpperCase()}', NOT '${selectedOptionText.toUpperCase()}'.`,
      correctAnswerText: correctOptionText,
      tier: 2,
    };
  }

  // Emotion / Internal Response contextual feedback
  if (kcKey === "internal_response" || kcKey === "emotion") {
    return {
      kcDisplayName: "Emotion / Feeling",
      reasonEn: `Remember: Internal response is how the character feels inside. In the story, ${subject} felt '${correctOptionText}', not '${selectedOptionText}'.`,
      reasonAsl: `FEELING MEAN INSIDE EMOTION. IN STORY, ${subject.toUpperCase()} FELT '${correctOptionText.toUpperCase()}', NOT '${selectedOptionText.toUpperCase()}'.`,
      correctAnswerText: correctOptionText,
      tier: 2,
    };
  }

  // Tier 2: Automated KC guidance fallback
  return {
    kcDisplayName: def.displayName,
    reasonEn: `${def.wrongAnswerGuidanceEn} The correct answer is '${correctOptionText}', not '${selectedOptionText}'.`,
    reasonAsl: `${def.wrongAnswerGuidanceAsl} CORRECT ANSWER: '${correctOptionText.toUpperCase()}'.`,
    correctAnswerText: correctOptionText,
    tier: 2,
  };
}
