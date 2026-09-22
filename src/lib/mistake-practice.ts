import type { Flashcard, MistakeEntry } from "@/lib/types";

export function mistakePracticeQueue(mistakes: MistakeEntry[], now = Date.now(), limit = 8) {
  return mistakes.filter((item) => item.status === "active")
    .sort((first, second) => {
      const firstDue = Date.parse(first.nextReviewAt) || 0;
      const secondDue = Date.parse(second.nextReviewAt) || 0;
      return (firstDue <= now ? 0 : 1) - (secondDue <= now ? 0 : 1) || firstDue - secondDue || second.count - first.count;
    })
    .slice(0, Math.max(0, limit));
}

/** Free-text answers are self-graded after reveal; exact string equality is not reliable. */
export function gradeMistake(mistake: MistakeEntry, answer: string, correct: boolean, now = new Date()): MistakeEntry {
  const streak = correct ? (mistake.correctStreak ?? 0) + 1 : 0;
  const next = new Date(now);
  next.setDate(next.getDate() + (correct ? 3 : 1));
  return {
    ...mistake,
    userAnswer: answer.trim(),
    count: mistake.count + (correct ? 0 : 1),
    reviewCount: (mistake.reviewCount ?? 0) + 1,
    correctStreak: streak,
    status: streak >= 2 ? "resolved" : "active",
    nextReviewAt: next.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function hasMistakeFlashcard(cards: Flashcard[], mistake: MistakeEntry) {
  return cards.some((card) => card.sourceMistakeId === mistake.id ||
    (card.front.trim().toLocaleLowerCase() === mistake.question.trim().toLocaleLowerCase() &&
      card.back.trim().toLocaleLowerCase() === mistake.correctAnswer.trim().toLocaleLowerCase()));
}
