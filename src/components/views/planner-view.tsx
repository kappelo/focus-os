"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Plus,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { exportIcs } from "@/lib/algorithms";
import { createId } from "@/lib/ids";
import type { CalendarBlock, PlannerMode, WorkspaceState } from "@/lib/types";

type WorkspaceUpdater = (
  recipe: (state: WorkspaceState) => WorkspaceState,
) => void;

export function PlannerView({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: WorkspaceUpdater;
}) {
  const [mode, setMode] = useState<PlannerMode>(
    state.settings.plannerDefaultMode,
  );
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [adding, setAdding] = useState<{ date: Date; hour?: number } | null>(
    null,
  );
  const [moreDays, setMoreDays] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const dateChoices = useMemo(
    () => upcomingDays(cursor, moreDays ? 21 : 7),
    [cursor, moreDays],
  );
  const days = useMemo(
    () =>
      mode === "day"
        ? [cursor]
        : mode === "week"
          ? weekDays(cursor, state.settings.weekStartsOn)
          : monthDays(cursor, state.settings.weekStartsOn),
    [cursor, mode, state.settings.weekStartsOn],
  );
  const title =
    mode === "month"
      ? cursor.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} – ${days.at(-1)?.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}`;

  function move(direction: number) {
    const next = new Date(cursor);
    if (mode === "day") next.setDate(next.getDate() + direction);
    if (mode === "week") next.setDate(next.getDate() + direction * 7);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    setCursor(startOfDay(next));
  }

  function selectMode(nextMode: PlannerMode) {
    setMode(nextMode);
    onUpdate((current) => ({
      ...current,
      settings: { ...current.settings, plannerDefaultMode: nextMode },
    }));
  }

  function createFromDrop(
    taskId: string,
    date: Date,
    hour = state.settings.workdayStartHour,
  ) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + task.estimateMinutes * 60_000);
    const block: CalendarBlock = {
      id: createId(),
      title: task.title,
      start: start.toISOString(),
      end: end.toISOString(),
      taskId,
      done: false,
    };
    onUpdate((current) => ({
      ...current,
      calendar: [...current.calendar, block],
    }));
  }

  function downloadIcs() {
    const events = state.calendar.map((block) =>
      exportIcs(block.title, block.start, block.end)
        .split("\r\n")
        .slice(3, -1)
        .join("\r\n"),
    );
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Focus OS//PL",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/calendar" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "focus-os-plan.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importIcs(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = text
      .split("BEGIN:VEVENT")
      .slice(1)
      .flatMap<CalendarBlock>((chunk) => {
        const read = (name: string) =>
          chunk.match(new RegExp(`${name}[^:]*:([^\\r\\n]+)`))?.[1];
        const parseDate = (value?: string) =>
          value
            ? new Date(
                value.replace(
                  /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
                  "$1-$2-$3T$4:$5:$6Z",
                ),
              ).toISOString()
            : null;
        const start = parseDate(read("DTSTART"));
        const end = parseDate(read("DTEND"));
        return start && end
          ? [
              {
                id: createId(),
                title: read("SUMMARY") ?? "Importowany blok",
                start,
                end,
                done: false,
              },
            ]
          : [];
      });
    onUpdate((current) => ({
      ...current,
      calendar: [...current.calendar, ...parsed],
    }));
    event.target.value = "";
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">BLOKI CZASU</p>
          <h1>Planer</h1>
          <p>
            Przeciągaj zadania na godziny i zamieniaj zamiary w realny plan.
          </p>
        </div>
        <div className="button-group">
          <input
            hidden
            ref={importRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={importIcs}
          />
          <button
            className="button button-quiet"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={17} /> Import ICS
          </button>
          <button
            className="button button-quiet"
            onClick={downloadIcs}
            disabled={!state.calendar.length}
          >
            <Download size={17} /> Eksport ICS
          </button>
          <button
            className="button button-primary"
            onClick={() => setAdding({ date: cursor })}
          >
            <Plus size={18} /> Nowy blok
          </button>
        </div>
      </section>
      <section className="panel calendar-toolbar">
        <div className="calendar-nav">
          <button
            className="icon-button"
            onClick={() => move(-1)}
            aria-label="Poprzedni okres"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="button button-quiet"
            onClick={() => setCursor(startOfDay(new Date()))}
          >
            Dzisiaj
          </button>
          <button
            className={`button button-quiet more-days-button ${moreDays ? "active" : ""}`}
            onClick={() => setMoreDays((current) => !current)}
            aria-expanded={moreDays}
            aria-controls="planner-day-choices"
          >
            <CalendarDays size={17} />
            {moreDays ? "Mniej dni" : "Więcej dni"}
          </button>
          <button
            className="icon-button"
            onClick={() => move(1)}
            aria-label="Następny okres"
          >
            <ChevronRight size={19} />
          </button>
          <h2>{title}</h2>
        </div>
        <div className="segmented">
          {(["day", "week", "month"] as const).map((value) => (
            <button
              key={value}
              className={mode === value ? "active" : ""}
              onClick={() => selectMode(value)}
            >
              {value === "day"
                ? "Dzień"
                : value === "week"
                  ? "Tydzień"
                  : "Miesiąc"}
            </button>
          ))}
        </div>
        <div className="planner-day-choices" id="planner-day-choices" aria-label="Wybierz dzień w planerze">
          {dateChoices.map((day) => (
            <button
              key={day.toISOString()}
              className={sameDay(day, cursor) ? "active" : ""}
              onClick={() => setCursor(startOfDay(day))}
              aria-pressed={sameDay(day, cursor)}
            >
              <small>{day.toLocaleDateString("pl-PL", { weekday: "short" })}</small>
              <strong>{day.getDate()}</strong>
              <span>{day.toLocaleDateString("pl-PL", { month: "short" })}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="planner-layout">
        <aside className="panel unscheduled">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DO ZAPLANOWANIA</p>
              <h2>Zadania</h2>
            </div>
            <span>
              {state.tasks.filter((task) => task.status !== "done").length}
            </span>
          </div>
          <p>Przeciągnij na wybraną godzinę.</p>
          {state.tasks
            .filter((task) => task.status !== "done")
            .map((task) => (
              <article
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData(
                    "application/x-focus-task",
                    task.id,
                  )
                }
                key={task.id}
              >
                <GripVertical size={17} />
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {task.estimateMinutes} min · P{task.priority}
                  </small>
                </span>
              </article>
            ))}
        </aside>
        <div className="panel calendar-canvas">
          {mode === "month" ? (
            <MonthGrid
              days={days}
              state={state}
              weekStartsOn={state.settings.weekStartsOn}
              onDrop={createFromDrop}
              onAdd={(date) => setAdding({ date })}
            />
          ) : (
            <Timeline
              days={days}
              state={state}
              startHour={state.settings.workdayStartHour}
              endHour={state.settings.workdayEndHour}
              onDrop={createFromDrop}
              onToggle={(id) =>
                onUpdate((current) => ({
                  ...current,
                  calendar: current.calendar.map((block) =>
                    block.id === id ? { ...block, done: !block.done } : block,
                  ),
                }))
              }
              onAdd={(date, hour) => setAdding({ date, hour })}
            />
          )}
        </div>
      </section>
      {adding ? (
        <BlockForm
          date={adding.date}
          hour={adding.hour ?? state.settings.workdayStartHour}
          defaultDuration={state.settings.defaultBlockMinutes}
          tasks={state.tasks}
          onClose={() => setAdding(null)}
          onSubmit={(block) => {
            onUpdate((current) => ({
              ...current,
              calendar: [...current.calendar, block],
            }));
            setAdding(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Timeline({
  days,
  state,
  startHour,
  endHour,
  onDrop,
  onToggle,
  onAdd,
}: {
  days: Date[];
  state: WorkspaceState;
  startHour: number;
  endHour: number;
  onDrop: (taskId: string, date: Date, hour: number) => void;
  onToggle: (id: string) => void;
  onAdd: (date: Date, hour: number) => void;
}) {
  const hours = Array.from(
    { length: Math.max(1, endHour - startHour + 1) },
    (_, index) => index + startHour,
  );
  return (
    <div className="timeline" data-days={days.length}>
      <div className="timeline-head">
        <span />
        <div
          className="timeline-days"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        >
          {days.map((day) => (
            <div
              className={sameDay(day, new Date()) ? "today" : ""}
              key={day.toISOString()}
            >
              <small>
                {day.toLocaleDateString("pl-PL", { weekday: "short" })}
              </small>
              <strong>{day.getDate()}</strong>
            </div>
          ))}
        </div>
      </div>
      {hours.map((hour) => (
        <div className="timeline-row" key={hour}>
          <time>{String(hour).padStart(2, "0")}:00</time>
          <div
            className="timeline-slots"
            style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          >
            {days.map((day) => {
              const blocks = state.calendar.filter(
                (block) =>
                  sameDay(new Date(block.start), day) &&
                  new Date(block.start).getHours() === hour,
              );
              return (
                <div
                  className="time-slot"
                  key={day.toISOString()}
                  onDoubleClick={() => onAdd(day, hour)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) =>
                    onDrop(
                      event.dataTransfer.getData("application/x-focus-task"),
                      day,
                      hour,
                    )
                  }
                >
                  {blocks.map((block) => (
                    <button
                      key={block.id}
                      className={`calendar-block ${block.done ? "done" : ""}`}
                      onClick={() => onToggle(block.id)}
                    >
                      <span>{block.done ? <Check size={12} /> : null}</span>
                      <strong>{block.title}</strong>
                      <small>
                        {new Date(block.start).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        –
                        {new Date(block.end).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthGrid({
  days,
  state,
  weekStartsOn,
  onDrop,
  onAdd,
}: {
  days: Date[];
  state: WorkspaceState;
  weekStartsOn: 0 | 1;
  onDrop: (taskId: string, date: Date) => void;
  onAdd: (date: Date) => void;
}) {
  const labels =
    weekStartsOn === 1
      ? ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"]
      : ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
  return (
    <div className="month-grid">
      {labels.map((day) => (
        <strong className="month-label" key={day}>
          {day}
        </strong>
      ))}
      {days.map((day) => {
        const blocks = state.calendar.filter((block) =>
          sameDay(new Date(block.start), day),
        );
        return (
          <div
            key={day.toISOString()}
            className={`month-day ${sameDay(day, new Date()) ? "today" : ""}`}
            onDoubleClick={() => onAdd(day)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) =>
              onDrop(
                event.dataTransfer.getData("application/x-focus-task"),
                day,
              )
            }
          >
            <span>{day.getDate()}</span>
            {blocks.slice(0, 3).map((block) => (
              <small key={block.id}>{block.title}</small>
            ))}
            {blocks.length > 3 ? <em>+{blocks.length - 3}</em> : null}
          </div>
        );
      })}
    </div>
  );
}

function BlockForm({
  date,
  hour,
  defaultDuration,
  tasks,
  onClose,
  onSubmit,
}: {
  date: Date;
  hour: number;
  defaultDuration: number;
  tasks: WorkspaceState["tasks"];
  onClose: () => void;
  onSubmit: (block: CalendarBlock) => void;
}) {
  const initial = new Date(date);
  initial.setHours(hour, 0, 0, 0);
  const [title, setTitle] = useState("");
  const [taskId, setTaskId] = useState("");
  const [start, setStart] = useState(toLocalInput(initial));
  const [duration, setDuration] = useState(defaultDuration);

  function submit(event: FormEvent) {
    event.preventDefault();
    const task = tasks.find((item) => item.id === taskId);
    const startDate = new Date(start);
    onSubmit({
      id: createId(),
      title: title.trim() || task?.title || "Blok nauki",
      start: startDate.toISOString(),
      end: new Date(startDate.getTime() + duration * 60_000).toISOString(),
      taskId: taskId || undefined,
      done: false,
    });
  }

  return (
    <Modal title="Nowy blok czasu" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Powiązane zadanie
          <select
            value={taskId}
            onChange={(event) => {
              setTaskId(event.target.value);
              const task = tasks.find((item) => item.id === event.target.value);
              if (task) {
                setTitle(task.title);
                setDuration(task.estimateMinutes);
              }
            }}
          >
            <option value="">Bez zadania</option>
            {tasks
              .filter((task) => task.status !== "done")
              .map((task) => (
                <option value={task.id} key={task.id}>
                  {task.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Nazwa
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Blok nauki"
          />
        </label>
        <label>
          Start
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Czas (min)
          <input
            type="number"
            min="5"
            max="480"
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Anuluj
          </button>
          <button className="button button-primary">
            <Plus size={16} /> Zaplanuj
          </button>
        </div>
      </form>
    </Modal>
  );
}

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const weekDays = (date: Date, weekStartsOn: 0 | 1) => {
  const start = startOfDay(date);
  const offset = weekStartsOn === 1 ? (start.getDay() + 6) % 7 : start.getDay();
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
};

const upcomingDays = (date: Date, count: number) => {
  const start = startOfDay(date);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
};

const monthDays = (date: Date, weekStartsOn: 0 | 1) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = weekDays(first, weekStartsOn)[0];
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
};

const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
