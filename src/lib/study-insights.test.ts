import { describe, expect, it } from "vitest";
import { createDefaultWorkspace } from "@/lib/default-data";
import { planVsActual, subjectInsights } from "@/lib/study-insights";

describe("study insights", () => {
  it("does not invent an estimate recommendation without measured tasks", () => {
    const report = planVsActual(createDefaultWorkspace());
    expect(report.adjustment).toBeNull();
    expect(report.completedCount).toBe(0);
  });
  it("uses a median rather than one extreme task to suggest a new estimate", () => {
    const state = createDefaultWorkspace();
    state.tasks = [30, 35, 180].map((actualMinutes, index) => ({ id: String(index), title: "T", description: "", topic: "", priority: 2 as const,
      difficulty: 3 as const, estimateMinutes: 30, actualMinutes, plannedPomodoros: 1, completedPomodoros: 1,
      status: "done" as const, tags: [], subtasks: [], recurring: "none" as const, createdAt: "2026-09-20", updatedAt: "2026-09-20" }));
    expect(planVsActual(state).adjustment).toBeCloseTo(35 / 30);
  });
  it("combines only matching subject sessions, quizzes and due cards", () => {
    const state = createDefaultWorkspace();
    state.subjects = [{ id: "math", name: "Matematyka", color: "#123456", mastery: 0, topics: [] }];
    state.quizzes = [{ id: "q", title: "Quiz", kind: "practice", subjectId: "math", questions: [], timeLimitMinutes: 0, createdAt: "", updatedAt: "" }];
    state.quizAttempts = [{ id: "a", quizId: "q", startedAt: "2026-09-21", endedAt: "2026-09-21", durationSeconds: 60, score: 70, answers: [], createdAt: "" }];
    state.flashcards = [{ id: "f", subjectId: "math", front: "Q", back: "A", dueAt: "2026-09-20", intervalDays: 1, ease: 2.5, repetitions: 1 }];
    expect(subjectInsights(state, Date.parse("2026-09-22"))[0]).toMatchObject({ quizAverage: 70, dueCards: 1 });
  });
});
