import { describe, expect, it } from "vitest";
import { gradeMistake, hasMistakeFlashcard, mistakePracticeQueue } from "@/lib/mistake-practice";
import type { MistakeEntry } from "@/lib/types";

const item: MistakeEntry = { id: "m", question: "Ile to 2+2?", correctAnswer: "4", userAnswer: "5", topic: "Arytmetyka",
  count: 1, status: "active", nextReviewAt: "2026-09-20T12:00:00Z", createdAt: "2026-09-20T12:00:00Z", updatedAt: "2026-09-20T12:00:00Z" };

describe("mistake practice", () => {
  it("prioritizes due mistakes and limits a short session", () => {
    const later = { ...item, id: "later", nextReviewAt: "2026-10-01T12:00:00Z" };
    expect(mistakePracticeQueue([later, item], Date.parse("2026-09-22T12:00:00Z"), 1).map((entry) => entry.id)).toEqual(["m"]);
  });
  it("resolves only after two correct attempts and reopens after a miss", () => {
    const once = gradeMistake(item, "cztery", true, new Date("2026-09-22T12:00:00Z"));
    expect(once.status).toBe("active");
    expect(once.correctStreak).toBe(1);
    expect(gradeMistake(once, "4", true).status).toBe("resolved");
    expect(gradeMistake(once, "5", false).correctStreak).toBe(0);
  });
  it("does not create a duplicate card for the same question", () => {
    expect(hasMistakeFlashcard([{ id: "f", front: item.question, back: item.correctAnswer, dueAt: "", intervalDays: 0, ease: 2.5, repetitions: 0 }], item)).toBe(true);
  });
});
