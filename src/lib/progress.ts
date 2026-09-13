import { localDateKey } from "@/lib/dates";
import type { Task, WeeklyChallenge, WorkspaceState } from "@/lib/types";

export function levelFromXp(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safeXp / 100)) + 1;
  const currentFloor = Math.pow(level - 1, 2) * 100;
  const nextFloor = Math.pow(level, 2) * 100;
  return {
    level,
    progress: Math.round(((safeXp - currentFloor) / Math.max(1, nextFloor - currentFloor)) * 100),
    currentFloor,
    nextFloor,
  };
}

export function challengeProgress(challenge: WeeklyChallenge, state: WorkspaceState) {
  const start = new Date(`${challenge.startDate}T00:00:00`).getTime();
  const end = new Date(`${challenge.endDate}T23:59:59.999`).getTime();
  const inside = (value: string) => {
    const time = new Date(value).getTime();
    return time >= start && time <= end;
  };
  if (challenge.metric === "minutes")
    return state.sessions.filter((item) => inside(item.startedAt)).reduce((sum, item) => sum + item.durationMinutes, 0);
  if (challenge.metric === "sessions")
    return state.sessions.filter((item) => inside(item.startedAt)).length;
  if (challenge.metric === "reviews")
    return state.flashcardReviews.filter((item) => inside(item.reviewedAt)).length;
  return state.tasks.filter((item) => item.status === "done" && inside(item.updatedAt)).length;
}

export function taskQuadrant(task: Task, now = Date.now()): NonNullable<Task["quadrant"]> {
  if (task.quadrant) return task.quadrant;
  const urgent = task.deadline
    ? new Date(task.deadline).getTime() - now <= 3 * 86_400_000
    : false;
  const important = task.priority >= 2;
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "eliminate";
}

export function activityStreak(state: WorkspaceState, now = new Date()) {
  const active = new Set([
    ...state.sessions.map((item) => localDateKey(item.startedAt)),
    ...state.reviewActivity.filter((item) => item.count > 0).map((item) => item.date),
    ...state.tasks.filter((item) => item.status === "done").map((item) => localDateKey(item.updatedAt)),
  ]);
  let streak = 0;
  let shieldsNeeded = 0;
  let pendingGap = 0;
  const availableShields = Math.max(0, state.progress.streakShields - state.progress.usedShields);
  for (let offset = 0; offset < 366; offset += 1) {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    if (active.has(localDateKey(day))) {
      streak += 1 + pendingGap;
      shieldsNeeded += pendingGap;
      pendingGap = 0;
      continue;
    }
    if (offset === 0) continue;
    if (shieldsNeeded + pendingGap < availableShields) {
      pendingGap += 1;
      continue;
    }
    break;
  }
  return { streak, shieldsNeeded, availableShields };
}

export function weekSummary(state: WorkspaceState, weekOffset = 0) {
  const now = new Date();
  const weekday = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - weekday + weekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const inside = (value: string) => {
    const time = new Date(value).getTime();
    return time >= start.getTime() && time < end.getTime();
  };
  return {
    minutes: state.sessions.filter((item) => inside(item.startedAt)).reduce((sum, item) => sum + item.durationMinutes, 0),
    sessions: state.sessions.filter((item) => inside(item.startedAt)).length,
    reviews: state.flashcardReviews.filter((item) => inside(item.reviewedAt)).length,
    tasks: state.tasks.filter((item) => item.status === "done" && inside(item.updatedAt)).length,
  };
}
