import { describe, expect, it } from "vitest";
import { createDefaultWorkspace } from "@/lib/default-data";
import {
  mergeWorkspaces,
  migrateWorkspace,
  prepareWorkspaceUpdate,
} from "@/lib/storage";
import type { Task } from "@/lib/types";

function task(id: string, updatedAt: string): Task {
  return {
    id,
    title: `Zadanie ${id}`,
    description: "",
    topic: "",
    priority: 2,
    difficulty: 2,
    estimateMinutes: 25,
    actualMinutes: 0,
    plannedPomodoros: 1,
    completedPomodoros: 0,
    status: "todo",
    tags: [],
    subtasks: [],
    recurring: "none",
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("workspace persistence and device merge", () => {
  it("starts new users with an empty workspace", () => {
    const state = createDefaultWorkspace();
    expect(state.schemaVersion).toBe(5);
    expect(state.tasks).toEqual([]);
    expect(state.flashcards).toEqual([]);
    expect(state.habits).toEqual([]);
  });

  it("keeps independent additions from two devices", () => {
    const first = createDefaultWorkspace();
    const local = {
      ...first,
      version: 2,
      updatedAt: "2026-08-31T09:00:00.000Z",
      tasks: [task("local", "2026-08-31T09:00:00.000Z")],
    };
    const remote = {
      ...createDefaultWorkspace(),
      syncId: first.syncId,
      syncRevision: 4,
      version: 3,
      updatedAt: "2026-08-31T09:01:00.000Z",
      tasks: [task("remote", "2026-08-31T09:01:00.000Z")],
    };
    const merged = mergeWorkspaces(local, remote);
    expect(new Set(merged.tasks.map((item) => item.id))).toEqual(
      new Set(["local", "remote"]),
    );
    expect(merged.syncRevision).toBe(4);
  });

  it("creates deletion tombstones so another device cannot resurrect an item", () => {
    const initial = {
      ...createDefaultWorkspace(),
      version: 2,
      tasks: [task("removed", "2026-08-30T09:00:00.000Z")],
    };
    const deleted = prepareWorkspaceUpdate(
      initial,
      { ...initial, tasks: [] },
      "2026-08-31T10:00:00.000Z",
    );
    expect(deleted.tombstones).toContainEqual({
      collection: "tasks",
      id: "removed",
      deletedAt: "2026-08-31T10:00:00.000Z",
    });

    const staleDevice = {
      ...createDefaultWorkspace(),
      syncId: initial.syncId,
      syncRevision: 7,
      version: 3,
      updatedAt: "2026-08-30T12:00:00.000Z",
      tasks: [task("removed", "2026-08-30T09:00:00.000Z")],
    };
    expect(mergeWorkspaces(deleted, staleDevice).tasks).toEqual([]);
  });

  it("migrates old shortcuts and clamps unsafe numeric settings", () => {
    const migrated = migrateWorkspace({
      settings: {
        shortcutLinks: [
          {
            id: "old-link",
            label: "Plan",
            view: "planner",
          } as never,
        ],
        longBreakAfter: 0,
        workdayStartHour: 23,
        workdayEndHour: 2,
        dashboardShortcutLimit: 99,
      },
    });

    expect(migrated.settings.shortcutLinks[0]).toMatchObject({
      kind: "view",
      view: "planner",
      enabled: true,
    });
    expect(migrated.settings.longBreakAfter).toBe(2);
    expect(migrated.settings.workdayEndHour).toBeGreaterThan(
      migrated.settings.workdayStartHour,
    );
    expect(migrated.settings.dashboardShortcutLimit).toBe(24);
  });
});
