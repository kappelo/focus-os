import { describe, expect, it } from "vitest";
import { adaptiveFocusMinutes, gradeFlashcard, sessionQuality, smartStart } from "@/lib/algorithms";
import type { Flashcard, Task } from "@/lib/types";

const task = (changes: Partial<Task>): Task => ({
  id: crypto.randomUUID(), title: "Task", description: "", topic: "", priority: 1,
  difficulty: 3, estimateMinutes: 25, actualMinutes: 0, plannedPomodoros: 1,
  completedPomodoros: 0, status: "todo", tags: [], subtasks: [], recurring: "none",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...changes,
});

describe("productivity algorithms", () => {
  it("prioritizes an overdue high priority task", () => {
    const overdue = task({ priority: 3, deadline: new Date(Date.now() - 60_000).toISOString() });
    const later = task({ priority: 1, deadline: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    expect(smartStart([later, overdue], 30, 3)?.id).toBe(overdue.id);
  });

  it("schedules a successful flashcard farther into the future", () => {
    const card: Flashcard = { id: crypto.randomUUID(), front: "a", back: "b", dueAt: new Date().toISOString(), intervalDays: 6, ease: 2.5, repetitions: 2 };
    expect(gradeFlashcard(card, 3).intervalDays).toBeGreaterThan(6);
  });

  it("keeps session quality in the 0-100 range", () => {
    expect(sessionQuality({ durationMinutes: 25, plannedMinutes: 25, distractions: [], goalCompleted: true, selfRating: 5 })).toBe(100);
  });

  it("shortens focus when energy is low", () => {
    expect(adaptiveFocusMinutes([], 1, 50)).toBeLessThan(adaptiveFocusMinutes([], 5, 50));
  });
});
