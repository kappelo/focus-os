import { describe, expect, it } from "vitest";
import { levelFromXp, taskQuadrant } from "@/lib/progress";
import type { Task } from "@/lib/types";

const base: Task = {
  id: "a", title: "Test", description: "", topic: "", priority: 3,
  difficulty: 2, estimateMinutes: 25, actualMinutes: 0, plannedPomodoros: 1,
  completedPomodoros: 0, status: "todo", tags: [], subtasks: [], recurring: "none",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("progress helpers", () => {
  it("creates predictable XP levels", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(400).level).toBe(3);
  });

  it("places important non-urgent work in schedule", () => {
    expect(taskQuadrant({ ...base, deadline: "2099-01-01T00:00:00.000Z" }, 0)).toBe("schedule");
  });
});
