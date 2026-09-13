import { createId } from "@/lib/ids";
import type {
  Flashcard,
  FlashcardReview,
  FsrsMemoryState,
} from "@/lib/types";

const DAY_MS = 86_400_000;
const DESIRED_RETENTION = 0.9;
const DECAY = -0.5;
const FACTOR = 19 / 81;

// FSRS-4.5 default weights. The implementation is local and deterministic so
// a review produces the same schedule on every synchronized device.
const W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18,
  0.05, 0.34, 1.26, 0.29, 2.61,
] as const;

export function retrievability(stability: number, elapsedDays: number) {
  if (stability <= 0) return 0;
  return clamp(
    Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY),
    0,
    1,
  );
}

export function intervalForRetention(
  stability: number,
  retention = DESIRED_RETENTION,
) {
  const interval =
    (Math.max(0.1, stability) / FACTOR) *
    (Math.pow(clamp(retention, 0.7, 0.99), 1 / DECAY) - 1);
  return Math.max(1, Math.min(36_500, Math.round(interval)));
}

export function defaultFsrsState(card?: Partial<Flashcard>): FsrsMemoryState {
  const legacyInterval = Math.max(0, Number(card?.intervalDays) || 0);
  const reviewed = Boolean(card?.lastReviewedAt || (card?.repetitions ?? 0) > 0);
  return {
    difficulty: clamp(11 - (Number(card?.ease) || 2.5) * 2, 1, 10),
    stability: Math.max(0.1, legacyInterval || 0.1),
    state: reviewed ? "review" : "new",
    step: 0,
    scheduledDays: legacyInterval,
    lastReviewAt: card?.lastReviewedAt,
  };
}

export function reviewWithFsrs(
  card: Flashcard,
  grade: 0 | 1 | 2 | 3,
  confidence: 1 | 2 | 3 | 4 | 5 = 3,
  responseMs = 0,
  now = new Date(),
): { card: Flashcard; review: FlashcardReview } {
  const before = card.fsrs ?? defaultFsrsState(card);
  const lastReview = before.lastReviewAt ?? card.lastReviewedAt;
  const elapsedDays = lastReview
    ? Math.max(0, (now.getTime() - new Date(lastReview).getTime()) / DAY_MS)
    : 0;
  const memory = retrievability(before.stability, elapsedDays);
  const rating = grade + 1;
  const difficulty = nextDifficulty(before.difficulty, rating);
  const firstReview = before.state === "new";

  let stability: number;
  let intervalDays: number;
  let state: FsrsMemoryState["state"];
  let step = 0;

  if (firstReview) {
    stability = W[grade];
    if (grade === 0) {
      intervalDays = 10 / 1_440;
      state = "learning";
      step = 1;
    } else {
      intervalDays = grade === 1 ? 1 : intervalForRetention(stability);
      state = "review";
    }
  } else if (grade === 0) {
    stability = Math.max(
      0.1,
      W[11] *
        Math.pow(difficulty, -W[12]) *
        (Math.pow(before.stability + 1, W[13]) - 1) *
        Math.exp(W[14] * (1 - memory)),
    );
    intervalDays = 10 / 1_440;
    state = "relearning";
    step = 1;
  } else {
    const hardPenalty = grade === 1 ? W[15] : 1;
    const easyBonus = grade === 3 ? W[16] : 1;
    stability =
      before.stability *
      (1 +
        Math.exp(W[8]) *
          (11 - difficulty) *
          Math.pow(before.stability, -W[9]) *
          (Math.exp((1 - memory) * W[10]) - 1) *
          hardPenalty *
          easyBonus);
    intervalDays = intervalForRetention(stability);
    // When a card is reviewed immediately after its previous review the
    // FSRS retrievability term is close to 1, which can otherwise produce an
    // unchanged interval. Keep successful reviews moving forward so a card
    // never gets stuck on the same due date.
    const minimumGrowth = Math.ceil(
      Math.max(1, card.intervalDays) * (grade === 3 ? 1.25 : 1.1),
    );
    intervalDays = Math.max(intervalDays, minimumGrowth);
    state = "review";
  }

  stability = clamp(stability, 0.1, 36_500);
  const reviewedAt = now.toISOString();
  const dueAt = new Date(now.getTime() + intervalDays * DAY_MS).toISOString();
  const repetitions = grade === 0 ? 0 : card.repetitions + 1;
  const nextCard: Flashcard = {
    ...card,
    dueAt,
    intervalDays,
    ease: clamp(3 - difficulty / 5, 1.3, 2.8),
    repetitions,
    lastGrade: grade,
    lastReviewedAt: reviewedAt,
    lapses: grade === 0 ? (card.lapses ?? 0) + 1 : (card.lapses ?? 0),
    correctStreak: grade === 0 ? 0 : (card.correctStreak ?? 0) + 1,
    updatedAt: reviewedAt,
    fsrs: {
      difficulty,
      stability,
      state,
      step,
      scheduledDays: intervalDays,
      lastReviewAt: reviewedAt,
    },
  };
  const review: FlashcardReview = {
    id: createId(),
    cardId: card.id,
    subjectId: card.subjectId,
    grade,
    confidence,
    responseMs: Math.max(0, Math.round(responseMs)),
    reviewedAt,
    elapsedDays,
    scheduledDays: intervalDays,
    retrievability: memory,
    stateBefore: before.state,
    createdAt: reviewedAt,
  };
  return { card: nextCard, review };
}

export function memoryProbability(card: Flashcard, now = Date.now()) {
  const memory = card.fsrs ?? defaultFsrsState(card);
  if (memory.state === "new" && card.repetitions <= 0) return 0;
  const reference = memory.lastReviewAt ?? card.lastReviewedAt ?? card.createdAt;
  if (!reference) return card.repetitions ? DESIRED_RETENTION : 0;
  const elapsedDays = Math.max(
    0,
    (now - new Date(reference).getTime()) / DAY_MS,
  );
  return retrievability(memory.stability, elapsedDays);
}

function nextDifficulty(difficulty: number, rating: number) {
  const delta = -W[6] * (rating - 3);
  const meanReverted = W[7] * W[4] + (1 - W[7]) * (difficulty + delta);
  return clamp(meanReverted, 1, 10);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
