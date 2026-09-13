import { smartStart } from "@/lib/algorithms";
import { localDateKey } from "@/lib/dates";
import type { WorkspaceState } from "@/lib/types";

export type StudyPlanStep = {
  id: string; kind: "review" | "task"; title: string;
  reason: string; minutes: number; taskId?: string;
};

/** Suggest blocks within the budget; never claim that time spent equals mastery. */
export function buildStudyPlan(state: WorkspaceState, budget: number, energy: number, now = Date.now()): StudyPlanStep[] {
  let remaining = Math.max(0, Math.min(240, Number.isFinite(budget) ? Math.floor(budget) : 0));
  const steps: StudyPlanStep[] = [];
  const due = state.flashcards.filter((card) => !card.suspended && Date.parse(card.dueAt) <= now).length;
  if (due && remaining >= 5) {
    const minutes = Math.min(15, Math.max(5, Math.ceil(due / 2)), remaining);
    steps.push({ id: "reviews", kind: "review", title: "Odtwórz z pamięci", reason: `${due} fiszek czeka na powtórkę. Najpierw odpowiedz, potem odkryj rozwiązanie.`, minutes });
    remaining -= minutes;
  }
  const chosen = new Set<string>();
  while (remaining >= 5 && steps.length < 4) {
    // Keep dependencies in the input: selecting a task must not unlock its dependants.
    const task = smartStart(state.tasks.map((item) => chosen.has(item.id) ? { ...item, archivedAt: "selected" } : item), remaining, energy);
    if (!task) break;
    chosen.add(task.id);
    const minutes = Math.min(remaining, energy <= 2 ? 15 : 40, Math.max(5, task.estimateMinutes - task.actualMinutes));
    steps.push({ id: task.id, kind: "task", taskId: task.id, title: task.title, minutes,
      reason: task.deadline && Date.parse(task.deadline) < now ? "Termin minął — zacznij od jednego małego fragmentu." : "Pracuj bez podglądania notatek, a na końcu sprawdź odpowiedź." });
    remaining -= minutes;
  }
  return steps;
}

export function recentStudyDays(state: WorkspaceState, now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + index);
    const key = localDateKey(date);
    return { key, label: date.toLocaleDateString("pl-PL", { weekday: "short" }),
      minutes: state.sessions.filter((session) => localDateKey(session.startedAt) === key).reduce((sum, session) => sum + session.durationMinutes, 0) };
  });
}
