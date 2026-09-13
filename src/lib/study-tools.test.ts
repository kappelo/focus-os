import { describe, expect, it } from "vitest";
import { answersMatch, generateQuizFromText, recommendedReviewTopics } from "@/lib/study-tools";

describe("study tools", () => {
  it("generates a stored quiz from definitions", () => {
    const quiz = generateQuizFromText({
      title: "Biologia",
      text: "Mitoza: podział komórki prowadzący do powstania dwóch komórek potomnych. Mejoza: podział redukcyjny prowadzący do gamet.",
      count: 5,
      kind: "practice",
    });
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0]?.prompt).toContain("Mitoza");
  });

  it("accepts semantically overlapping short answers", () => {
    expect(answersMatch("Podział komórki na dwie komórki potomne", "Podział komórki prowadzący do powstania dwóch komórek potomnych")).toBe(true);
  });

  it("prioritizes repeated mistakes", () => {
    const topics = recommendedReviewTopics({
      subjects: [],
      cards: [],
      mistakes: [
        { topic: "Funkcje", status: "active", count: 1 },
        { topic: "Genetyka", status: "active", count: 4 },
      ],
    });
    expect(topics[0]?.label).toBe("Genetyka");
  });
});
