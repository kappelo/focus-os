import { localDateKey } from "@/lib/dates";
import type { Exam, WorkspaceState } from "@/lib/types";

export type ExamPlanItem = {
  id: string;
  kind: "topic" | "task" | "review";
  title: string;
  minutes: number;
  taskId?: string;
  topic?: string;
  dueCards?: number;
};

export type ExamPlanDay = { date: string; items: ExamPlanItem[]; minutes: number };
export type ExamPlan = {
  days: ExamPlanDay[];
  remainingTopics: number;
  remainingTasks: number;
  unscheduledMinutes: number;
  overdueCards: number;
};

/** A suggestion rebuilt from current progress; it never writes calendar blocks. */
export function buildExamPlan(state: WorkspaceState, exam: Exam, today = new Date()): ExamPlan {
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const examDate = new Date(exam.date);
  const last = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
  const subjects = new Set(exam.subjectIds);
  const matches = (subjectId?: string) => !subjects.size || Boolean(subjectId && subjects.has(subjectId));
  const topics = [...new Set(exam.topics.map((item) => item.trim()).filter(Boolean))]
    .filter((topic) => !(exam.completedTopics ?? []).includes(topic));
  const tasks = state.tasks.filter((task) => task.status !== "done" && !task.archivedAt && matches(task.subjectId))
    .map((task) => ({ task, remaining: Math.max(5, task.estimateMinutes - task.actualMinutes) }))
    .sort((a, b) => (a.task.deadline ?? exam.date).localeCompare(b.task.deadline ?? exam.date));
  const due = state.flashcards.filter((card) => !card.suspended && matches(card.subjectId) && Number.isFinite(Date.parse(card.dueAt)));
  const overdueCards = due.filter((card) => Date.parse(card.dueAt) < first.getTime()).length;
  const days: ExamPlanDay[] = [];
  const dailyBudget = Math.min(240, Math.max(15, Math.round(exam.dailyMinutes ?? 45)));
  let topicIndex = 0;
  let taskIndex = 0;
  if (!Number.isFinite(last.getTime()) || last < first) return {
    days, remainingTopics: topics.length, remainingTasks: tasks.length,
    unscheduledMinutes: topics.length * 25 + tasks.reduce((sum, item) => sum + item.remaining, 0), overdueCards,
  };

  // Dates advance as calendar days to avoid DST changing the count.
  for (const cursor = new Date(first); cursor <= last && days.length < 366; cursor.setDate(cursor.getDate() + 1)) {
    const date = localDateKey(cursor);
    const items: ExamPlanItem[] = [];
    let available = dailyBudget;
    const cards = due.filter((card) => localDateKey(card.dueAt) === date || (date === localDateKey(first) && Date.parse(card.dueAt) < first.getTime()));
    if (cards.length) {
      const minutes = Math.min(available, Math.max(5, Math.ceil(cards.length / 2)));
      items.push({ id: `review-${date}`, kind: "review", title: `${cards.length} fiszek do powtórki`, minutes, dueCards: cards.length });
      available -= minutes;
    }
    // Exam day is for due reviews; do not place a new chapter on the exam morning.
    if (cursor < last) {
      while (available >= 15 && (topicIndex < topics.length || taskIndex < tasks.length)) {
        if (topicIndex < topics.length) {
          const topic = topics[topicIndex++];
          const minutes = Math.min(25, available);
          items.push({ id: `topic-${encodeURIComponent(topic)}`, kind: "topic", title: topic, topic, minutes });
          available -= minutes;
        }
        if (available < 5 || taskIndex >= tasks.length) continue;
        const entry = tasks[taskIndex];
        const minutes = Math.min(available, entry.remaining);
        items.push({ id: `task-${entry.task.id}-${date}`, kind: "task", title: entry.task.title, taskId: entry.task.id, minutes });
        available -= minutes;
        entry.remaining -= minutes;
        if (entry.remaining <= 0) taskIndex++;
      }
    }
    days.push({ date, items, minutes: dailyBudget - available });
  }
  return {
    days,
    remainingTopics: topics.length,
    remainingTasks: tasks.length,
    unscheduledMinutes: (topics.length - topicIndex) * 25 + tasks.slice(taskIndex).reduce((sum, item) => sum + item.remaining, 0),
    overdueCards,
  };
}
