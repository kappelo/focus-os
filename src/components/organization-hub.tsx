"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleGauge,
  FolderKanban,
  Gift,
  Medal,
  Plus,
  Shield,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";
import {
  activityStreak,
  challengeProgress,
  levelFromXp,
  taskQuadrant,
  weekSummary,
} from "@/lib/progress";
import type {
  StudyProject,
  Task,
  WeeklyChallenge,
  WorkspaceState,
} from "@/lib/types";

type OrganizationTab = "projects" | "matrix" | "motivation";
type UpdateWorkspace = (recipe: (state: WorkspaceState) => WorkspaceState) => void;

const QUADRANTS: {
  id: NonNullable<Task["quadrant"]>;
  title: string;
  caption: string;
}[] = [
  { id: "do", title: "Zrób teraz", caption: "Ważne i pilne" },
  { id: "schedule", title: "Zaplanuj", caption: "Ważne, niepilne" },
  { id: "delegate", title: "Ogranicz", caption: "Pilne, mniej ważne" },
  { id: "eliminate", title: "Usuń", caption: "Niepilne i mniej ważne" },
];

const BADGES = [
  { id: "first-focus", label: "Pierwszy fokus", test: (state: WorkspaceState) => state.sessions.length >= 1 },
  { id: "ten-hours", label: "10 godzin skupienia", test: (state: WorkspaceState) => state.sessions.reduce((sum, item) => sum + item.durationMinutes, 0) >= 600 },
  { id: "review-100", label: "100 powtórek", test: (state: WorkspaceState) => state.flashcardReviews.length >= 100 },
  { id: "perfect-quiz", label: "Quiz 100%", test: (state: WorkspaceState) => state.quizAttempts.some((item) => item.score === 100) },
  { id: "project-finished", label: "Projekt ukończony", test: (state: WorkspaceState) => state.projects.some((item) => item.status === "completed") },
  { id: "streak-7", label: "Seria 7 dni", test: (state: WorkspaceState) => activityStreak(state).streak >= 7 },
] as const;

export function OrganizationHub({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [tab, setTab] = useState<OrganizationTab>("projects");
  return (
    <div className="page-stack compact-stack">
      <nav className="subtabs organization-tabs" aria-label="Organizacja i motywacja">
        <button className={tab === "projects" ? "active" : ""} onClick={() => setTab("projects")}><FolderKanban size={17} /> Projekty i cele</button>
        <button className={tab === "matrix" ? "active" : ""} onClick={() => setTab("matrix")}><CircleGauge size={17} /> Macierz priorytetów</button>
        <button className={tab === "motivation" ? "active" : ""} onClick={() => setTab("motivation")}><Trophy size={17} /> Motywacja</button>
      </nav>
      {tab === "projects" ? <Projects state={state} onUpdate={onUpdate} /> : null}
      {tab === "matrix" ? <EisenhowerMatrix state={state} onUpdate={onUpdate} /> : null}
      {tab === "motivation" ? <Motivation state={state} onUpdate={onUpdate} /> : null}
    </div>
  );
}

function Projects({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const visible = state.projects.filter((project) => showArchived || project.status !== "archived");
  function createTemplate(template: "matura" | "exam" | "weekly") {
    const now = new Date();
    const finish = new Date(now);
    finish.setDate(finish.getDate() + (template === "matura" ? 90 : template === "exam" ? 14 : 7));
    const titles = template === "matura"
      ? ["Diagnoza poziomu", "Powtórka teorii", "Zadania maturalne", "Arkusze próbne"]
      : template === "exam"
        ? ["Zakres materiału", "Active recall", "Zadania", "Próbny test"]
        : ["Priorytety", "Sesje głębokiej pracy", "Powtórki", "Podsumowanie"];
    const nowIso = now.toISOString();
    const projectId = createId();
    const project: StudyProject = {
      id: projectId,
      title: template === "matura" ? "Przygotowanie do matury" : template === "exam" ? "Plan do sprawdzianu" : "Tydzień nauki",
      description: "Projekt utworzony z szablonu — dostosuj rozdziały i terminy do siebie.",
      goalDate: localDateKey(finish),
      targetMinutes: template === "matura" ? 5_400 : template === "exam" ? 900 : 420,
      status: "active",
      tags: ["szablon"],
      chapters: titles.map((title) => ({ id: createId(), title, mastery: 0, completed: false, checklist: [{ id: createId(), label: "Przejrzyj zakres", done: false }, { id: createId(), label: "Sprawdź się bez notatek", done: false }] })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const tasks: Task[] = titles.map((title, index) => ({
      id: createId(), title, description: `Etap projektu: ${project.title}`, topic: title,
      deadline: new Date(now.getTime() + ((index + 1) / titles.length) * (finish.getTime() - now.getTime())).toISOString(),
      priority: index === titles.length - 1 ? 3 : 2, difficulty: 2, estimateMinutes: template === "matura" ? 90 : 45,
      actualMinutes: 0, plannedPomodoros: template === "matura" ? 3 : 2, completedPomodoros: 0,
      status: "todo", tags: ["projekt"], subtasks: [], recurring: "none", projectId,
      dependsOn: [], createdAt: nowIso, updatedAt: nowIso,
    }));
    tasks.forEach((task, index) => { if (index) task.dependsOn = [tasks[index - 1].id]; });
    onUpdate((current) => ({ ...current, projects: [project, ...current.projects], tasks: [...tasks, ...current.tasks] }));
  }
  return (
    <div className="page-stack compact-stack">
      <section className="panel project-toolbar">
        <div><p className="eyebrow">WIĘKSZY CEL → MAŁE KROKI</p><h2>Projekty nauki</h2><p>Połącz rozdziały, checklisty, zadania, czas i termin w jeden mierzalny cel.</p></div>
        <div className="button-group"><button className="button button-quiet" onClick={() => setShowArchived((value) => !value)}><Archive size={16} /> {showArchived ? "Ukryj archiwum" : "Archiwum"}</button><button className="button button-primary" onClick={() => setCreating(true)}><Plus size={17} /> Nowy projekt</button></div>
      </section>
      <div className="template-strip"><span>Szablony:</span><button onClick={() => createTemplate("matura")}>Matura 90 dni</button><button onClick={() => createTemplate("exam")}>Sprawdzian 14 dni</button><button onClick={() => createTemplate("weekly")}>Dobry tydzień</button></div>
      {visible.length ? <div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} state={state} onUpdate={onUpdate} />)}</div> : <EmptyState icon={FolderKanban} title="Brak projektów" text="Utwórz własny cel albo wybierz gotowy szablon." />}
      {creating ? <ProjectForm subjects={state.subjects} onClose={() => setCreating(false)} onSave={(project) => { onUpdate((current) => ({ ...current, projects: [project, ...current.projects] })); setCreating(false); }} /> : null}
    </div>
  );
}

function ProjectCard({ project, state, onUpdate }: { project: StudyProject; state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [chapterTitle, setChapterTitle] = useState("");
  const projectTasks = state.tasks.filter((task) => task.projectId === project.id);
  const completedChapters = project.chapters.filter((item) => item.completed).length;
  const completedTasks = projectTasks.filter((item) => item.status === "done").length;
  const chapterProgress = project.chapters.length ? completedChapters / project.chapters.length : 0;
  const taskProgress = projectTasks.length ? completedTasks / projectTasks.length : 0;
  const progress = Math.round((chapterProgress * 0.6 + taskProgress * 0.4) * 100);
  const minutes = state.sessions.filter((session) => projectTasks.some((task) => task.id === session.taskId)).reduce((sum, session) => sum + session.durationMinutes, 0);
  function patchProject(recipe: (value: StudyProject) => StudyProject) {
    onUpdate((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? { ...recipe(item), updatedAt: new Date().toISOString() } : item) }));
  }
  return <article className="panel project-card-v2"><header><div><small>{project.status === "archived" ? "ARCHIWUM" : project.status === "completed" ? "UKOŃCZONY" : "AKTYWNY CEL"}</small><h2>{project.title}</h2></div><select aria-label="Status projektu" value={project.status} onChange={(event) => patchProject((item) => ({ ...item, status: event.target.value as StudyProject["status"] }))}><option value="active">Aktywny</option><option value="completed">Ukończony</option><option value="archived">Archiwum</option></select></header><p>{project.description}</p><div className="project-progress"><div><span>Łączny postęp</span><strong>{progress}%</strong></div><i><span style={{ width: `${progress}%` }} /></i></div><div className="project-metrics"><span><b>{minutes}</b> / {project.targetMinutes} min</span><span><b>{completedChapters}</b> / {project.chapters.length} rozdziałów</span><span><b>{completedTasks}</b> / {projectTasks.length} zadań</span></div><details className="chapter-details" open><summary><span>Rozdziały i checklisty</span><ChevronDown size={16} /></summary><div className="chapter-list">{project.chapters.map((chapter) => <article key={chapter.id}><label className="chapter-title"><input type="checkbox" checked={chapter.completed} onChange={(event) => patchProject((item) => ({ ...item, chapters: item.chapters.map((entry) => entry.id === chapter.id ? { ...entry, completed: event.target.checked, mastery: event.target.checked ? 100 : entry.mastery } : entry) }))} /><strong>{chapter.title}</strong><span>{chapter.mastery}%</span></label><input aria-label={`Opanowanie ${chapter.title}`} type="range" min="0" max="100" value={chapter.mastery} onChange={(event) => patchProject((item) => ({ ...item, chapters: item.chapters.map((entry) => entry.id === chapter.id ? { ...entry, mastery: Number(event.target.value), completed: Number(event.target.value) === 100 } : entry) }))} />{chapter.checklist.map((check) => <label className="checklist-row" key={check.id}><input type="checkbox" checked={check.done} onChange={(event) => patchProject((item) => ({ ...item, chapters: item.chapters.map((entry) => entry.id === chapter.id ? { ...entry, checklist: entry.checklist.map((line) => line.id === check.id ? { ...line, done: event.target.checked } : line) } : entry) }))} />{check.label}</label>)}</article>)}</div><div className="inline-form"><input value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)} placeholder="Nowy rozdział" /><button className="icon-button" aria-label="Dodaj rozdział" onClick={() => { if (!chapterTitle.trim()) return; patchProject((item) => ({ ...item, chapters: [...item.chapters, { id: createId(), title: chapterTitle.trim(), mastery: 0, completed: false, checklist: [] }] })); setChapterTitle(""); }}><Plus size={16} /></button></div></details><footer>{project.goalDate ? <span><CalendarCheck size={15} /> cel: {new Date(`${project.goalDate}T12:00:00`).toLocaleDateString("pl-PL")}</span> : <span>Bez terminu</span>}<button className="icon-button danger" aria-label="Usuń projekt" onClick={() => { if (state.settings.confirmBeforeDelete && !window.confirm(`Przenieść projekt „${project.title}” do kosza?`)) return; const now = new Date().toISOString(); onUpdate((current) => ({ ...current, projects: current.projects.filter((item) => item.id !== project.id), trash: [...current.trash, { id: createId(), collection: "projects", label: project.title, snapshot: project, deletedAt: now, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), createdAt: now }] })); }}><Trash2 size={15} /></button></footer></article>;
}

function ProjectForm({ subjects, onClose, onSave }: { subjects: WorkspaceState["subjects"]; onClose: () => void; onSave: (project: StudyProject) => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [subjectId, setSubjectId] = useState(""); const [goalDate, setGoalDate] = useState(""); const [targetMinutes, setTargetMinutes] = useState(600); const [chapters, setChapters] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); const now = new Date().toISOString(); onSave({ id: createId(), title: title.trim(), description: description.trim(), subjectId: subjectId || undefined, goalDate: goalDate || undefined, targetMinutes, status: "active", tags: [], chapters: chapters.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).map((item) => ({ id: createId(), title: item, mastery: 0, completed: false, checklist: [{ id: createId(), label: "Poznaj teorię", done: false }, { id: createId(), label: "Sprawdź się", done: false }] })), createdAt: now, updatedAt: now }); }
  return <Modal title="Nowy projekt nauki" onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Nazwa<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Matura z matematyki" /></label><label>Opis<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="form-grid"><label>Przedmiot<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Ogólny</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label>Termin<input type="date" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} /></label><label>Cel minut<input type="number" min="30" max="100000" value={targetMinutes} onChange={(event) => setTargetMinutes(Math.max(30, Number(event.target.value) || 30))} /></label></div><label>Rozdziały — osobne linie<textarea value={chapters} onChange={(event) => setChapters(event.target.value)} placeholder="Funkcje\nCiągi\nGeometria" /></label><div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Anuluj</button><button className="button button-primary">Utwórz projekt</button></div></form></Modal>;
}

function EisenhowerMatrix({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const activeTasks = state.tasks.filter((task) => task.status !== "done");
  return <div className="eisenhower-grid">{QUADRANTS.map((quadrant) => { const tasks = activeTasks.filter((task) => taskQuadrant(task) === quadrant.id); return <section className={`panel quadrant quadrant-${quadrant.id}`} key={quadrant.id}><header><div><h2>{quadrant.title}</h2><p>{quadrant.caption}</p></div><span>{tasks.length}</span></header><div>{tasks.map((task) => <article key={task.id}><strong>{task.title}</strong><small>{task.deadline ? new Date(task.deadline).toLocaleDateString("pl-PL") : "Bez terminu"} · priorytet {task.priority}</small><select aria-label={`Kategoria ${task.title}`} value={taskQuadrant(task)} onChange={(event) => onUpdate((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, quadrant: event.target.value as NonNullable<Task["quadrant"]>, updatedAt: new Date().toISOString() } : item) }))}>{QUADRANTS.map((option) => <option value={option.id} key={option.id}>{option.title}</option>)}</select></article>)}</div>{!tasks.length ? <p className="empty-copy">Brak zadań w tej ćwiartce.</p> : null}</section>; })}</div>;
}

function Motivation({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [challengeOpen, setChallengeOpen] = useState(false); const [rewardTitle, setRewardTitle] = useState(""); const [rewardCost, setRewardCost] = useState(100);
  const level = levelFromXp(state.progress.xp); const availableXp = Math.max(0, state.progress.xp - state.progress.spentXp); const streak = activityStreak(state); const currentWeek = weekSummary(state); const previousWeek = weekSummary(state, -1);
  const badges = BADGES.map((badge) => ({ ...badge, unlocked: badge.test(state) || state.progress.unlockedBadges.some((item) => item.id === badge.id) }));
  function claimBadges() { const now = new Date().toISOString(); const newBadges = badges.filter((badge) => badge.test(state) && !state.progress.unlockedBadges.some((item) => item.id === badge.id)); if (!newBadges.length) return; onUpdate((current) => ({ ...current, progress: { ...current.progress, xp: current.progress.xp + newBadges.length * 25, unlockedBadges: [...current.progress.unlockedBadges, ...newBadges.map((badge) => ({ id: badge.id, unlockedAt: now }))] } })); }
  return <div className="page-stack compact-stack"><section className="panel level-hero"><span className="level-orb">{level.level}</span><div><p className="eyebrow">POZIOM {level.level}</p><h2>{state.progress.xp} XP zdobyte</h2><div className="level-progress"><i style={{ width: `${level.progress}%` }} /></div><small>{level.nextFloor - state.progress.xp} XP do następnego poziomu · {availableXp} XP dostępne na nagrody</small></div><div className="streak-card"><Shield size={22} /><strong>{streak.streak} dni</strong><small>serii · {streak.availableShields} osłony</small></div></section><div className="metric-grid"><article className="metric-card"><span>Ten tydzień</span><strong>{currentWeek.minutes} min</strong><small>{compare(currentWeek.minutes, previousWeek.minutes)} vs poprzedni</small></article><article className="metric-card"><span>Sesje</span><strong>{currentWeek.sessions}</strong><small>{compare(currentWeek.sessions, previousWeek.sessions)} vs poprzedni</small></article><article className="metric-card"><span>Powtórki</span><strong>{currentWeek.reviews}</strong><small>{compare(currentWeek.reviews, previousWeek.reviews)} vs poprzedni</small></article><article className="metric-card"><span>Zadania</span><strong>{currentWeek.tasks}</strong><small>{compare(currentWeek.tasks, previousWeek.tasks)} vs poprzedni</small></article></div><div className="tool-grid two-columns"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">WYZWANIA</p><h2>Cele tygodniowe</h2></div><button className="icon-button" onClick={() => setChallengeOpen(true)} aria-label="Dodaj wyzwanie"><Plus size={17} /></button></div><div className="challenge-list">{state.challenges.map((challenge) => { const progress = challengeProgress(challenge, state); const ready = progress >= challenge.target; return <article key={challenge.id}><div><strong>{challenge.title}</strong><small>{Math.min(progress, challenge.target)} / {challenge.target} · +{challenge.rewardXp} XP</small><i><span style={{ width: `${Math.min(100, progress / Math.max(1, challenge.target) * 100)}%` }} /></i></div>{ready && !challenge.completedAt ? <button className="button button-primary" onClick={() => { const now = new Date().toISOString(); onUpdate((current) => ({ ...current, challenges: current.challenges.map((item) => item.id === challenge.id ? { ...item, completedAt: now, updatedAt: now } : item), progress: { ...current.progress, xp: current.progress.xp + challenge.rewardXp } })); }}>Odbierz</button> : challenge.completedAt ? <Check size={19} /> : null}</article>; })}{!state.challenges.length ? <p className="empty-copy">Dodaj wyzwanie na ten tydzień.</p> : null}</div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ODZNAKI</p><h2>Kolekcja osiągnięć</h2></div><button className="button button-quiet" onClick={claimBadges}><Sparkles size={15} /> Odbierz</button></div><div className="badge-grid">{badges.map((badge) => <div className={badge.unlocked ? "unlocked" : ""} key={badge.id}><Medal size={22} /><span>{badge.label}</span></div>)}</div></section></div><div className="tool-grid two-columns"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">NAGRODY</p><h2>Twoja lista nagród</h2></div></div><form className="inline-form reward-form" onSubmit={(event) => { event.preventDefault(); if (!rewardTitle.trim()) return; const now = new Date().toISOString(); onUpdate((current) => ({ ...current, rewards: [...current.rewards, { id: createId(), title: rewardTitle.trim(), costXp: rewardCost, createdAt: now, updatedAt: now }] })); setRewardTitle(""); }}><input value={rewardTitle} onChange={(event) => setRewardTitle(event.target.value)} placeholder="np. Film bez wyrzutów sumienia" /><input aria-label="Koszt XP" type="number" min="10" max="10000" value={rewardCost} onChange={(event) => setRewardCost(Math.max(10, Number(event.target.value) || 10))} /><button className="icon-button"><Plus size={16} /></button></form><div className="reward-list">{state.rewards.map((reward) => <article key={reward.id}><Gift size={18} /><div><strong>{reward.title}</strong><small>{reward.costXp} XP</small></div><button className="button button-quiet" disabled={Boolean(reward.claimedAt) || availableXp < reward.costXp} onClick={() => { const now = new Date().toISOString(); onUpdate((current) => ({ ...current, rewards: current.rewards.map((item) => item.id === reward.id ? { ...item, claimedAt: now, updatedAt: now } : item), progress: { ...current.progress, spentXp: current.progress.spentXp + reward.costXp } })); }}>{reward.claimedAt ? "Odebrana" : "Odbierz"}</button></article>)}</div></section><section className="panel record-panel"><p className="eyebrow">REKORDY OSOBISTE</p><h2>Twoje najlepsze wyniki</h2><dl><div><dt>Najdłuższa sesja</dt><dd>{Math.max(0, ...state.sessions.map((item) => item.durationMinutes))} min</dd></div><div><dt>Najlepsza jakość</dt><dd>{Math.max(0, ...state.sessions.map((item) => item.quality))}%</dd></div><div><dt>Najlepszy quiz</dt><dd>{Math.max(0, ...state.quizAttempts.map((item) => item.score))}%</dd></div><div><dt>Najwięcej powtórek dziennie</dt><dd>{Math.max(0, ...state.reviewActivity.map((item) => item.count))}</dd></div></dl></section></div>{challengeOpen ? <ChallengeForm onClose={() => setChallengeOpen(false)} onSave={(challenge) => { onUpdate((current) => ({ ...current, challenges: [challenge, ...current.challenges] })); setChallengeOpen(false); }} /> : null}</div>;
}

function ChallengeForm({ onClose, onSave }: { onClose: () => void; onSave: (value: WeeklyChallenge) => void }) {
  const today = localDateKey(); const end = new Date(); end.setDate(end.getDate() + 6); const [title, setTitle] = useState(""); const [metric, setMetric] = useState<WeeklyChallenge["metric"]>("minutes"); const [target, setTarget] = useState(300); const [endDate, setEndDate] = useState(localDateKey(end)); const [rewardXp, setRewardXp] = useState(100);
  return <Modal title="Nowe wyzwanie" onClose={onClose}><form className="form-stack" onSubmit={(event) => { event.preventDefault(); const now = new Date().toISOString(); onSave({ id: createId(), title: title.trim(), metric, target, startDate: today, endDate, rewardXp, createdAt: now, updatedAt: now }); }}><label>Nazwa<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="form-grid"><label>Miernik<select value={metric} onChange={(event) => setMetric(event.target.value as WeeklyChallenge["metric"])}><option value="minutes">Minuty nauki</option><option value="sessions">Sesje</option><option value="reviews">Powtórki</option><option value="tasks">Zadania</option></select></label><label>Cel<input type="number" min="1" value={target} onChange={(event) => setTarget(Math.max(1, Number(event.target.value) || 1))} /></label><label>Do dnia<input type="date" min={today} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><label>Nagroda XP<input type="number" min="10" value={rewardXp} onChange={(event) => setRewardXp(Math.max(10, Number(event.target.value) || 10))} /></label></div><div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Anuluj</button><button className="button button-primary">Dodaj wyzwanie</button></div></form></Modal>;
}

function compare(current: number, previous: number) {
  if (!previous) return current ? "+100%" : "0%";
  const value = Math.round(((current - previous) / previous) * 100);
  return `${value >= 0 ? "+" : ""}${value}%`;
}
