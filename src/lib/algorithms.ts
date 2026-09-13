import type { Flashcard, FocusSession, Task } from "@/lib/types";
import { createId } from "@/lib/ids";
import { reviewWithFsrs } from "@/lib/fsrs";

export function smartStart(tasks: Task[], availableMinutes: number, energy: number) {
  const now = Date.now();
  return tasks
    .filter((task) => task.status !== "done" && !task.archivedAt &&
      !(task.dependsOn ?? []).some((id) => tasks.some((other) => other.id === id && other.status !== "done")))
    .map((task) => {
      const hoursToDeadline = task.deadline
        ? Math.max(0.25, (new Date(task.deadline).getTime() - now) / 3_600_000)
        : 240;
      const urgency = Math.min(45, 120 / hoursToDeadline);
      const priority = task.priority * 13;
      const overdue = task.deadline && new Date(task.deadline).getTime() < now ? 28 : 0;
      const fit = task.estimateMinutes <= availableMinutes ? 12 : -Math.min(18, (task.estimateMinutes - availableMinutes) / 5);
      const energyFit = 12 - Math.abs(task.difficulty - energy) * 4;
      const estimationLearning = task.actualMinutes > 0
        ? Math.max(-6, 6 - Math.abs(task.actualMinutes - task.estimateMinutes) / 10)
        : 0;
      return { task, score: urgency + priority + overdue + fit + energyFit + estimationLearning };
    })
    .sort((a, b) => b.score - a.score)[0]?.task ?? null;
}

export function gradeFlashcard(card: Flashcard, grade: 0 | 1 | 2 | 3): Flashcard {
  return reviewWithFsrs(card, grade).card;
}

export function sessionQuality(input: Pick<FocusSession, "durationMinutes" | "plannedMinutes" | "distractions" | "goalCompleted" | "selfRating">) {
  const completion = input.goalCompleted ? 30 : 8;
  const distraction = Math.max(0, 25 - input.distractions.length * 5);
  const ratio = Math.min(input.durationMinutes, input.plannedMinutes) / Math.max(1, input.plannedMinutes);
  const plan = Math.round(ratio * 25);
  const rating = input.selfRating * 4;
  return Math.max(0, Math.min(100, completion + distraction + plan + rating));
}

export function adaptiveBreak(sessions: FocusSession[]) {
  const recent = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8);
  if (!recent.length) return 5;
  const averageQuality = recent.reduce((sum, session) => sum + session.quality, 0) / recent.length;
  const averageEnergy = recent.reduce((sum, session) => sum + session.energy, 0) / recent.length;
  if (averageQuality < 55 || averageEnergy < 2.5) return 12;
  if (averageQuality > 82 && averageEnergy > 3.5) return 5;
  return 8;
}

export function adaptiveFocusMinutes(
  sessions: FocusSession[],
  energy: number,
  baseMinutes = 25,
) {
  const recent = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 10);
  const averageQuality = recent.length
    ? recent.reduce((sum, session) => sum + session.quality, 0) / recent.length
    : 70;
  const energyFactor = energy <= 2 ? 0.65 : energy === 3 ? 0.9 : energy === 4 ? 1.1 : 1.25;
  const qualityFactor = averageQuality < 55 ? 0.8 : averageQuality > 82 ? 1.15 : 1;
  return Math.min(90, Math.max(10, Math.round((baseMinutes * energyFactor * qualityFactor) / 5) * 5));
}

export function predictedFinish(tasks: Task[]) {
  const minutes = tasks
    .filter((task) => task.status !== "done")
    .reduce((sum, task) => sum + Math.max(0, task.estimateMinutes - task.actualMinutes), 0);
  return new Date(Date.now() + minutes * 60_000).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export function exportIcs(title: string, start: string, end: string) {
  const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(".000", "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Focus OS//PL",
    "BEGIN:VEVENT",
    `UID:${createId()}@focus-os`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title.replace(/[,;\\]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
