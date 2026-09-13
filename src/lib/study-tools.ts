import { createId } from "@/lib/ids";
import type { Flashcard, QuizQuestion, StudyQuiz } from "@/lib/types";

const SENTENCE_SPLIT = /(?<=[.!?])\s+|\n+/;

export function generateQuizFromText(input: {
  title: string;
  text: string;
  count: number;
  kind: StudyQuiz["kind"];
  subjectId?: string;
  sourceMaterialId?: string;
  timeLimitMinutes?: number;
}) {
  const sentences = unique(
    input.text
      .replace(/\r/g, "")
      .split(SENTENCE_SPLIT)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 20 && sentence.length <= 500),
  ).slice(0, Math.max(1, input.count));
  const questions: QuizQuestion[] = sentences.map((sentence, index) => {
    const definition = sentence.match(/^([^:–—-]{2,80})\s*[:–—-]\s*(.{8,})$/);
    const prompt = definition
      ? `Wyjaśnij pojęcie: ${definition[1].trim()}`
      : `Wyjaśnij własnymi słowami: ${sentence.split(/\s+/).slice(0, 7).join(" ")}…`;
    const answer = definition?.[2].trim() ?? sentence;
    const distractors = sentences
      .filter((item) => item !== sentence)
      .map((item) => item.match(/^([^:–—-]{2,80})\s*[:–—-]\s*(.{8,})$/)?.[2]?.trim() ?? item)
      .slice(index % Math.max(1, sentences.length - 1), index % Math.max(1, sentences.length - 1) + 3);
    const options = input.kind === "practice" && distractors.length >= 2
      ? shuffleDeterministic([answer, ...distractors.slice(0, 3)], sentence)
      : undefined;
    return {
      id: createId(),
      prompt,
      answer,
      options,
      explanation: `Odpowiedź pochodzi z materiału „${input.title}”.`,
      topic: definition?.[1].trim() ?? input.title,
    };
  });
  const now = new Date().toISOString();
  const quiz: StudyQuiz = {
    id: createId(),
    title: input.title.trim() || "Quiz z notatki",
    kind: input.kind,
    subjectId: input.subjectId,
    sourceMaterialId: input.sourceMaterialId,
    questions,
    timeLimitMinutes: Math.max(
      1,
      input.timeLimitMinutes ?? (input.kind === "mock-exam" ? questions.length * 2 : 15),
    ),
    createdAt: now,
    updatedAt: now,
  };
  return quiz;
}

export function quizFromFlashcards(
  cards: Flashcard[],
  title: string,
  kind: StudyQuiz["kind"],
  limit = 20,
) {
  const now = new Date().toISOString();
  const questions = cards.slice(0, Math.max(1, limit)).map<QuizQuestion>((card) => ({
    id: createId(),
    prompt: card.front,
    answer: card.back,
    options: card.kind === "multiple-choice" ? card.choices : undefined,
    topic: card.tags?.[0] ?? card.deck,
  }));
  return {
    id: createId(),
    title,
    kind,
    subjectId: cards[0]?.subjectId,
    questions,
    timeLimitMinutes: Math.max(1, kind === "mock-exam" ? questions.length * 2 : 15),
    createdAt: now,
    updatedAt: now,
  } satisfies StudyQuiz;
}

export function answersMatch(actual: string, expected: string) {
  const first = normalizeAnswer(actual);
  const second = normalizeAnswer(expected);
  if (!first || !second) return false;
  if (first === second || first.includes(second) || second.includes(first)) return true;
  const expectedWords = new Set(second.split(" ").filter((word) => word.length > 3));
  if (!expectedWords.size) return false;
  const actualWords = new Set(first.split(" ").filter((word) => word.length > 3));
  const overlap = [...expectedWords].filter((word) => actualWords.has(word)).length;
  if (overlap / expectedWords.size >= 0.3) return true;

  // Short answers often differ only by Polish inflection (e.g. “potomne”
  // vs “potomnych”). Compare lightweight stems as a forgiving final pass.
  const stem = (word: string) =>
    word.replace(/(ami|owie|owego|owych|owej|owym|ych|ego|emu|om|ą|ie|em|owi|a|e|y|i)$/u, "");
  const expectedStems = new Set([...expectedWords].map(stem));
  const actualStems = new Set([...actualWords].map(stem));
  const stemOverlap = [...expectedStems].filter((word) => actualStems.has(word)).length;
  return stemOverlap / expectedStems.size >= 0.3;
}

export function recommendedReviewTopics(input: {
  subjects: { id: string; name: string; mastery: number; topics: { name: string; mastery: number }[] }[];
  mistakes: { subjectId?: string; topic: string; status: "active" | "resolved"; count: number }[];
  cards: Flashcard[];
}) {
  const scores = new Map<string, { label: string; score: number; reason: string }>();
  for (const subject of input.subjects) {
    for (const topic of subject.topics) {
      if (topic.mastery >= 75) continue;
      scores.set(`${subject.id}:${topic.name}`, {
        label: `${subject.name}: ${topic.name}`,
        score: 100 - topic.mastery,
        reason: `opanowanie ${topic.mastery}%`,
      });
    }
  }
  for (const mistake of input.mistakes) {
    if (mistake.status !== "active") continue;
    const key = `${mistake.subjectId ?? "general"}:${mistake.topic}`;
    const current = scores.get(key);
    scores.set(key, {
      label: mistake.topic,
      score: (current?.score ?? 20) + mistake.count * 12,
      reason: `${mistake.count} ${mistake.count === 1 ? "błąd" : "błędy"}`,
    });
  }
  for (const card of input.cards) {
    if ((card.lapses ?? 0) < 2) continue;
    const topic = card.tags?.[0] ?? card.deck ?? "Fiszki";
    const key = `${card.subjectId ?? "general"}:${topic}`;
    const current = scores.get(key);
    scores.set(key, {
      label: topic,
      score: (current?.score ?? 15) + (card.lapses ?? 0) * 5,
      reason: `trudne fiszki: ${card.lapses ?? 0} pomyłek`,
    });
  }
  return [...scores.values()].sort((first, second) => second.score - first.score).slice(0, 12);
}

function normalizeAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .replace(/[^a-z0-9ąćęłńóśźż\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function shuffleDeterministic<T>(values: T[], seed: string) {
  let state = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 17);
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
