import { describe, expect, it } from "vitest";
import { createDefaultWorkspace } from "@/lib/default-data";
import { buildExamPlan } from "@/lib/exam-plan";
import type { Exam, Task } from "@/lib/types";

const exam: Exam = { id: "e", title: "Egzamin", date: "2026-09-27T12:00:00Z", subjectIds: ["math"], topics: ["Algebra", "Geometria"], dailyMinutes: 45 };
const task: Task = { id: "t", title: "Zadania", description: "", subjectId: "math", topic: "Algebra", priority: 2, difficulty: 3,
  estimateMinutes: 40, actualMinutes: 0, plannedPomodoros: 1, completedPomodoros: 0, status: "todo", tags: [], subtasks: [], recurring: "none",
  createdAt: "2026-09-20T12:00:00Z", updatedAt: "2026-09-20T12:00:00Z" };

describe("exam plan", () => {
  it("spreads unfinished work across remaining days and keeps the exam day light", () => {
    const state = createDefaultWorkspace();
    state.tasks = [task];
    const plan = buildExamPlan(state, exam, new Date("2026-09-22T12:00:00"));
    expect(plan.days.at(-1)?.date).toBe("2026-09-27");
    expect(plan.days.at(-1)?.items.some((item) => item.kind === "topic")).toBe(false);
    expect(plan.days.flatMap((day) => day.items).filter((item) => item.kind === "topic")).toHaveLength(2);
    expect(plan.unscheduledMinutes).toBe(0);
  });
  it("rebalances after a missed day without writing duplicate tasks", () => {
    const state = createDefaultWorkspace();
    state.tasks = [task];
    const plan = buildExamPlan(state, exam, new Date("2026-09-24T12:00:00"));
    expect(plan.days[0].date).toBe("2026-09-24");
    expect(plan.days.flatMap((day) => day.items).some((item) => item.taskId === "t")).toBe(true);
    expect(state.tasks).toHaveLength(1);
  });
  it("does not schedule completed topics or completed tasks", () => {
    const state = createDefaultWorkspace();
    state.tasks = [{ ...task, status: "done" }];
    const plan = buildExamPlan(state, { ...exam, completedTopics: ["Algebra"] }, new Date("2026-09-22T12:00:00"));
    expect(plan.remainingTopics).toBe(1);
    expect(plan.remainingTasks).toBe(0);
  });
});
