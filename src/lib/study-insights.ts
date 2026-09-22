import type { WorkspaceState } from "@/lib/types";

export function planVsActual(state: WorkspaceState) {
  const measured = state.tasks.filter((task) => task.status === "done" && task.estimateMinutes > 0 && task.actualMinutes > 0);
  const estimated = measured.reduce((sum, task) => sum + task.estimateMinutes, 0);
  const actual = measured.reduce((sum, task) => sum + task.actualMinutes, 0);
  const ratios = measured.map((task) => task.actualMinutes / task.estimateMinutes).sort((a, b) => a - b);
  const middle = Math.floor(ratios.length / 2);
  const medianRatio = ratios.length ? ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2 : null;
  const adjustment = ratios.length >= 3 && medianRatio !== null ? Math.min(2, Math.max(0.5, medianRatio)) : null;
  const pending = state.tasks.filter((task) => task.status !== "done" && !task.archivedAt);
  return {
    completedCount: measured.length,
    estimated,
    actual,
    difference: actual - estimated,
    adjustment,
    pendingEstimate: pending.reduce((sum, task) => sum + Math.max(0, task.estimateMinutes - task.actualMinutes), 0),
  };
}

export type SubjectInsight = {
  id: string;
  name: string;
  color: string;
  focusMinutes: number;
  quizAverage: number | null;
  quizCount: number;
  dueCards: number;
  activeMistakes: number;
  openTasks: number;
};

export function subjectInsights(state: WorkspaceState, now = Date.now(), days = 30): SubjectInsight[] {
  const since = now - days * 86_400_000;
  return state.subjects.map((subject) => {
    const quizIds = new Set(state.quizzes.filter((quiz) => quiz.subjectId === subject.id).map((quiz) => quiz.id));
    const attempts = state.quizAttempts.filter((attempt) => quizIds.has(attempt.quizId) && Date.parse(attempt.endedAt) >= since);
    const focusMinutes = state.sessions.filter((session) => session.subjectId === subject.id && Date.parse(session.startedAt) >= since)
      .reduce((sum, session) => sum + session.durationMinutes, 0);
    return {
      id: subject.id, name: subject.name, color: subject.color, focusMinutes,
      quizAverage: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : null,
      quizCount: attempts.length,
      dueCards: state.flashcards.filter((card) => card.subjectId === subject.id && !card.suspended && Date.parse(card.dueAt) <= now).length,
      activeMistakes: state.mistakes.filter((item) => item.subjectId === subject.id && item.status === "active").length,
      openTasks: state.tasks.filter((task) => task.subjectId === subject.id && task.status !== "done" && !task.archivedAt).length,
    };
  }).sort((a, b) => b.activeMistakes - a.activeMistakes || b.dueCards - a.dueCards || a.name.localeCompare(b.name));
}
