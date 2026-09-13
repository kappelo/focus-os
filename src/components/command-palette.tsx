"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Modal } from "@/components/modal";
import { createId } from "@/lib/ids";
import type { ViewId, WorkspaceState } from "@/lib/types";

const commands: { label: string; hint: string; view: ViewId }[] = [
  { label: "Przejdź do pulpitu", hint: "Podsumowanie dnia", view: "home" },
  { label: "Dodaj lub wybierz zadanie", hint: "Lista i kolejka Focus", view: "tasks" },
  { label: "Rozpocznij sesję skupienia", hint: "Timer i soundscape", view: "focus" },
  { label: "Zrób dzisiejsze powtórki", hint: "Fiszki i Active Recall", view: "learn" },
  { label: "Zaplanuj blok czasu", hint: "Kalendarz i timeline", view: "planner" },
  { label: "Otwórz analitykę i ustawienia", hint: "Wnioski, nawyki, egzaminy", view: "more" },
];

export function CommandPalette({ state, onUpdate, onClose, onNavigate }: { state: WorkspaceState; onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void; onClose: () => void; onNavigate: (view: ViewId) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const dynamic = [
      ...commands.map((item) => ({ ...item, key: `command:${item.view}` })),
      ...state.tasks.map((item) => ({ key: `task:${item.id}`, label: item.title, hint: `Zadanie · ${item.topic || "bez tematu"}`, view: "tasks" as const })),
      ...state.flashcards.map((item) => ({ key: `card:${item.id}`, label: item.front, hint: `Fiszka · ${item.deck ?? "Ogólne"}`, view: "learn" as const })),
      ...state.materials.map((item) => ({ key: `material:${item.id}`, label: item.title, hint: `Materiał · ${item.type.toUpperCase()}`, view: "learn" as const })),
      ...state.projects.map((item) => ({ key: `project:${item.id}`, label: item.title, hint: "Projekt nauki", view: "more" as const })),
      ...state.exams.map((item) => ({ key: `exam:${item.id}`, label: item.title, hint: `Egzamin · ${new Date(item.date).toLocaleDateString("pl-PL")}`, view: "more" as const })),
    ];
    const needle = query.trim().toLocaleLowerCase("pl");
    return dynamic.filter((command) => `${command.label} ${command.hint}`.toLocaleLowerCase("pl").includes(needle)).slice(0, 30);
  }, [query, state.exams, state.flashcards, state.materials, state.projects, state.tasks]);

  function quickTask() {
    const title = query.trim();
    if (!title) return;
    const now = new Date().toISOString();
    onUpdate((current) => ({
      ...current,
      tasks: [{
        id: createId(), title, description: "", subjectId: current.settings.defaultSubjectId || undefined,
        topic: "", priority: current.settings.defaultTaskPriority, difficulty: current.settings.defaultTaskDifficulty,
        estimateMinutes: current.settings.defaultTaskEstimate, actualMinutes: 0,
        plannedPomodoros: Math.max(1, Math.ceil(current.settings.defaultTaskEstimate / 25)), completedPomodoros: 0,
        status: "todo", tags: [], subtasks: [], recurring: current.settings.defaultTaskRecurring,
        dependsOn: [], createdAt: now, updatedAt: now,
      }, ...current.tasks],
    }));
    onNavigate("tasks");
    onClose();
  }
  return (
    <Modal title="Szybkie działania" onClose={onClose} wide>
      <div className="command-search"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wpisz polecenie…" /></div>
      <div className="command-list">
        {query.trim() ? (
          <button className="command-create" onClick={quickTask}><span><strong>Dodaj zadanie „{query.trim()}”</strong><small>Szybkie dodawanie · Enter po wybraniu</small></span><Plus size={17} /></button>
        ) : null}
        {filtered.map((command) => (
          <button key={command.key} onClick={() => { onNavigate(command.view); onClose(); }}>
            <span><strong>{command.label}</strong><small>{command.hint}</small></span><ArrowRight size={17} />
          </button>
        ))}
      </div>
    </Modal>
  );
}
