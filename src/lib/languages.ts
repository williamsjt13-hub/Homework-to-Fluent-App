// Language registry — add a new entry here to support another target language.
export type LanguageCode = "es";

export const LANGUAGES: Record<LanguageCode, { name: string; nativeName: string; speechLang: string; accents: { value: string; label: string }[] }> = {
  es: {
    name: "Spanish",
    nativeName: "Español",
    speechLang: "es-ES",
    accents: [
      { value: "es-ES", label: "Spain" },
      { value: "es-MX", label: "Mexico" },
      { value: "es-US", label: "Latin America (US)" },
    ],
  },
};

export function languageName(code: string) {
  return LANGUAGES[code as LanguageCode]?.name ?? code;
}

/** Score (%) needed on Day 1 check quizzes before Day 2 unlocks. */
export const MASTERY_PASS = 80;

/** Day 1 foundation deck (verb conjugations, or the core concept when no verbs are taught) — must be finished before the rest of Day 1 unlocks. */
export function isConjugationDeck(a: { kind: string; title: string; content?: unknown }) {
  if (a.kind !== "flashcards") return false;
  if (/conjugat|foundation/i.test(a.title)) return true;
  const cards = ((a.content ?? {}) as { cards?: { front?: string }[] }).cards ?? [];
  return cards.length > 0 && cards.filter((c) => /—\s*(yo|tú|nosotros)\s*$/i.test(c.front ?? "")).length >= cards.length / 2;
}

export const DAY_PLAN = [
  { day: 1, weekday: "Monday", title: "Grammar & Vocabulary", purpose: "Flashcards first: master this week's core concept and words, with a quick review of last week." },
  { day: 2, weekday: "Tuesday", title: "Homework & Active Recall", purpose: "Complete your teacher's homework and actively recall the vocabulary and conjugations from Day 1." },
  { day: 3, weekday: "Wednesday", title: "Listening & Comprehension", purpose: "Train your ears with active listening drills based on this week's scanned homework." },
  { day: 4, weekday: "Thursday", title: "AI Conversation", purpose: "Speak spontaneously with an AI partner in a role-play built around this week's topic." },
  { day: 5, weekday: "Friday", title: "Exam", purpose: "Show what you learned: a full assessment of everything from this week." },
] as const;

export const CATEGORIES = ["vocabulary", "grammar", "conjugation", "agreement", "word_order", "prepositions", "spelling", "pronunciation", "comprehension", "construction", "listening", "reading", "translation"] as const;
