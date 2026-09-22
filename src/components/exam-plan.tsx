"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Check, ChevronDown } from "lucide-react";
import { buildExamPlan, type ExamPlanDay } from "@/lib/exam-plan";
import { createId } from "@/lib/ids";
import type { Exam, WorkspaceState } from "@/lib/types";

type UpdateWorkspace = (recipe: (state: WorkspaceState) => WorkspaceState) => void;

export function ExamPlanView({ exam, state, onUpdate }: { exam: Exam; state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(() => buildExamPlan(state, exam), [state, exam]);
  const visible = plan.days.slice(0, expanded ? 28 : 7);

  function toggleTopic(topic: string) {
    onUpdate((current) => ({ ...current, exams: current.exams.map((item) => item.id === exam.id ? {
      ...item,
      completedTopics: (item.completedTopics ?? []).includes(topic)
        ? (item.completedTopics ?? []).filter((name) => name !== topic)
        : [...(item.completedTopics ?? []), topic],
      updatedAt: new Date().toISOString(),
    } : item) }));
  }

  function addDay(day: ExamPlanDay) {
    onUpdate((current) => {
      const date = new Date(`${day.date}T00:00:00`);
      const first = new Date(date);
      first.setHours(current.settings.workdayStartHour, 0, 0, 0);
      const existingEnd = current.calendar.filter((block) => new Date(block.start).toDateString() === date.toDateString())
        .reduce((latest, block) => Math.max(latest, Date.parse(block.end) || 0), first.getTime());
      let cursor = existingEnd;
      const additions = day.items.filter((item) => !current.calendar.some((block) => block.sourceExamId === exam.id && block.sourceItemId === `${day.date}:${item.id}`))
        .map((item) => {
          const start = new Date(cursor);
          cursor += item.minutes * 60_000;
          return { id: createId(), title: item.title, start: start.toISOString(), end: new Date(cursor).toISOString(),
            taskId: item.taskId, sourceExamId: exam.id, sourceItemId: `${day.date}:${item.id}`, done: false };
        });
      return { ...current, calendar: [...current.calendar, ...additions] };
    });
  }

  return (
    <section className="exam-plan" aria-label={`Plan przygotowań: ${exam.title}`}>
      <div className="exam-plan-head">
        <div><strong>Plan przygotowań</strong><small>Od dziś do egzaminu · przelicza się po każdym dniu i ukończonym zadaniu</small></div>
        <label>Budżet dzienny <input type="number" min="15" max="240" step="5" value={exam.dailyMinutes ?? 45}
          onChange={(event) => { const minutes = Math.min(240, Math.max(15, Number(event.target.value) || 15)); onUpdate((current) => ({ ...current, exams: current.exams.map((item) => item.id === exam.id ? { ...item, dailyMinutes: minutes, updatedAt: new Date().toISOString() } : item) })); }} /> min</label>
      </div>
      <p className="exam-plan-summary">Pozostało {plan.remainingTopics} tematów i {plan.remainingTasks} zadań. {plan.unscheduledMinutes > 0 ? `Brakuje około ${plan.unscheduledMinutes} min w dostępnym czasie — zwiększ budżet lub ogranicz zakres.` : "Zakres mieści się w planie."}</p>
      {plan.days.length ? <div className="exam-plan-days">{visible.map((day) => (
        <article key={day.date} className="exam-plan-day">
          <header><strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" })}</strong><span>{day.minutes} min</span></header>
          {day.items.length ? <ul>{day.items.map((item) => <li key={item.id}>
            {item.kind === "topic" ? <button type="button" aria-label={`Ukończ temat ${item.title}`} onClick={() => toggleTopic(item.topic!)}><Check size={14} /></button> : <span className="exam-plan-dot" />}
            <span>{item.title}<small>{item.kind === "review" ? "Powtórka FSRS" : item.kind === "task" ? "Zadanie" : "Temat"} · {item.minutes} min</small></span>
          </li>)}</ul> : <p>Bufor na odpoczynek lub nadrobienie materiału.</p>}
          {day.items.length ? <button type="button" className="button button-quiet" onClick={() => addDay(day)}><CalendarPlus size={14} /> Dodaj dzień do planera</button> : null}
        </article>
      ))}</div> : <p>Termin egzaminu minął. Zmień datę lub utwórz nowy plan.</p>}
      {plan.days.length > 7 ? <button type="button" className="button button-quiet" onClick={() => setExpanded((value) => !value)}><ChevronDown size={15} /> {expanded ? "Pokaż mniej" : "Pokaż kolejne dni"}</button> : null}
      {(exam.completedTopics ?? []).length ? <div className="exam-completed-topics"><small>Opanowane tematy:</small>{(exam.completedTopics ?? []).map((topic) => <button key={topic} type="button" onClick={() => toggleTopic(topic)}>{topic} · Cofnij</button>)}</div> : null}
    </section>
  );
}
