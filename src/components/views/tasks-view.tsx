"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  ListFilter,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { SubjectPicker } from "@/components/subject-picker";
import { createId } from "@/lib/ids";
import type { Subject, Task, WorkspaceState } from "@/lib/types";

type WorkspaceUpdater = (
  recipe: (state: WorkspaceState) => WorkspaceState,
) => void;

export function TasksView({
  state,
  onUpdate,
  onStart,
}: {
  state: WorkspaceState;
  onUpdate: WorkspaceUpdater;
  onStart: (taskId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = useMemo(() => {
    const query = search.toLocaleLowerCase("pl");
    return state.tasks
      .filter((task) => {
        if (task.archivedAt) return false;
        if (!state.settings.showCompletedTasks && task.status === "done")
          return false;
        const status =
          filter === "all" ||
          (filter === "done" ? task.status === "done" : task.status !== "done");
        return (
          status &&
          `${task.title} ${task.description} ${task.topic} ${task.tags.join(" ")} ${state.projects.find((project) => project.id === task.projectId)?.title ?? ""}`
            .toLocaleLowerCase("pl")
            .includes(query)
        );
      })
      .sort((first, second) =>
        compareTasks(first, second, state.settings.taskSort),
      );
  }, [
    filter,
    search,
    state.settings.showCompletedTasks,
    state.settings.taskSort,
    state.projects,
    state.tasks,
  ]);

  function toggleDone(task: Task) {
    onUpdate((current) => {
      const liveTask = current.tasks.find((item) => item.id === task.id);
      if (!liveTask) return current;
      const completing = liveTask.status !== "done";
      const awardXp = completing && !current.activityLog.some((entry) => entry.type === "task" && entry.entityId === task.id && entry.xp > 0);
      const now = new Date().toISOString();
      const updated = current.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: (item.status === "done" ? "todo" : "done") as Task["status"],
              updatedAt: now,
            }
          : item,
      );
      const hasNext = current.tasks.some((item) => item.recurrenceSourceId === task.id && item.status !== "done");
      const recurringCopy = completing && task.recurring !== "none" && !hasNext
        ? [{ ...task, id: createId(), status: "todo" as const, actualMinutes: 0, completedPomodoros: 0, subtasks: task.subtasks.map((item) => ({ ...item, id: createId(), done: false })), deadline: nextRecurringDeadline(task.deadline, task.recurring), recurrenceSourceId: task.id, createdAt: now, updatedAt: now }]
        : [];
      return {
        ...current,
        tasks: [...recurringCopy, ...updated],
        progress: awardXp ? { ...current.progress, xp: current.progress.xp + 5 } : current.progress,
        activityLog: awardXp ? [...current.activityLog, { id: createId(), type: "task" as const, description: `Ukończono zadanie: ${task.title}`, xp: 5, entityId: task.id, createdAt: now }].slice(-1000) : current.activityLog,
      };
    });
  }

  function remove(task: Task) {
    if (
      state.settings.confirmBeforeDelete &&
      !window.confirm(`Usunąć zadanie „${task.title}”?`)
    )
      return;
    const deletedAt = new Date().toISOString();
    onUpdate((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== task.id),
      focusQueue: current.focusQueue.filter((taskId) => taskId !== task.id),
      trash: [...current.trash, { id: createId(), collection: "tasks", label: task.title, snapshot: task, deletedAt, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), createdAt: deletedAt }],
    }));
  }

  function createSubject(subject: Subject) {
    onUpdate((current) => ({
      ...current,
      subjects: [...current.subjects, subject],
      settings: {
        ...current.settings,
        defaultSubjectId: current.settings.defaultSubjectId || subject.id,
      },
    }));
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">PLAN → DZIAŁANIE</p>
          <h1>Zadania</h1>
          <p>Estymacje uczą się na podstawie realnego czasu sesji.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setAdding(true)}
        >
          <Plus size={18} /> Nowe zadanie
        </button>
      </section>
      <section className="toolbar panel">
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj zadania, tagu lub tematu…"
          />
        </label>
        <div className="segmented">
          <ListFilter size={16} />
          {(["active", "done", "all"] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              disabled={
                !state.settings.showCompletedTasks && value !== "active"
              }
              onClick={() => setFilter(value)}
            >
              {value === "active"
                ? "Aktywne"
                : value === "done"
                  ? "Gotowe"
                  : "Wszystkie"}
            </button>
          ))}
        </div>
      </section>

      <section className="task-layout">
        <div className="panel task-list-panel">
          <div className="list-heading">
            <span>
              {visible.length} {visible.length === 1 ? "zadanie" : "zadań"}
            </span>
            <small>Przeciągnij zadanie do planera, aby utworzyć blok.</small>
          </div>
          {visible.length ? (
            <div className="task-list">
              {visible.map((task) => {
                const subject = state.subjects.find(
                  (item) => item.id === task.subjectId,
                );
                const isExpanded = expanded === task.id;
                const blockedBy = (task.dependsOn ?? []).filter((id) => state.tasks.find((item) => item.id === id)?.status !== "done");
                const project = state.projects.find((item) => item.id === task.projectId);
                return (
                  <article
                    key={task.id}
                    className={`task-row ${task.status === "done" ? "completed" : ""}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-focus-task",
                        task.id,
                      )
                    }
                  >
                    <button
                      className="task-check"
                      onClick={() => toggleDone(task)}
                      aria-label={
                        task.status === "done"
                          ? "Przywróć zadanie"
                          : "Oznacz jako gotowe"
                      }
                    >
                      {task.status === "done" ? <Check size={15} /> : null}
                    </button>
                    <span
                      className="task-color"
                      style={{ background: subject?.color ?? "#a0a39b" }}
                    />
                    <div className="task-main">
                      <button
                        className="task-title"
                        onClick={() => setExpanded(isExpanded ? null : task.id)}
                      >
                        <span>
                          <strong>{task.title}</strong>
                          <small>
                            {subject?.name ?? "Bez przedmiotu"}
                            {task.topic ? ` · ${task.topic}` : ""}
                            {project ? ` · ${project.title}` : ""}
                          </small>
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={17} />
                        ) : (
                          <ChevronDown size={17} />
                        )}
                      </button>
                      <div className="task-meta">
                        <span className={`priority priority-${task.priority}`}>
                          P{task.priority}
                        </span>
                        <span>
                          <Clock3 size={14} /> {task.actualMinutes}/
                          {task.estimateMinutes} min
                        </span>
                        <span>
                          {task.completedPomodoros}/{task.plannedPomodoros}{" "}
                          pomodoro
                        </span>
                        {task.deadline ? (
                          <time>
                            {new Date(task.deadline).toLocaleString("pl-PL", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        ) : null}
                        {blockedBy.length ? <span className="task-blocked">Oczekuje na {blockedBy.length}</span> : null}
                      </div>
                      <div
                        className="task-progress"
                        aria-label={`Postęp zadania ${task.title}: ${taskProgress(task)}%`}
                      >
                        <span style={{ width: `${taskProgress(task)}%` }} />
                        <small>{taskProgress(task)}% postępu</small>
                      </div>
                      {isExpanded ? (
                        <div className="task-details">
                          <p>{task.description || "Brak dodatkowego opisu."}</p>
                          <div className="tag-row">
                            {task.tags.map((tag) => (
                              <span key={tag}>#{tag}</span>
                            ))}
                          </div>
                          {task.subtasks.map((subtask) => (
                            <button
                              key={subtask.id}
                              onClick={() =>
                                onUpdate((current) => ({
                                  ...current,
                                  tasks: current.tasks.map((item) =>
                                    item.id === task.id
                                      ? {
                                          ...item,
                                          subtasks: item.subtasks.map((sub) =>
                                            sub.id === subtask.id
                                              ? { ...sub, done: !sub.done }
                                              : sub,
                                          ),
                                        }
                                      : item,
                                  ),
                                }))
                              }
                            >
                              {subtask.done ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <Circle size={16} />
                              )}
                              {subtask.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="task-actions">
                      <button
                        className="icon-button play"
                        onClick={() => onStart(task.id)}
                        disabled={blockedBy.length > 0}
                        title={blockedBy.length ? "Najpierw ukończ zależne zadania" : "Rozpocznij skupienie"}
                        aria-label="Rozpocznij skupienie"
                      >
                        <Play size={17} fill="currentColor" />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => remove(task)}
                        aria-label="Usuń zadanie"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Tu jest spokojnie"
              text="Dodaj zadanie albo zmień filtr, by zobaczyć ukończone."
            />
          )}
        </div>
        <aside className="panel focus-queue">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">KOLEJKA FOCUS</p>
              <h2>Następne sesje</h2>
            </div>
            <span>{state.focusQueue.length}</span>
          </div>
          {state.focusQueue.map((id, index) => {
            const task = state.tasks.find((item) => item.id === id);
            return task ? (
              <div className="queue-item" key={id}>
                <b>{index + 1}</b>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.estimateMinutes} min</small>
                </span>
                <button
                  className="icon-button danger"
                  aria-label="Usuń z kolejki"
                  onClick={() =>
                    onUpdate((current) => ({
                      ...current,
                      focusQueue: current.focusQueue.filter(
                        (taskId) => taskId !== id,
                      ),
                    }))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ) : null;
          })}
          {!state.focusQueue.length ? (
            <p className="quiet-copy">
              Uruchom zadanie, a pojawi się tutaj. Po sesji przejdziemy do
              kolejnego.
            </p>
          ) : null}
        </aside>
      </section>
      {adding ? (
        <TaskForm
          state={state}
          onClose={() => setAdding(false)}
          onCreateSubject={createSubject}
          onSubmit={(task) => {
            onUpdate((current) => ({
              ...current,
              tasks: [task, ...current.tasks],
            }));
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TaskForm({
  state,
  onClose,
  onSubmit,
  onCreateSubject,
}: {
  state: WorkspaceState;
  onClose: () => void;
  onSubmit: (task: Task) => void;
  onCreateSubject: (subject: Subject) => void;
}) {
  const preferredSubject = state.subjects.some(
    (subject) => subject.id === state.settings.defaultSubjectId,
  )
    ? state.settings.defaultSubjectId
    : (state.subjects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState(preferredSubject);
  const [topic, setTopic] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(
    state.settings.defaultTaskPriority,
  );
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(
    state.settings.defaultTaskDifficulty,
  );
  const [estimate, setEstimate] = useState(state.settings.defaultTaskEstimate);
  const [tags, setTags] = useState("");
  const [recurring, setRecurring] = useState<Task["recurring"]>(
    state.settings.defaultTaskRecurring,
  );
  const [projectId, setProjectId] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [quadrant, setQuadrant] = useState<NonNullable<Task["quadrant"]>>("schedule");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    onSubmit({
      id: createId(),
      title: title.trim(),
      description: description.trim(),
      subjectId: subjectId || undefined,
      topic: topic.trim(),
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      priority,
      difficulty,
      estimateMinutes: estimate,
      actualMinutes: 0,
      plannedPomodoros: Math.max(1, Math.ceil(estimate / 25)),
      completedPomodoros: 0,
      status: "todo",
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      subtasks: [],
      recurring,
      projectId: projectId || undefined,
      dependsOn,
      quadrant,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <Modal title="Nowe zadanie" onClose={onClose} wide>
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">
          Nazwa
          <input
            autoFocus
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Co chcesz ukończyć?"
          />
        </label>
        <label className="span-2">
          Opis
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Kryterium ukończenia, materiały, kontekst…"
          />
        </label>
        <label>
          Przedmiot
          <SubjectPicker
            subjects={state.subjects}
            value={subjectId}
            onChange={setSubjectId}
            onCreate={onCreateSubject}
          />
        </label>
        <label>
          Temat
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="np. Funkcje"
          />
        </label>
        <label>
          Deadline
          <input
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <label>
          Szacowany czas
          <input
            type="number"
            min="5"
            max="600"
            value={estimate}
            onChange={(event) => setEstimate(Number(event.target.value))}
          />
        </label>
        <label>
          Priorytet
          <select
            value={priority}
            onChange={(event) =>
              setPriority(Number(event.target.value) as 1 | 2 | 3)
            }
          >
            <option value="1">Niski</option>
            <option value="2">Średni</option>
            <option value="3">Wysoki</option>
          </select>
        </label>
        <label>
          Trudność
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)
            }
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Powtarzanie
          <select
            value={recurring}
            onChange={(event) =>
              setRecurring(event.target.value as Task["recurring"])
            }
          >
            <option value="none">Nie powtarzaj</option>
            <option value="daily">Codziennie</option>
            <option value="weekly">Co tydzień</option>
            <option value="monthly">Co miesiąc</option>
          </select>
        </label>
        <label>
          Projekt / folder
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Bez projektu</option>
            {state.projects.filter((project) => project.status === "active").map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}
          </select>
        </label>
        <label>
          Macierz priorytetów
          <select value={quadrant} onChange={(event) => setQuadrant(event.target.value as NonNullable<Task["quadrant"]>)}>
            <option value="do">Zrób teraz</option>
            <option value="schedule">Zaplanuj</option>
            <option value="delegate">Ogranicz / deleguj</option>
            <option value="eliminate">Usuń z planu</option>
          </select>
        </label>
        {state.tasks.some((task) => task.status !== "done") ? (
          <fieldset className="span-2 dependency-picker">
            <legend>Zależności — co trzeba ukończyć wcześniej?</legend>
            {state.tasks.filter((task) => task.status !== "done").slice(0, 20).map((task) => (
              <label key={task.id}><input type="checkbox" checked={dependsOn.includes(task.id)} onChange={(event) => setDependsOn((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} />{task.title}</label>
            ))}
          </fieldset>
        ) : null}
        <label>
          Tagi
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="matura, pilne"
          />
        </label>
        <div className="form-actions span-2">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Anuluj
          </button>
          <button className="button button-primary" type="submit">
            <Plus size={17} /> Dodaj zadanie
          </button>
        </div>
      </form>
    </Modal>
  );
}

function compareTasks(
  first: Task,
  second: Task,
  sort: WorkspaceState["settings"]["taskSort"],
) {
  if (sort === "alphabetical")
    return first.title.localeCompare(second.title, "pl");
  if (sort === "created")
    return second.createdAt.localeCompare(first.createdAt);
  if (sort === "deadline") {
    return (first.deadline ?? "9999").localeCompare(second.deadline ?? "9999");
  }
  const firstDeadline = first.deadline
    ? new Date(first.deadline).getTime()
    : Infinity;
  const secondDeadline = second.deadline
    ? new Date(second.deadline).getTime()
    : Infinity;
  return (
    second.priority - first.priority ||
    firstDeadline - secondDeadline ||
    second.difficulty - first.difficulty
  );
}

function taskProgress(task: Task) {
  const byPomodoros =
    (task.completedPomodoros / Math.max(1, task.plannedPomodoros)) * 100;
  const byMinutes =
    (task.actualMinutes / Math.max(1, task.estimateMinutes)) * 100;
  return task.status === "done"
    ? 100
    : Math.min(99, Math.round(Math.max(byPomodoros, byMinutes)));
}

function nextRecurringDeadline(deadline: string | undefined, recurring: Exclude<Task["recurring"], "none">) {
  const date = deadline ? new Date(deadline) : new Date();
  if (recurring === "daily") date.setDate(date.getDate() + 1);
  else if (recurring === "weekly") date.setDate(date.getDate() + 7);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}
