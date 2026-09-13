import { describe, expect, it } from "vitest";
import { createDefaultWorkspace } from "./default-data";
import { activityStreak } from "./progress";
import { buildStudyPlan } from "./study-plan";
import type { Task } from "./types";

const task = (id: string, changes: Partial<Task> = {}): Task => ({
  id, title: id, description: "", topic: "", priority: 2, difficulty: 3,
  estimateMinutes: 30, actualMinutes: 0, plannedPomodoros: 1, completedPomodoros: 0,
  status: "todo", tags: [], subtasks: [], recurring: "none",
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z", ...changes,
});

describe("study dashboard", () => {
  it("does not invent streaks for an empty account", () => {
    expect(activityStreak(createDefaultWorkspace()).streak).toBe(0);
  });
  it("does not extend streaks before the first activity with shields", () => {
    const state = createDefaultWorkspace();
    state.reviewActivity = [{ id: "r", date: "2026-09-13", count: 1, updatedAt: "2026-09-13T12:00:00Z" }];
    expect(activityStreak(state, new Date("2026-09-13T12:00:00")).streak).toBe(1);
  });
  it("uses shields only to bridge actual activity", () => {
    const state = createDefaultWorkspace();
    state.reviewActivity = ["2026-09-11", "2026-09-13"].map((date) => ({ id: date, date, count: 1, updatedAt: date }));
    expect(activityStreak(state, new Date("2026-09-13T12:00:00"))).toMatchObject({ streak: 3, shieldsNeeded: 1 });
  });
  it("fits the budget and keeps blocked tasks blocked after recommending a prerequisite", () => {
    const state = createDefaultWorkspace();
    state.tasks = [task("first"), task("blocked", { dependsOn: ["first"], priority: 3 }), task("archived", { archivedAt: "2026-09-01" }), task("another")];
    const plan = buildStudyPlan(state, 45, 3);
    expect(plan.reduce((sum, step) => sum + step.minutes, 0)).toBeLessThanOrEqual(45);
    expect(plan.map((step) => step.id)).toEqual(["first", "another"]);
  });
  it("ignores suspended cards and invalid budgets", () => {
    const state = createDefaultWorkspace();
    state.flashcards = [{ id: "c", front: "a", back: "b", suspended: true, dueAt: "2000-01-01", intervalDays: 0, ease: 2.5, repetitions: 0 }];
    expect(buildStudyPlan(state, 60, 3)).toEqual([]);
    expect(buildStudyPlan(state, NaN, 3)).toEqual([]);
  });
});
