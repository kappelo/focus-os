import { describe, expect, it } from "vitest";
import { intervalForRetention, memoryProbability, reviewWithFsrs } from "@/lib/fsrs";
import type { Flashcard } from "@/lib/types";

const card: Flashcard = {
  id: "card-1",
  front: "Pytanie",
  back: "Odpowiedź",
  dueAt: "2026-01-01T00:00:00.000Z",
  intervalDays: 0,
  ease: 2.5,
  repetitions: 0,
};

describe("FSRS", () => {
  it("schedules easy new cards further than hard cards", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const hard = reviewWithFsrs(card, 1, 3, 1_000, now).card;
    const easy = reviewWithFsrs(card, 3, 5, 800, now).card;
    expect(easy.intervalDays).toBeGreaterThan(hard.intervalDays);
  });

  it("records confidence and response time", () => {
    const result = reviewWithFsrs(card, 2, 4, 1_234, new Date("2026-01-01T10:00:00.000Z"));
    expect(result.review).toMatchObject({ cardId: "card-1", confidence: 4, responseMs: 1234 });
    expect(result.card.fsrs?.state).toBe("review");
  });

  it("models forgetting over time", () => {
    const reviewed = reviewWithFsrs(card, 2, 3, 500, new Date("2026-01-01T00:00:00.000Z")).card;
    expect(memoryProbability(reviewed, new Date("2026-01-02T00:00:00.000Z").getTime()))
      .toBeGreaterThan(memoryProbability(reviewed, new Date("2026-02-01T00:00:00.000Z").getTime()));
    expect(intervalForRetention(10)).toBeGreaterThan(1);
  });
});
