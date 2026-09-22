"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  Check,
  Cloud,
  Database,
  Download,
  Flame,
  FolderKanban,
  Gauge,
  KeyRound,
  Laptop,
  Link2,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Tablet,
  Trash2,
  Type,
  Upload,
  UserRound,
  Users,
  WifiOff,
} from "lucide-react";
import {
  createDefaultWorkspace,
  DEFAULT_STUDY_METHOD_MINUTES,
  DEFAULT_TIMER_MODES,
  DEFAULT_WORKSPACE_SETTINGS,
} from "@/lib/default-data";
import { createId } from "@/lib/ids";
import { localDateKey } from "@/lib/dates";
import {
  getDeviceInfo,
  migrateWorkspace,
  renameCurrentDevice,
} from "@/lib/storage";
import { PwaInstallButton } from "@/components/pwa-install";
import { ShortcutsManager } from "@/components/shortcuts-manager";
import { OrganizationHub } from "@/components/organization-hub";
import { ExamPlanView } from "@/components/exam-plan";
import { StudyInsights } from "@/components/study-insights";
import { NotificationCenter } from "@/components/notification-center";
import { SecurityCenter } from "@/components/security-center";
import type {
  AccentColor,
  CloudDevice,
  Exam,
  FontScale,
  Habit,
  InterfaceDensity,
  LocalProfile,
  PlannerMode,
  ReviewOrder,
  StudyMethod,
  TaskSort,
  ThemeMode,
  TimerMode,
  ViewId,
  WorkspaceState,
} from "@/lib/types";

type MoreTab =
  | "analytics"
  | "habits"
  | "exams"
  | "organization"
  | "notifications"
  | "security"
  | "shortcuts"
  | "cloud"
  | "settings";

const moreTabs: MoreTab[] = ["analytics", "habits", "exams", "organization", "notifications", "security", "shortcuts", "cloud", "settings"];
function moreTabFromUrl(): MoreTab {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  if (hash.startsWith("settings-")) return "settings";
  return moreTabs.includes(hash as MoreTab) ? hash as MoreTab : "analytics";
}

const THEME_OPTIONS: {
  id: ThemeMode;
  label: string;
  icon: typeof Sun;
  description: string;
}[] = [
  { id: "light", label: "Jasny", icon: Sun, description: "Czyste, jasne tło" },
  {
    id: "dark",
    label: "Ciemny",
    icon: Moon,
    description: "Mniej światła wieczorem",
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    description: "Jak na urządzeniu",
  },
  { id: "auto", label: "Auto", icon: Activity, description: "Ciemny po 20:00" },
  {
    id: "sepia",
    label: "Sepia",
    icon: BookOpen,
    description: "Ciepły tryb czytania",
  },
  {
    id: "contrast",
    label: "Kontrast",
    icon: Gauge,
    description: "Maksymalna czytelność",
  },
];

const ACCENT_OPTIONS: { id: AccentColor; label: string; color: string }[] = [
  { id: "sage", label: "Szałwia", color: "#65724b" },
  { id: "blue", label: "Niebieski", color: "#3f6fe8" },
  { id: "indigo", label: "Indygo", color: "#4f46e5" },
  { id: "violet", label: "Fiolet", color: "#7c4dcc" },
  { id: "pink", label: "Różowy", color: "#d64d96" },
  { id: "rose", label: "Róża", color: "#d94b67" },
  { id: "orange", label: "Pomarańcz", color: "#cf6d2f" },
  { id: "teal", label: "Turkus", color: "#16877d" },
  { id: "cyan", label: "Cyjan", color: "#167caa" },
  { id: "mono", label: "Mono", color: "#5e6460" },
];

const STUDY_METHOD_OPTIONS: { id: StudyMethod; label: string }[] = [
  { id: "feynman", label: "Feynman" },
  { id: "blurting", label: "Blurting" },
  { id: "cornell", label: "Cornell" },
  { id: "interleaving", label: "Interleaving" },
  { id: "exam-sprint", label: "Exam Sprint" },
  { id: "leitner", label: "Leitner" },
];

export function MoreView({
  state,
  profile,
  onUpdate,
  syncing,
  syncStatus,
  syncError,
  onSync,
  onRestoreRevision,
  onPinChanged,
}: {
  state: WorkspaceState;
  profile: LocalProfile;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
  syncing: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string;
  onSync: () => void;
  onRestoreRevision: (revision: number) => Promise<void>;
  onPinChanged: (pin: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<MoreTab>(moreTabFromUrl);
  useEffect(() => {
    const restore = () => setTab(moreTabFromUrl());
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("hashchange", restore); window.removeEventListener("popstate", restore); };
  }, []);

  function selectTab(next: MoreTab) {
    setTab(next);
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
  }
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">TWÓJ SYSTEM</p>
          <h1>Wnioski i ustawienia</h1>
          <p>Patrz na dane wtedy, gdy pomagają podjąć lepszą decyzję.</p>
        </div>
      </section>
      <nav className="tabs more-navigation" aria-label="Narzędzia i ustawienia">
        <button
          className={tab === "security" ? "active" : ""}
          onClick={() => selectTab("security")}
        >
          <ShieldCheck size={17} />
          Bezpieczeństwo
        </button>
        <button
          className={tab === "notifications" ? "active" : ""}
          onClick={() => selectTab("notifications")}
        >
          <Bell size={17} />
          Powiadomienia
        </button>
        <button
          className={tab === "organization" ? "active" : ""}
          onClick={() => selectTab("organization")}
        >
          <FolderKanban size={17} />
          Projekty i rozwój
        </button>
        <button
          className={tab === "analytics" ? "active" : ""}
          onClick={() => selectTab("analytics")}
        >
          <BarChart3 size={17} />
          Analityka
        </button>
        <button
          className={tab === "habits" ? "active" : ""}
          onClick={() => selectTab("habits")}
        >
          <Flame size={17} />
          Nawyki
        </button>
        <button
          className={tab === "exams" ? "active" : ""}
          onClick={() => selectTab("exams")}
        >
          <CalendarCheck size={17} />
          Egzaminy
        </button>
        <button
          className={tab === "shortcuts" ? "active" : ""}
          onClick={() => selectTab("shortcuts")}
        >
          <Link2 size={17} />
          Skróty
        </button>
        <button
          className={tab === "cloud" ? "active" : ""}
          onClick={() => selectTab("cloud")}
        >
          <Cloud size={17} />
          Chmura
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => selectTab("settings")}
        >
          <Settings size={17} />
          Ustawienia
        </button>
      </nav>
      {tab === "analytics" ? <Analytics state={state} /> : null}
      {tab === "habits" ? <Habits state={state} onUpdate={onUpdate} /> : null}
      {tab === "exams" ? <Exams state={state} onUpdate={onUpdate} /> : null}
      {tab === "organization" ? <OrganizationHub state={state} onUpdate={onUpdate} /> : null}
      {tab === "notifications" ? <NotificationCenter state={state} onUpdate={onUpdate} /> : null}
      {tab === "security" ? <SecurityCenter state={state} profile={profile} onUpdate={onUpdate} /> : null}
      {tab === "shortcuts" ? (
        <ShortcutsManager state={state} onUpdate={onUpdate} />
      ) : null}
      {tab === "cloud" ? (
        <CloudView
          state={state}
          profile={profile}
          onUpdate={onUpdate}
          syncing={syncing}
          syncStatus={syncStatus}
          syncError={syncError}
          onSync={onSync}
          onRestoreRevision={onRestoreRevision}
        />
      ) : null}
      {tab === "settings" ? (
        <SettingsView state={state} profile={profile} onUpdate={onUpdate} onPinChanged={onPinChanged} />
      ) : null}
    </div>
  );
}

function Analytics({ state }: { state: WorkspaceState }) {
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const [now] = useState(() => Date.now());
  const sessions = useMemo(() => {
    const days = range === "week" ? 7 : range === "month" ? 30 : 3650;
    const since = now - days * 86_400_000;
    return state.sessions.filter(
      (session) => new Date(session.startedAt).getTime() >= since,
    );
  }, [now, range, state.sessions]);
  const total = sessions.reduce(
    (sum, session) => sum + session.durationMinutes,
    0,
  );
  const quality = sessions.length
    ? Math.round(
        sessions.reduce((sum, session) => sum + session.quality, 0) /
          sessions.length,
      )
    : 0;
  const distractions = sessions.reduce(
    (sum, session) => sum + session.distractions.length,
    0,
  );
  const planned = sessions.reduce(
    (sum, session) => sum + session.plannedMinutes,
    0,
  );
  const subjectMinutes = state.subjects
    .map((subject) => ({
      ...subject,
      minutes: sessions
        .filter((session) => session.subjectId === subject.id)
        .reduce((sum, session) => sum + session.durationMinutes, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    quality: average(
      sessions
        .filter((session) => new Date(session.startedAt).getHours() === hour)
        .map((session) => session.quality),
    ),
  }));
  const bestHour = [...byHour].sort((a, b) => b.quality - a.quality)[0];
  const studyRuns = state.studyRuns.filter(
    (run) => range === "all" || new Date(run.startedAt).getTime() >= (range === "week" ? now - 7 * 86_400_000 : now - 30 * 86_400_000),
  );
  const methodStats = [...new Set(studyRuns.map((run) => run.method))]
    .map((method) => {
      const runs = studyRuns.filter((run) => run.method === method);
      return { method, score: average(runs.map((run) => run.score)), count: runs.length };
    })
    .slice()
    .sort((first, second) => second.score - first.score);
  const weekAgo = now - 7 * 86_400_000;
  const weekTasks = state.tasks.filter(
    (task) => new Date(task.updatedAt).getTime() >= weekAgo || (task.deadline && new Date(task.deadline).getTime() >= weekAgo),
  );
  const weeklyCompletion = weekTasks.length
    ? Math.round((weekTasks.filter((task) => task.status === "done").length / weekTasks.length) * 100)
    : 0;
  const activeDays = Math.max(1, range === "week" ? 7 : range === "month" ? 30 : Math.ceil((now - Math.min(now, ...sessions.map((item) => new Date(item.startedAt).getTime()))) / 86_400_000));
  const dailyAverage = total / activeDays;
  const remainingMinutes = state.tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + Math.max(0, task.estimateMinutes - task.actualMinutes), 0);
  const forecastDays = dailyAverage > 0 ? Math.ceil(remainingMinutes / dailyAverage) : null;
  const failedReviews = state.flashcardReviews.filter((review) => review.grade === 0).length;
  const forgettingRate = state.flashcardReviews.length ? Math.round((failedReviews / state.flashcardReviews.length) * 100) : 0;
  return (
    <div className="analytics-stack">
      <StudyInsights state={state} />
      <div className="analytics-filter segmented">
        {(["week", "month", "all"] as const).map((value) => (
          <button
            key={value}
            className={range === value ? "active" : ""}
            onClick={() => setRange(value)}
          >
            {value === "week"
              ? "7 dni"
              : value === "month"
                ? "30 dni"
                : "Całość"}
          </button>
        ))}
      </div>
      <section className="stats-grid analytics-stats">
        <article className="stat-card">
          <span className="stat-icon violet">
            <Activity size={19} />
          </span>
          <div>
            <small>Czas skupienia</small>
            <strong>
              {Math.floor(total / 60)}h {total % 60}m
            </strong>
            <em>{sessions.length} sesji</em>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon green">
            <Gauge size={19} />
          </span>
          <div>
            <small>Jakość sesji</small>
            <strong>
              {quality}
              <span> / 100</span>
            </strong>
            <em>średnia jakości</em>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon amber">
            <Sparkles size={19} />
          </span>
          <div>
            <small>Plan vs realnie</small>
            <strong>
              {planned ? Math.round((total / planned) * 100) : 0}%
            </strong>
            <em>{planned} min planu</em>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon rose">
            <Bell size={19} />
          </span>
          <div>
            <small>Rozproszenia</small>
            <strong>{distractions}</strong>
            <em>
              {sessions.length
                ? (distractions / sessions.length).toFixed(1)
                : "0"}{" "}
              na sesję
            </em>
          </div>
        </article>
      </section>
      <section className="analytics-grid">
        <article className="panel heatmap-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">365 DNI</p>
              <h2>Rytm nauki</h2>
            </div>
            <span>{state.sessions.length} sesji</span>
          </div>
          <Heatmap sessions={state.sessions} />
        </article>
        <article className="panel subject-chart">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PRZEDMIOTY</p>
              <h2>Rozkład czasu</h2>
            </div>
          </div>
          {subjectMinutes.map((subject) => (
            <div className="bar-row" key={subject.id}>
              <span>{subject.name}</span>
              <div>
                <i
                  style={{
                    width: `${(subject.minutes / Math.max(1, subjectMinutes[0]?.minutes)) * 100}%`,
                    background: subject.color,
                  }}
                />
              </div>
              <strong>{subject.minutes} min</strong>
            </div>
          ))}
        </article>
        <article className="panel insight-card">
          <span>
            <Sparkles size={19} />
          </span>
          <div>
            <p className="eyebrow">WNIOSEK Z DANYCH</p>
            <h2>
              {sessions.length >= 3
                ? `Najlepsze sesje zaczynasz około ${String(bestHour.hour).padStart(2, "0")}:00.`
                : "Potrzebujemy jeszcze kilku sesji."}
            </h2>
            <p>
              {sessions.length >= 3
                ? `Średnia jakość o tej porze to ${bestHour.quality}/100. To dobry slot na trudne zadania.`
                : "Po trzech sesjach pokażemy rzeczywisty wzorzec produktywności — bez losowych porad."}
            </p>
          </div>
        </article>
        <article className="panel quality-chart">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ENERGIA VS WYNIK</p>
              <h2>Jakość sesji</h2>
            </div>
          </div>
          <div className="energy-bars">
            {[1, 2, 3, 4, 5].map((energy) => {
              const score = average(
                sessions
                  .filter((session) => session.energy === energy)
                  .map((session) => session.quality),
              );
              return (
                <div key={energy}>
                  <i style={{ height: `${Math.max(4, score)}%` }} />
                  <span>{energy}</span>
                  <small>{score || "—"}</small>
                </div>
              );
            })}
          </div>
        </article>
        <article className="panel method-effectiveness">
          <div className="panel-heading">
            <div><p className="eyebrow">METODY NAUKI</p><h2>Skuteczność metod</h2></div>
          </div>
          {methodStats.length ? methodStats.map((item) => (
            <div className="bar-row" key={item.method}>
              <span>{item.method}</span><div><i style={{ width: `${item.score}%` }} /></div><strong>{item.score}% · {item.count}</strong>
            </div>
          )) : <p className="empty-copy">Ukończ tryb nauki, aby porównać metody.</p>}
        </article>
        <article className="panel forecast-card">
          <div><p className="eyebrow">PROGNOZA CELU</p><h2>{forecastDays === null ? "Potrzebne są dane" : forecastDays === 0 ? "Plan wykonany" : `Około ${forecastDays} dni do końca`}</h2><p>{forecastDays === null ? "Zapisz pierwsze sesje, aby obliczyć tempo." : `Przy średnim tempie ${Math.round(dailyAverage)} min dziennie i ${remainingMinutes} min pozostałej pracy.`}</p></div>
          <dl><div><dt>Plan tygodnia</dt><dd>{weeklyCompletion}%</dd></div><div><dt>Zapominanie fiszek</dt><dd>{forgettingRate}%</dd></div><div><dt>Najlepsza pora</dt><dd>{sessions.length >= 3 ? `${String(bestHour.hour).padStart(2, "0")}:00` : "—"}</dd></div></dl>
        </article>
      </section>
    </div>
  );
}

function Heatmap({ sessions }: { sessions: WorkspaceState["sessions"] }) {
  const map = new Map<string, number>();
  sessions.forEach((session) =>
    map.set(
      localDateKey(session.startedAt),
      (map.get(localDateKey(session.startedAt)) ?? 0) + session.durationMinutes,
    ),
  );
  const days = Array.from({ length: 365 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (364 - offset));
    return {
      key: localDateKey(date),
      value: map.get(localDateKey(date)) ?? 0,
    };
  });
  return (
    <div className="heatmap">
      {days.map((day) => (
        <i
          key={day.key}
          title={`${day.key}: ${day.value} min`}
          data-level={
            day.value === 0
              ? 0
              : day.value < 25
                ? 1
                : day.value < 60
                  ? 2
                  : day.value < 120
                    ? 3
                    : 4
          }
        />
      ))}
    </div>
  );
}

function Habits({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const [name, setName] = useState("");
  const today = localDateKey();
  const days = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - offset));
    return localDateKey(date);
  });
  function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const habit: Habit = {
      id: createId(),
      name: name.trim(),
      checks: [],
    };
    onUpdate((current) => ({ ...current, habits: [...current.habits, habit] }));
    setName("");
  }
  return (
    <div className="habit-page">
      <section className="panel habit-editor">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PROSTA REGULARNOŚĆ</p>
            <h2>Nawyki</h2>
          </div>
          <Flame size={20} />
        </div>
        <form className="inline-form" onSubmit={add}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nowy nawyk…"
          />
          <button className="button button-primary">
            <Plus size={16} />
            Dodaj
          </button>
        </form>
        {state.habits.map((habit) => {
          const done = habit.checks.includes(today);
          return (
            <article className="habit-row" key={habit.id}>
              <button
                className={done ? "habit-check done" : "habit-check"}
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    habits: current.habits.map((item) =>
                      item.id === habit.id
                        ? {
                            ...item,
                            checks: done
                              ? item.checks.filter((day) => day !== today)
                              : [...item.checks, today],
                          }
                        : item,
                    ),
                  }))
                }
              >
                {done ? <Check size={17} /> : null}
              </button>
              <div>
                <strong>{habit.name}</strong>
                <small>{habitStreak(habit.checks)} dni streak</small>
              </div>
              <div className="habit-history">
                {days.map((day) => (
                  <i
                    key={day}
                    className={habit.checks.includes(day) ? "checked" : ""}
                    title={day}
                  />
                ))}
              </div>
              <button
                className="icon-button danger"
                aria-label="Usuń nawyk"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    habits: current.habits.filter(
                      (item) => item.id !== habit.id,
                    ),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Exams({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [topics, setTopics] = useState("");
  const [now] = useState(() => Date.now());
  function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !date) return;
    const exam: Exam = {
      id: createId(),
      title: title.trim(),
      date: new Date(date).toISOString(),
      subjectIds: state.subjects.map((subject) => subject.id),
      topics: topics
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
      completedTopics: [],
      dailyMinutes: 45,
      updatedAt: new Date().toISOString(),
    };
    onUpdate((current) => ({ ...current, exams: [...current.exams, exam] }));
    setAdding(false);
    setTitle("");
    setDate("");
    setTopics("");
  }
  return (
    <div className="exam-grid">
      {state.exams.map((exam) => {
        const days = Math.max(
          0,
          Math.ceil((new Date(exam.date).getTime() - now) / 86_400_000),
        );
        const subjects = state.subjects.filter((subject) =>
          exam.subjectIds.includes(subject.id),
        );
        const mastery = average(subjects.map((subject) => subject.mastery));
        const weeklyPace = Math.max(
          1,
          Math.ceil(exam.topics.length / Math.max(1, days / 7)),
        );
        return (
          <article className="panel exam-card" key={exam.id}>
            <header>
              <div>
                <p className="eyebrow">
                  {new Date(exam.date).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h2>{exam.title}</h2>
              </div>
              <strong>
                {days}
                <small>dni</small>
              </strong>
            </header>
            <div className="exam-progress">
              <span>
                <i style={{ width: `${mastery}%` }} />
              </span>
              <b>{mastery}% opanowania</b>
            </div>
            <div className="exam-metrics">
              <span>
                <small>Zakres</small>
                <strong>{exam.topics.length} tematów</strong>
              </span>
              <span>
                <small>Tempo</small>
                <strong>{weeklyPace} / tydzień</strong>
              </span>
              <span>
                <small>Zaległości</small>
                <strong>
                  {
                    state.tasks.filter(
                      (task) =>
                        task.deadline &&
                        new Date(task.deadline).getTime() < now &&
                        task.status !== "done",
                    ).length
                  }
                </strong>
              </span>
            </div>
            <div className="tag-row">
              {exam.topics.slice(0, 5).map((topic) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
            <ExamPlanView exam={exam} state={state} onUpdate={onUpdate} />
            <button
              className="icon-button danger exam-delete"
              aria-label="Usuń egzamin"
              onClick={() =>
                onUpdate((current) => ({
                  ...current,
                  exams: current.exams.filter((item) => item.id !== exam.id),
                }))
              }
            >
              <Trash2 size={16} />
            </button>
          </article>
        );
      })}
      <article className="panel add-exam">
        {adding ? (
          <form className="form-stack" onSubmit={add}>
            <label>
              Nazwa
              <input
                autoFocus
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Data
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              Zakres (po przecinku)
              <textarea
                value={topics}
                onChange={(event) => setTopics(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setAdding(false)}
              >
                Anuluj
              </button>
              <button className="button button-primary">Zapisz</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)}>
            <Plus size={23} />
            <strong>Dodaj egzamin</strong>
            <span>Zobacz wymagane tempo nauki</span>
          </button>
        )}
      </article>
    </div>
  );
}

function CloudView({
  state,
  profile,
  onUpdate,
  syncing,
  syncStatus,
  syncError,
  onSync,
  onRestoreRevision,
}: {
  state: WorkspaceState;
  profile: LocalProfile;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
  syncing: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string;
  onSync: () => void;
  onRestoreRevision: (revision: number) => Promise<void>;
}) {
  const accountKey = profile.serverUserId ?? profile.id;
  const [currentDevice, setCurrentDevice] = useState(() =>
    getDeviceInfo(accountKey),
  );
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [revisions, setRevisions] = useState<
    { revision: number; createdAt: string; deviceName: string }[]
  >([]);
  const [conflicts, setConflicts] = useState<
    {
      id: string;
      baseRevision: number;
      serverRevision: number;
      createdAt: string;
      resolvedAt: string | null;
      deviceName: string;
    }[]
  >([]);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  useEffect(() => {
    if (!profile.serverLinked) return;
    let active = true;
    void fetch("/api/devices", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          devices?: CloudDevice[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error ?? "Brak połączenia z SQLite");
        if (active) {
          setDevices(data.devices ?? []);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Błąd połączenia");
      });
    return () => {
      active = false;
    };
  }, [profile.serverLinked, syncStatus]);

  useEffect(() => {
    if (!profile.serverLinked) return;
    let active = true;
    void fetch("/api/sync", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          revisions?: { revision: number; createdAt: string; deviceName: string }[];
          conflicts?: {
            id: string;
            baseRevision: number;
            serverRevision: number;
            createdAt: string;
            resolvedAt: string | null;
            deviceName: string;
          }[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Nie udało się pobrać historii");
        if (active) {
          setRevisions(data.revisions ?? []);
          setConflicts(data.conflicts ?? []);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Błąd historii synchronizacji");
      });
    return () => {
      active = false;
    };
  }, [profile.serverLinked, syncStatus]);

  function setSyncSetting<K extends "autoSync" | "syncIntervalSeconds">(
    key: K,
    value: WorkspaceState["settings"][K],
  ) {
    onUpdate((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  }

  async function revokeDevice(id: string, name: string) {
    if (
      !window.confirm(
        `Odłączyć urządzenie „${name}”? Będzie wymagało ponownego logowania do synchronizacji.`,
      )
    )
      return;
    const response = await fetch("/api/devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ id }),
    });
    if (response.ok)
      setDevices((current) => current.filter((device) => device.id !== id));
    else setError("Nie udało się odłączyć urządzenia.");
  }

  function renameDevice() {
    setDeviceName(currentDevice.name);
    setRenaming(true);
  }

  function saveDeviceName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceName.trim()) return;
    setCurrentDevice(renameCurrentDevice(accountKey, deviceName.trim()));
    setRenaming(false);
    onSync();
  }

  async function restoreRevision(revision: number) {
    if (!window.confirm(`Przywrócić dane z rewizji #${revision}? Bieżące dane pozostaną w historii jako nowa rewizja.`)) return;
    setRestoring(revision);
    try {
      await onRestoreRevision(revision);
      setError("");
      onSync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się przywrócić danych");
    } finally {
      setRestoring(null);
    }
  }

  if (!profile.serverLinked) {
    return (
      <section className="panel cloud-empty">
        <WifiOff size={28} />
        <h2>Ten profil jest tylko lokalny</h2>
        <p>
          Wyloguj się i wybierz „Mam konto”, aby połączyć istniejący profil z
          SQLite. Dane lokalne zostaną bezpiecznie scalone po logowaniu.
        </p>
      </section>
    );
  }

  return (
    <div className="cloud-layout">
      <section className="panel cloud-overview">
        <div className="cloud-hero">
          <span>
            <Database size={24} />
          </span>
          <div>
            <p className="eyebrow">SQLITE SYNC</p>
            <h2>Jeden workspace na każdym ekranie</h2>
            <p>
              Zmiany zapisują się najpierw lokalnie, a następnie trafiają do
              SQLite. Konflikty są scalane bez gubienia zadań i fiszek.
            </p>
          </div>
        </div>
        <div className="cloud-stats">
          <span>
            <small>Status</small>
            <strong className={syncStatus === "error" ? "sync-error" : ""}>
              {syncing
                ? "Synchronizacja…"
                : syncStatus === "error"
                  ? "Oczekuje na serwer"
                  : "Zsynchronizowano"}
            </strong>
          </span>
          <span>
            <small>Rewizja SQLite</small>
            <strong>#{state.syncRevision}</strong>
          </span>
          <span>
            <small>Ostatni zapis</small>
            <strong>
              {state.lastSyncedAt
                ? new Date(state.lastSyncedAt).toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Jeszcze nie"}
            </strong>
          </span>
        </div>
        {syncStatus === "error" && syncError ? (
          <p className="form-error" role="alert">
            Synchronizacja: {syncError}
          </p>
        ) : null}
        <div className="cloud-actions">
          <button
            className="button button-primary"
            onClick={onSync}
            disabled={syncing}
          >
            <RefreshCw className={syncing ? "spin" : ""} size={17} />
            Synchronizuj teraz
          </button>
          <button className="button button-secondary" onClick={renameDevice}>
            <Monitor size={17} />
            Zmień nazwę urządzenia
          </button>
        </div>
        {renaming ? (
          <form className="form-grid" onSubmit={saveDeviceName}>
            <label>
              Nazwa tego urządzenia
              <input autoFocus value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={80} required />
            </label>
            <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setRenaming(false)}>Anuluj</button><button className="button button-primary" type="submit">Zapisz</button></div>
          </form>
        ) : null}
        <div className="settings-group cloud-sync-settings">
          <label className="switch-row">
            <span>
              <strong>Automatyczna synchronizacja</strong>
              <small>
                Zapis po każdej zmianie oraz po powrocie do aplikacji.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.autoSync}
              onChange={(event) =>
                setSyncSetting("autoSync", event.target.checked)
              }
            />
          </label>
          <label>
            Sprawdzaj inne urządzenia
            <select
              value={state.settings.syncIntervalSeconds}
              onChange={(event) =>
                setSyncSetting(
                  "syncIntervalSeconds",
                  Number(event.target.value),
                )
              }
            >
              <option value={15}>co 15 sekund</option>
              <option value={30}>co 30 sekund</option>
              <option value={60}>co minutę</option>
              <option value={300}>co 5 minut</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel device-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">TWOJE URZĄDZENIA</p>
            <h2>Aktywne połączenia</h2>
          </div>
          <span className="device-count">{devices.length}</span>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="device-list">
          {devices.map((device) => (
            <article key={device.id}>
              <span className="device-icon">
                <DeviceIcon kind={device.kind} />
              </span>
              <div>
                <strong>
                  {device.id === currentDevice.id
                    ? currentDevice.name
                    : device.name}
                  {device.id === currentDevice.id ? (
                    <em>To urządzenie</em>
                  ) : null}
                </strong>
                <small>
                  {device.platform} · aktywne {relativeTime(device.lastSeenAt)}
                </small>
              </div>
              <button
                className="icon-button danger"
                aria-label={`Odłącz ${device.name}`}
                disabled={device.id === currentDevice.id}
                onClick={() => void revokeDevice(device.id, device.name)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
          {!devices.length && !error ? (
            <p className="quiet-copy">
              Urządzenie pojawi się po pierwszej synchronizacji.
            </p>
          ) : null}
        </div>
        <p className="device-note">
          <ShieldCheck size={15} /> Przechowujemy nazwę, typ urządzenia i czas
          ostatniej synchronizacji — bez śledzenia lokalizacji.
        </p>
      </section>
      <section className="panel device-panel sync-history-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">HISTORIA DANYCH</p>
            <h2>Rewizje i konflikty</h2>
          </div>
          <span className="device-count">{revisions.length}</span>
        </div>
        <p className="quiet-copy">
          Przechowujemy 100 ostatnich rewizji. Przywrócenie tworzy nową rewizję, więc nie nadpisuje historii.
        </p>
        <div className="device-list revision-list">
          {revisions.slice(0, 8).map((entry) => (
            <article key={entry.revision}>
              <div>
                <strong>Rewizja #{entry.revision}</strong>
                <small>{entry.deviceName} · {new Date(entry.createdAt).toLocaleString("pl-PL")}</small>
              </div>
              <button
                className="button button-quiet"
                disabled={entry.revision === state.syncRevision || restoring !== null}
                onClick={() => void restoreRevision(entry.revision)}
              >
                {restoring === entry.revision ? "Przywracanie…" : "Przywróć"}
              </button>
            </article>
          ))}
          {!revisions.length ? <p className="quiet-copy">Historia pojawi się po pierwszej synchronizacji.</p> : null}
        </div>
        {conflicts.length ? (
          <div className="sync-conflict-list">
            <strong>Ostatnie konflikty</strong>
            {conflicts.slice(0, 5).map((entry) => (
              <small key={entry.id}>
                {entry.deviceName}: rewizja #{entry.baseRevision} zderzyła się z #{entry.serverRevision} · {entry.resolvedAt ? "scalono automatycznie" : "oczekuje"}
              </small>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DeviceIcon({ kind }: { kind: CloudDevice["kind"] }) {
  if (kind === "mobile") return <UserRound size={19} />;
  if (kind === "tablet") return <Tablet size={19} />;
  if (kind === "laptop") return <Laptop size={19} />;
  return <Monitor size={19} />;
}

function relativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "przed chwilą";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min temu`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} godz. temu`;
  return `${Math.floor(seconds / 86_400)} dni temu`;
}

function SettingsView({
  state,
  profile,
  onUpdate,
  onPinChanged,
}: {
  state: WorkspaceState;
  profile: LocalProfile;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
  onPinChanged: (pin: string) => Promise<void>;
}) {
  const backupRef = useRef<HTMLInputElement>(null);
  const [adminUsers, setAdminUsers] = useState<
    {
      id: string;
      username: string;
      name: string;
      role: string;
      lockedUntil: string | null;
    }[]
  >([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [adminPins, setAdminPins] = useState<Record<string, string>>({});
  useEffect(() => {
    if (profile.role === "admin" && profile.serverLinked)
      void fetch("/api/admin/users", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then((response) => (response.ok ? response.json() : { users: [] }))
        .then((data) => setAdminUsers(data.users));
  }, [profile.role, profile.serverLinked]);
  function setSetting<K extends keyof WorkspaceState["settings"]>(
    key: K,
    value: WorkspaceState["settings"][K],
  ) {
    onUpdate((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  }
  function applySettings(patch: Partial<WorkspaceState["settings"]>) {
    onUpdate((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }
  function updateTimerMode(id: string, patch: Partial<TimerMode>) {
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        timerModes: current.settings.timerModes.map((mode) =>
          mode.id === id ? { ...mode, ...patch } : mode,
        ),
      },
    }));
  }
  function toggleTimerMode(mode: TimerMode) {
    const enabled = mode.enabled !== false;
    const enabledCount = state.settings.timerModes.filter(
      (item) => item.enabled !== false,
    ).length;
    if (enabled && enabledCount <= 1) return;
    updateTimerMode(mode.id, { enabled: !enabled });
  }
  function addTimerMode() {
    const mode: TimerMode = {
      id: `user-${createId()}`,
      label: "Nowy tryb",
      focus: 30,
      break: 5,
      enabled: true,
    };
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        timerModes: [...current.settings.timerModes, mode],
        defaultTimerMode: mode.id,
      },
    }));
  }
  function removeTimerMode(id: string) {
    if (state.settings.timerModes.length <= 1) return;
    onUpdate((current) => {
      const timerModes = current.settings.timerModes.filter(
        (mode) => mode.id !== id,
      );
      return {
        ...current,
        settings: {
          ...current.settings,
          timerModes,
          defaultTimerMode:
            current.settings.defaultTimerMode === id
              ? (timerModes.find((mode) => mode.enabled !== false)?.id ??
                timerModes[0].id)
              : current.settings.defaultTimerMode,
        },
      };
    });
  }
  function toggleStudyMethod(id: StudyMethod) {
    const enabled = state.settings.enabledStudyMethods.includes(id);
    if (enabled && state.settings.enabledStudyMethods.length <= 1) return;
    setSetting(
      "enabledStudyMethods",
      enabled
        ? state.settings.enabledStudyMethods.filter((method) => method !== id)
        : [...state.settings.enabledStudyMethods, id],
    );
  }
  function resetSettings() {
    if (
      !window.confirm(
        "Przywrócić wszystkie ustawienia domyślne? Dane pozostaną bez zmian.",
      )
    )
      return;
    onUpdate((current) => ({
      ...current,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        timerModes: DEFAULT_TIMER_MODES.map((mode) => ({ ...mode })),
        enabledStudyMethods: [
          ...DEFAULT_WORKSPACE_SETTINGS.enabledStudyMethods,
        ],
        studyMethodMinutes: { ...DEFAULT_STUDY_METHOD_MINUTES },
        shortcutLinks: DEFAULT_WORKSPACE_SETTINGS.shortcutLinks.map((link) => ({
          ...link,
        })),
      },
    }));
    setAdminMessage("Przywrócono ustawienia domyślne.");
  }
  function downloadData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `focus-os-${profile.username}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function restoreData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as WorkspaceState;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.tasks)
      ) {
        throw new Error("invalid backup");
      }
      const restored = migrateWorkspace(parsed);
      onUpdate((current) => ({
        ...restored,
        syncId: current.syncId,
        syncRevision: current.syncRevision,
        syncedVersion: current.syncedVersion,
        lastSyncedAt: current.lastSyncedAt,
      }));
      setAdminMessage("Backup przywrócony. Zmiany zostaną zsynchronizowane.");
    } catch {
      setAdminMessage("Nie udało się odczytać tego backupu JSON.");
    } finally {
      event.target.value = "";
    }
  }
  function clearWorkspace() {
    if (
      !window.confirm(
        "Usunąć wszystkie zadania, fiszki, sesje, materiały i plany? Ustawienia konta pozostaną bez zmian.",
      )
    )
      return;
    onUpdate((current) => {
      const empty = createDefaultWorkspace();
      return {
        ...empty,
        syncId: current.syncId,
        syncRevision: current.syncRevision,
        syncedVersion: current.syncedVersion,
        lastSyncedAt: current.lastSyncedAt,
        tombstones: current.tombstones,
        settings: current.settings,
      };
    });
    setAdminMessage("Workspace wyczyszczony.");
  }
  async function resetPin(userId: string) {
    const pin = adminPins[userId] ?? "";
    if (!/^\d{4,10}$/.test(pin)) {
      setAdminMessage("PIN administratora musi mieć 4–10 cyfr.");
      return;
    }
    const response = await fetch("/api/admin/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newPin: pin }),
    });
    setAdminMessage(
      response.ok ? "PIN zresetowany." : "Nie udało się zresetować PIN-u.",
    );
    if (response.ok) setAdminPins((current) => ({ ...current, [userId]: "" }));
  }
  async function changeOwnPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth/change-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      await onPinChanged(newPin);
      setCurrentPin("");
      setNewPin("");
      setAdminMessage("PIN zmieniony. Pozostałe sesje zostały unieważnione.");
    } else setAdminMessage(data.error ?? "Nie udało się zmienić PIN-u.");
  }
  async function setRole(userId: string, role: "user" | "admin") {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (response.ok) {
      setAdminUsers((current) => current.map((user) => user.id === userId ? { ...user, role } : user));
      setAdminMessage("Rola została zmieniona.");
    } else setAdminMessage("Nie udało się zmienić roli.");
  }
  async function deleteUser(userId: string, name: string) {
    if (!window.confirm(`Usunąć konto „${name}” wraz z jego danymi?`)) return;
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) {
      setAdminUsers((current) => current.filter((user) => user.id !== userId));
      setAdminMessage("Konto usunięte.");
    } else setAdminMessage("Nie udało się usunąć konta.");
  }
  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="settings-title">
          <span>
            <UserRound size={20} />
          </span>
          <div>
            <h2>Profil</h2>
            <p>
              {profile.name} · @{profile.username} ·{" "}
              {profile.role === "admin" ? "administrator" : "użytkownik"}
            </p>
          </div>
          <em className={profile.serverLinked ? "linked" : ""}>
            {profile.serverLinked ? "Synchronizacja aktywna" : "Tylko lokalnie"}
          </em>
        </div>
        <nav className="settings-jump-nav" aria-label="Sekcje ustawień">
          <a href="#settings-appearance">Wygląd</a>
          <a href="#settings-interface">Interfejs</a>
          <a href="#settings-focus">Focus</a>
          <a href="#settings-learning">Nauka</a>
          <a href="#settings-planner">Planer</a>
          <a href="#settings-pwa">PWA</a>
          <a href="#settings-data">Dane</a>
        </nav>
        {profile.serverLinked ? (
          <form className="settings-group pin-change-form" onSubmit={(event) => void changeOwnPin(event)}>
            <h3>Zmień PIN</h3>
            <p className="quiet-copy">Użyj 4–10 cyfr. Zmiana wyloguje pozostałe urządzenia.</p>
            <div className="form-grid">
              <label>
                Obecny PIN
                <input value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} inputMode="numeric" autoComplete="current-password" type="password" minLength={4} maxLength={10} required />
              </label>
              <label>
                Nowy PIN
                <input value={newPin} onChange={(event) => setNewPin(event.target.value)} inputMode="numeric" autoComplete="new-password" type="password" minLength={6} maxLength={10} required />
              </label>
            </div>
            <div className="form-actions"><button className="button button-secondary" type="submit"><KeyRound size={16} /> Zmień PIN</button></div>
          </form>
        ) : null}
        <div className="settings-group" id="settings-appearance">
          <h3>Wygląd</h3>
          <div className="appearance-presets" aria-label="Gotowe profile wyglądu">
            <button
              onClick={() =>
                applySettings({
                  theme: "light",
                  accent: "sage",
                  fontScale: "comfortable",
                  density: "comfortable",
                  reducedMotion: false,
                })
              }
            >
              <strong>Spokojny</strong><small>jasny · szałwia</small>
            </button>
            <button
              onClick={() =>
                applySettings({
                  theme: "dark",
                  accent: "violet",
                  fontScale: "comfortable",
                  density: "spacious",
                  reducedMotion: false,
                })
              }
            >
              <strong>Nocna nauka</strong><small>ciemny · fiolet</small>
            </button>
            <button
              onClick={() =>
                applySettings({
                  theme: "system",
                  accent: "blue",
                  fontScale: "large",
                  density: "comfortable",
                  reducedMotion: false,
                })
              }
            >
              <strong>Czytelny</strong><small>duży tekst · niebieski</small>
            </button>
            <button
              onClick={() =>
                applySettings({
                  theme: "system",
                  accent: "mono",
                  fontScale: "normal",
                  density: "compact",
                  reducedMotion: true,
                  minimalFocusMode: true,
                })
              }
            >
              <strong>Minimalny</strong><small>kompaktowy · bez ruchu</small>
            </button>
          </div>
          <div className="theme-options">
            {THEME_OPTIONS.map((theme) => {
              const ThemeIcon = theme.icon;
              return (
                <button
                  className={state.settings.theme === theme.id ? "active" : ""}
                  key={theme.id}
                  title={theme.description}
                  onClick={() => setSetting("theme", theme.id)}
                >
                  <ThemeIcon size={18} />
                  <span>{theme.label}</span>
                </button>
              );
            })}
          </div>
          <div className="appearance-subgroup">
            <span className="appearance-label">
              <Palette size={15} /> Kolor akcentu
            </span>
            <div className="accent-options">
              {ACCENT_OPTIONS.map((accent) => (
                <button
                  className={
                    state.settings.accent === accent.id ? "active" : ""
                  }
                  key={accent.id}
                  onClick={() => setSetting("accent", accent.id)}
                  title={accent.label}
                  aria-label={`Kolor: ${accent.label}`}
                >
                  <i style={{ background: accent.color }} />
                  <span>{accent.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-subgroup font-scale-setting">
            <span className="appearance-label">
              <Type size={15} /> Rozmiar tekstu
            </span>
            <div className="segmented">
              {(
                [
                  ["normal", "Standard"],
                  ["comfortable", "Wygodny"],
                  ["large", "Duży"],
                ] as [FontScale, string][]
              ).map(([scale, label]) => (
                <button
                  className={state.settings.fontScale === scale ? "active" : ""}
                  key={scale}
                  onClick={() => setSetting("fontScale", scale)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-subgroup font-scale-setting">
            <span className="appearance-label">
              <Gauge size={15} /> Gęstość interfejsu
            </span>
            <div className="segmented">
              {(
                [
                  ["compact", "Kompaktowy"],
                  ["comfortable", "Wygodny"],
                  ["spacious", "Przestronny"],
                ] as [InterfaceDensity, string][]
              ).map(([density, label]) => (
                <button
                  className={state.settings.density === density ? "active" : ""}
                  key={density}
                  onClick={() => setSetting("density", density)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="switch-row">
            <span>
              <strong>Ogranicz animacje</strong>
              <small>
                Spokojniejsze przejścia i mniej ruchu w interfejsie.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.reducedMotion}
              onChange={(event) =>
                setSetting("reducedMotion", event.target.checked)
              }
            />
          </label>
        </div>
        <div className="settings-group" id="settings-interface">
          <h3>Interfejs i zadania</h3>
          <div className="configuration-grid">
            <label>
              Ekran po zalogowaniu
              <select
                value={state.settings.defaultView}
                onChange={(event) =>
                  setSetting("defaultView", event.target.value as ViewId)
                }
              >
                <option value="home">Dzisiaj</option>
                <option value="tasks">Zadania</option>
                <option value="focus">Skupienie</option>
                <option value="learn">Nauka</option>
                <option value="planner">Planer</option>
                <option value="more">Więcej</option>
              </select>
            </label>
            <label>
              Sortowanie zadań
              <select
                value={state.settings.taskSort}
                onChange={(event) =>
                  setSetting("taskSort", event.target.value as TaskSort)
                }
              >
                <option value="smart">Inteligentne</option>
                <option value="deadline">Najbliższy termin</option>
                <option value="created">Najnowsze</option>
                <option value="alphabetical">Alfabetyczne</option>
              </select>
            </label>
            <label>
              Domyślny przedmiot
              <select
                value={state.settings.defaultSubjectId}
                onChange={(event) =>
                  setSetting("defaultSubjectId", event.target.value)
                }
              >
                <option value="">Pierwszy z listy / brak</option>
                {state.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Domyślny czas zadania (min)
              <input
                type="number"
                min="5"
                max="600"
                value={state.settings.defaultTaskEstimate}
                onChange={(event) =>
                  setSetting("defaultTaskEstimate", Number(event.target.value))
                }
              />
            </label>
            <label>
              Domyślny priorytet
              <select
                value={state.settings.defaultTaskPriority}
                onChange={(event) =>
                  setSetting(
                    "defaultTaskPriority",
                    Number(event.target.value) as 1 | 2 | 3,
                  )
                }
              >
                <option value="1">Niski</option>
                <option value="2">Średni</option>
                <option value="3">Wysoki</option>
              </select>
            </label>
            <label>
              Domyślna trudność
              <select
                value={state.settings.defaultTaskDifficulty}
                onChange={(event) =>
                  setSetting(
                    "defaultTaskDifficulty",
                    Number(event.target.value) as 1 | 2 | 3 | 4 | 5,
                  )
                }
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Domyślne powtarzanie
              <select
                value={state.settings.defaultTaskRecurring}
                onChange={(event) =>
                  setSetting(
                    "defaultTaskRecurring",
                    event.target
                      .value as WorkspaceState["tasks"][number]["recurring"],
                  )
                }
              >
                <option value="none">Nie powtarzaj</option>
                <option value="daily">Codziennie</option>
                <option value="weekly">Co tydzień</option>
                <option value="monthly">Co miesiąc</option>
              </select>
            </label>
          </div>
          <label className="switch-row">
            <span>
              <strong>Pokazuj ukończone zadania</strong>
              <small>Udostępnia filtry „Gotowe” i „Wszystkie”.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.showCompletedTasks}
              onChange={(event) =>
                setSetting("showCompletedTasks", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Potwierdzaj usuwanie</strong>
              <small>
                Chroni zadania, fiszki i przedmioty przed przypadkowym
                usunięciem.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.confirmBeforeDelete}
              onChange={(event) =>
                setSetting("confirmBeforeDelete", event.target.checked)
              }
            />
          </label>
        </div>

        <div className="settings-group" id="settings-focus">
          <div className="settings-group-heading">
            <div>
              <h3>Focus i własne tryby timera</h3>
              <p>Każdy tryb może mieć własną nazwę, długość pracy i przerwy.</p>
            </div>
            <button className="button button-secondary" onClick={addTimerMode}>
              <Plus size={16} /> Dodaj tryb
            </button>
          </div>
          <div className="configuration-grid">
            <label>
              Tryb domyślny
              <select
                value={state.settings.defaultTimerMode}
                onChange={(event) =>
                  setSetting("defaultTimerMode", event.target.value)
                }
              >
                {state.settings.timerModes
                  .filter((mode) => mode.enabled !== false)
                  .map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Długa przerwa po
              <input
                type="number"
                min="2"
                max="12"
                value={state.settings.longBreakAfter}
                onChange={(event) =>
                  setSetting("longBreakAfter", Number(event.target.value))
                }
              />
            </label>
            <label>
              Długa przerwa (min)
              <input
                type="number"
                min="1"
                max="90"
                value={state.settings.longBreakMinutes}
                onChange={(event) =>
                  setSetting("longBreakMinutes", Number(event.target.value))
                }
              />
            </label>
            <label>
              Dzienny cel skupienia (min)
              <input
                type="number"
                min="5"
                max="720"
                step="5"
                value={state.settings.dailyFocusGoalMinutes}
                onChange={(event) =>
                  setSetting(
                    "dailyFocusGoalMinutes",
                    Math.min(720, Math.max(5, Number(event.target.value) || 5)),
                  )
                }
              />
            </label>
          </div>
          <div className="timer-mode-editor">
            {state.settings.timerModes.map((mode) => (
              <article
                key={mode.id}
                className={mode.enabled === false ? "disabled" : ""}
              >
                <input
                  className="timer-mode-name"
                  aria-label={`Nazwa trybu ${mode.label}`}
                  value={mode.label}
                  onChange={(event) =>
                    updateTimerMode(mode.id, { label: event.target.value })
                  }
                />
                <label>
                  Focus
                  <input
                    type="number"
                    min="0"
                    max="360"
                    disabled={mode.countUp}
                    value={mode.focus}
                    onChange={(event) =>
                      updateTimerMode(mode.id, {
                        focus: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Przerwa
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={mode.break}
                    onChange={(event) =>
                      updateTimerMode(mode.id, {
                        break: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="mini-check">
                  <input
                    type="checkbox"
                    checked={Boolean(mode.countUp)}
                    onChange={(event) =>
                      updateTimerMode(mode.id, {
                        countUp: event.target.checked,
                      })
                    }
                  />
                  Stoper
                </label>
                <label className="mini-check">
                  <input
                    type="checkbox"
                    checked={mode.enabled !== false}
                    onChange={() => toggleTimerMode(mode)}
                  />
                  Aktywny
                </label>
                <button
                  className="icon-button danger"
                  disabled={state.settings.timerModes.length <= 1}
                  aria-label={`Usuń tryb ${mode.label}`}
                  onClick={() => removeTimerMode(mode.id)}
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
          <label className="switch-row">
            <span>
              <strong>Adaptacyjna długość skupienia</strong>
              <small>Po wyborze energii dopasowuje czas do wyników ostatnich sesji.</small>
            </span>
            <input type="checkbox" checked={state.settings.adaptiveFocusDuration} onChange={(event) => setSetting("adaptiveFocusDuration", event.target.checked)} />
          </label>
          <label className="switch-row">
            <span>
              <strong>Wykrywaj bezczynność</strong>
              <small>Zatrzymuje timer i oznacza przerwę w koncentracji.</small>
            </span>
            <input type="checkbox" checked={state.settings.autoPauseWhenIdle} onChange={(event) => setSetting("autoPauseWhenIdle", event.target.checked)} />
          </label>
          {state.settings.autoPauseWhenIdle ? (
            <label className="setting-inline-field">Automatyczna pauza po <input type="number" min="1" max="60" value={state.settings.idleMinutes} onChange={(event) => setSetting("idleMinutes", Number(event.target.value))} /> minutach</label>
          ) : null}
          <label className="switch-row">
            <span>
              <strong>Mały timer Picture-in-Picture</strong>
              <small>Pokazuje przycisk niezależnego okna na obsługiwanych przeglądarkach.</small>
            </span>
            <input type="checkbox" checked={state.settings.showPictureInPicture} onChange={(event) => setSetting("showPictureInPicture", event.target.checked)} />
          </label>
          <label className="switch-row">
            <span>
              <strong>Tarcza skupienia</strong>
              <small>Pełny ekran ukrywa nawigację i skróty. Przeglądarka nie może blokować innych aplikacji bez osobnego rozszerzenia.</small>
            </span>
            <input type="checkbox" checked={state.settings.focusShield} onChange={(event) => setSetting("focusShield", event.target.checked)} />
          </label>
          {state.settings.focusShield ? (
            <label>
              Domeny do unikania podczas nauki (po jednej w linii)
              <textarea
                value={state.settings.blockedDomains.join("\n")}
                onChange={(event) => setSetting("blockedDomains", event.target.value.split(/\r?\n/).map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 100))}
                placeholder="youtube.com\ninstagram.com\ntiktok.com"
              />
            </label>
          ) : null}
          <label className="switch-row">
            <span><strong>Sygnały końca etapów</strong><small>Osobny dźwięk rozpoczynający przerwę i powrót do skupienia.</small></span>
            <input type="checkbox" checked={state.settings.timerSoundEnabled} onChange={(event) => setSetting("timerSoundEnabled", event.target.checked)} />
          </label>
          {state.settings.timerSoundEnabled ? <label className="setting-inline-field">Głośność sygnałów <input type="range" min="0" max="1" step="0.05" value={state.settings.timerSoundVolume} onChange={(event) => setSetting("timerSoundVolume", Number(event.target.value))} aria-label="Głośność sygnałów timera" /> {Math.round(state.settings.timerSoundVolume * 100)}%</label> : null}
          <label className="switch-row">
            <span>
              <strong>Automatycznie rozpocznij przerwę</strong>
              <small>Timer przejdzie dalej po zakończonej sesji.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.autoStartBreak}
              onChange={(event) =>
                setSetting("autoStartBreak", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Automatycznie wróć do skupienia</strong>
              <small>
                Po przerwie uruchamia kolejny etap bez dodatkowego kliknięcia.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.autoStartFocus}
              onChange={(event) =>
                setSetting("autoStartFocus", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Nie wygaszaj ekranu</strong>
              <small>Używa Wake Lock tylko podczas aktywnego timera.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.keepScreenAwake}
              onChange={(event) =>
                setSetting("keepScreenAwake", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Pełny ekran po starcie</strong>
              <small>
                Kliknięcie „Start” uruchamia sesję w trybie pełnoekranowym,
                jeśli pozwala na to przeglądarka.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.fullscreenOnTimerStart}
              onChange={(event) =>
                setSetting("fullscreenOnTimerStart", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Wyjdź z pełnego ekranu po pauzie</strong>
              <small>Przywraca cały interfejs po zatrzymaniu lub końcu sesji.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.exitFullscreenOnPause}
              onChange={(event) =>
                setSetting("exitFullscreenOnPause", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Minimalny widok skupienia</strong>
              <small>Podczas pracy ukrywa boczny panel i zostawia timer oraz cel.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.minimalFocusMode}
              onChange={(event) =>
                setSetting("minimalFocusMode", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Powiadomienia</strong>
              <small>Alarm po zakończeniu etapu.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.notifications}
              onChange={(event) =>
                setSetting("notifications", event.target.checked)
              }
            />
          </label>
        </div>

        <div className="settings-group" id="settings-learning">
          <h3>Nauka i inteligentne fiszki</h3>
          <div className="configuration-grid">
            <label>
              Dzienny cel powtórek
              <input
                type="number"
                min="1"
                max="500"
                value={state.settings.dailyReviewGoal}
                onChange={(event) =>
                  setSetting("dailyReviewGoal", Number(event.target.value))
                }
              />
            </label>
            <label>
              Limit jednej sesji
              <input
                type="number"
                min="1"
                max="500"
                value={state.settings.reviewLimit}
                onChange={(event) =>
                  setSetting("reviewLimit", Number(event.target.value))
                }
              />
            </label>
            <label>
              Kolejność powtórek
              <select
                value={state.settings.reviewOrder}
                onChange={(event) =>
                  setSetting("reviewOrder", event.target.value as ReviewOrder)
                }
              >
                <option value="smart">Inteligentna</option>
                <option value="due">Najbardziej zaległe</option>
                <option value="random">Mieszana</option>
              </select>
            </label>
            <label>
              Domyślna talia
              <input
                value={state.settings.defaultDeck}
                onChange={(event) =>
                  setSetting("defaultDeck", event.target.value)
                }
                placeholder="Ogólne"
              />
            </label>
          </div>
          <label className="switch-row">
            <span>
              <strong>Odwróć fiszkę kliknięciem</strong>
              <small>
                Wyłączenie wymaga użycia przycisku „Pokaż odpowiedź”.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.flipCardOnClick}
              onChange={(event) =>
                setSetting("flipCardOnClick", event.target.checked)
              }
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Pokazuj poradnik metod nauki</strong>
              <small>
                Wyświetla zastosowania, polecane przedmioty i instrukcję krok po kroku.
              </small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.showStudyMethodGuides}
              onChange={(event) =>
                setSetting("showStudyMethodGuides", event.target.checked)
              }
            />
          </label>
          <div className="study-method-settings">
            {STUDY_METHOD_OPTIONS.map((method) => (
              <article key={method.id}>
                <label className="mini-check">
                  <input
                    type="checkbox"
                    checked={state.settings.enabledStudyMethods.includes(
                      method.id,
                    )}
                    onChange={() => toggleStudyMethod(method.id)}
                  />
                  <strong>{method.label}</strong>
                </label>
                <label>
                  Czas
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={state.settings.studyMethodMinutes[method.id]}
                    onChange={(event) =>
                      setSetting("studyMethodMinutes", {
                        ...state.settings.studyMethodMinutes,
                        [method.id]: Number(event.target.value),
                      })
                    }
                  />
                  min
                </label>
              </article>
            ))}
          </div>
        </div>

        <div className="settings-group" id="settings-planner">
          <h3>Planer i dzień pracy</h3>
          <div className="configuration-grid">
            <label>
              Widok domyślny
              <select
                value={state.settings.plannerDefaultMode}
                onChange={(event) =>
                  setSetting(
                    "plannerDefaultMode",
                    event.target.value as PlannerMode,
                  )
                }
              >
                <option value="day">Dzień</option>
                <option value="week">Tydzień</option>
                <option value="month">Miesiąc</option>
              </select>
            </label>
            <label>
              Domyślny blok (min)
              <input
                type="number"
                min="5"
                max="480"
                value={state.settings.defaultBlockMinutes}
                onChange={(event) =>
                  setSetting("defaultBlockMinutes", Number(event.target.value))
                }
              />
            </label>
            <label>
              Początek osi czasu
              <input
                type="number"
                min="0"
                max="23"
                value={state.settings.workdayStartHour}
                onChange={(event) =>
                  setSetting("workdayStartHour", Number(event.target.value))
                }
              />
            </label>
            <label>
              Koniec osi czasu
              <input
                type="number"
                min="0"
                max="23"
                value={state.settings.workdayEndHour}
                onChange={(event) =>
                  setSetting("workdayEndHour", Number(event.target.value))
                }
              />
            </label>
            <label>
              Pierwszy dzień tygodnia
              <select
                value={state.settings.weekStartsOn}
                onChange={(event) =>
                  setSetting(
                    "weekStartsOn",
                    Number(event.target.value) as 0 | 1,
                  )
                }
              >
                <option value="1">Poniedziałek</option>
                <option value="0">Niedziela</option>
              </select>
            </label>
          </div>
        </div>

        <div className="settings-group" id="settings-pwa">
          <h3>Powiadomienia i PWA</h3>
          <label className="switch-row">
            <span>
              <strong>Powiadomienia timera</strong>
              <small>Informują o końcu etapu, gdy Focus OS jest otwarty.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.notifications}
              onChange={(event) =>
                setSetting("notifications", event.target.checked)
              }
            />
          </label>
          <button
            className="button button-secondary"
            onClick={() => {
              if (!("Notification" in window)) {
                setAdminMessage("Ta przeglądarka nie obsługuje powiadomień.");
                return;
              }
              void Notification.requestPermission().then((permission) =>
                setAdminMessage(
                  permission === "granted"
                    ? "Powiadomienia są włączone."
                    : "Przeglądarka nie udzieliła zgody na powiadomienia.",
                ),
              );
            }}
          >
            <Bell size={16} /> Zezwól na powiadomienia
          </button>
          <PwaInstallButton />
          <p className="quiet-copy">Powiadomienia działają podczas otwartej aplikacji. Przypomnienia w tle wymagają zewnętrznej usługi push i nie wysyłają danych bez Twojej konfiguracji.</p>
        </div>
        <div className="settings-group data-actions" id="settings-data">
          <h3>Dane</h3>
          <input
            hidden
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            onChange={restoreData}
          />
          <div className="button-group">
            <button className="button button-secondary" onClick={downloadData}>
              <Download size={17} />
              Eksportuj backup
            </button>
            <button
              className="button button-secondary"
              onClick={() => backupRef.current?.click()}
            >
              <Upload size={17} />
              Przywróć backup
            </button>
            <button
              className="button button-quiet danger-action"
              onClick={clearWorkspace}
            >
              <Trash2 size={17} />
              Wyczyść workspace
            </button>
            <button className="button button-quiet" onClick={resetSettings}>
              <RefreshCw size={17} /> Ustawienia domyślne
            </button>
          </div>
          {adminMessage ? <p className="form-success">{adminMessage}</p> : null}
        </div>
      </section>
      {profile.role === "admin" ? (
        <section className="panel admin-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                <ShieldCheck size={14} /> ADMIN
              </p>
              <h2>Użytkownicy</h2>
            </div>
            <Users size={20} />
          </div>
          {profile.serverLinked ? (
            adminUsers.map((user) => (
              <article key={user.id}>
                <span>
                  <strong>{user.name}</strong>
                  <small>
                    @{user.username} · {user.role}
                    {user.lockedUntil ? " · zablokowany" : ""}
                  </small>
                </span>
                <button
                  className="button button-quiet"
                  onClick={() => resetPin(user.id)}
                >
                  <KeyRound size={15} />
                  Resetuj PIN
                </button>
                <input
                  aria-label={`Nowy PIN dla ${user.name}`}
                  value={adminPins[user.id] ?? ""}
                  onChange={(event) => setAdminPins((current) => ({ ...current, [user.id]: event.target.value }))}
                  inputMode="numeric"
                  placeholder="Nowy PIN"
                  type="password"
                  minLength={6}
                  maxLength={10}
                />
                <select
                  aria-label={`Rola ${user.name}`}
                  value={user.role}
                  disabled={user.id === profile.serverUserId}
                  onChange={(event) => void setRole(user.id, event.target.value as "user" | "admin")}
                >
                  <option value="user">Użytkownik</option>
                  <option value="admin">Administrator</option>
                </select>
                <button
                  className="icon-button danger"
                  aria-label={`Usuń konto ${user.name}`}
                  disabled={user.id === profile.serverUserId}
                  onClick={() => void deleteUser(user.id, user.name)}
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))
          ) : (
            <p>Połącz profil z SQLite, aby zarządzać użytkownikami.</p>
          )}
          {adminMessage ? <p className="form-success">{adminMessage}</p> : null}
        </section>
      ) : (
        <section className="panel security-panel">
          <LockKeyhole size={22} />
          <div>
            <h2>Twoje dane są prywatne</h2>
            <p>
              PIN nie jest przechowywany w postaci jawnej. Każdy profil ma
              osobny workspace.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

const average = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
function habitStreak(checks: string[]) {
  const days = new Set(checks);
  let streak = 0;
  const cursor = new Date();
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
