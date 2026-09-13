"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Brain, CalendarDays, Check, Clock3, Flame, Play, Printer, Sparkles, Target } from "lucide-react";
import { localDateKey } from "@/lib/dates";
import { activityStreak } from "@/lib/progress";
import { buildStudyPlan, recentStudyDays, type StudyPlanStep } from "@/lib/study-plan";
import { normalizeWebUrl, shortcutCaption } from "@/lib/shortcuts";
import type { ViewId, WorkspaceState } from "@/lib/types";

export function Dashboard({ state, name, onNavigate, onEditShortcuts, onUpdate }: {
  state: WorkspaceState; name: string; onNavigate: (view: ViewId) => void;
  onEditShortcuts: () => void; onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const [energy, setEnergy] = useState(3);
  const [budget, setBudget] = useState(45);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const today = localDateKey(now);
  const minutes = state.sessions.filter((s) => localDateKey(s.startedAt) === today).reduce((sum, s) => sum + s.durationMinutes, 0);
  const reviewed = state.reviewActivity.filter((r) => r.date === today).reduce((sum, r) => sum + r.count, 0);
  const due = state.flashcards.filter((c) => !c.suspended && Date.parse(c.dueAt) <= now).length;
  const done = state.tasks.filter((t) => t.status === "done" && localDateKey(t.updatedAt) === today).length;
  const streak = activityStreak(state, new Date(now)).streak;
  const plan = buildStudyPlan(state, budget, energy, now);
  const week = recentStudyDays(state, new Date(now));
  const maxMinutes = Math.max(30, ...week.map((d) => d.minutes));
  const calendar = state.calendar.filter((b) => localDateKey(b.start) === today).sort((a, b) => a.start.localeCompare(b.start));
  const exam = [...state.exams].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const links = state.settings.shortcutLinks.filter((link) => link.enabled !== false && link.label.trim() && !["nowy skrót", "nowa strona"].includes(link.label.trim().toLocaleLowerCase("pl-PL")) && (link.kind === "view" || normalizeWebUrl(link.url ?? ""))).slice(0, state.settings.dashboardShortcutLimit);
  const firstSteps = !state.subjects.length && !state.tasks.length && !state.flashcards.length;
  function start(step: StudyPlanStep) {
    if (step.kind === "review") { openSection("learn", "flashcards"); return; }
    onUpdate((current) => ({ ...current, focusQueue: [step.taskId!, ...current.focusQueue.filter((id) => id !== step.taskId)] }));
    onNavigate("focus");
  }
  function openSection(view: ViewId, section: string) {
    onNavigate(view);
    const url = new URL(window.location.href);
    url.hash = section;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  function more(section: string) { openSection("more", section); }
  const percent = Math.min(100, Math.round(minutes / Math.max(1, state.settings.dailyFocusGoalMinutes) * 100));
  return <div className="page-stack study-home">
    <section className="home-heading">
      <div><p className="eyebrow">TWOJA PRZESTRZEŃ DO NAUKI</p><h1>Dobry dzień na mały krok, {name}.</h1><p>Zaplanuj mniej. Zrozum więcej. Zobacz, jak daleko już jesteś.</p></div>
      <button className="button button-secondary no-print" onClick={() => window.print()}><Printer size={17} /> Drukuj dzień</button>
    </section>
    <section className="home-overview" aria-label="Dzisiejsze wyniki">
      {[{ icon: Clock3, label: "Skupienie", value: `${minutes} min`, hint: `cel ${state.settings.dailyFocusGoalMinutes} min` },
        { icon: Brain, label: "Powtórki", value: String(reviewed), hint: `${due} kart czeka` },
        { icon: Check, label: "Ukończone dzisiaj", value: String(done), hint: "zadania z Twojej listy" },
        { icon: Flame, label: "Regularność", value: `${streak} dni`, hint: "seria aktywności" }].map(({ icon: Icon, label, value, hint }) =>
        <article className="overview-item" key={label}><span className="overview-icon"><Icon size={19} /></span><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article>)}
    </section>
    {firstSteps ? <section className="onboarding-panel no-print"><div><p className="eyebrow">ZACZNIJ OD SWOJEGO CELU</p><h2>Twój plan zaczyna się tutaj.</h2><p>Dodaj przedmiot, zapisz pierwsze zadanie lub zaimportuj fiszki. Pulpit dopasuje się do Twoich materiałów.</p></div><div className="button-group"><button className="button button-primary" onClick={() => onNavigate("learn")}><BookOpen size={17} /> Dodaj przedmiot</button><button className="button button-secondary" onClick={() => onNavigate("tasks")}>Pierwsze zadanie <ArrowRight size={17} /></button></div></section> : null}
    <div className="home-columns">
      <section className="study-next panel">
        <div className="panel-heading"><div><p className="eyebrow"><Sparkles size={14} /> TWÓJ NASTĘPNY KROK</p><h2>Ułóżmy dobrą sesję.</h2></div><span className="section-tag">{plan.reduce((sum, s) => sum + s.minutes, 0)} min nauki</span></div>
        <div className="plan-controls no-print"><label>Mam dzisiaj<select value={budget} onChange={(e) => setBudget(Number(e.target.value))}>{[15, 30, 45, 60, 90, 120].map((v) => <option key={v} value={v}>{v} minut</option>)}</select></label><fieldset><legend>Moja energia</legend><div className="energy-options">{[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" aria-label={`Energia ${v} z 5`} aria-pressed={energy === v} onClick={() => setEnergy(v)}>{v}</button>)}</div></fieldset></div>
        <div className="daily-roadmap">{plan.map((step, i) => <article key={step.id}><span className="roadmap-index">{String(i + 1).padStart(2, "0")}</span><div><span className="roadmap-meta">{step.kind === "review" ? "POWTÓRKA" : "SKUPIENIE"} · {step.minutes} MIN</span><h3>{step.title}</h3><p>{step.reason}</p></div><button className="icon-button play no-print" aria-label={`Rozpocznij: ${step.title}`} onClick={() => start(step)}><Play size={17} /></button></article>)}</div>
        {!plan.length ? <div className="home-empty"><Target size={28} /><h3>Miejsce na Twój następny cel</h3><p>Brak zadań gotowych do rozpoczęcia i fiszek do powtórki. Możesz dodać zadanie lub uczyć się ze stoperem.</p><button className="button button-secondary" onClick={() => onNavigate("focus")}>Otwórz skupienie <ArrowRight size={16} /></button></div> : <div className="session-advice"><Brain size={18} /><p>Po każdym bloku zamknij materiały i zapisz trzy rzeczy, które pamiętasz. Między blokami zaplanuj krótką przerwę.</p></div>}
      </section>
      <div className="home-side">
        <section className="panel weekly-rhythm"><div className="panel-heading"><div><p className="eyebrow">MAŁE KROKI, DUŻA ZMIANA</p><h2>Twój rytm nauki</h2></div><CalendarDays size={20} /></div><div className="week-chart" aria-label="Minuty nauki w ostatnich 7 dniach">{week.map((day) => <div key={day.key} className={day.key === today ? "is-today" : ""}><span>{day.minutes}</span><div className="week-track"><i style={{ height: `${day.minutes / maxMinutes * 100}%` }} /></div><small>{day.label}</small></div>)}</div><div className="daily-goal"><span>Dzisiejszy cel</span><strong>{percent}%</strong><progress max="100" value={percent} aria-label="Realizacja dziennego celu skupienia" /></div></section>
        <section className="panel today-schedule"><div className="panel-heading"><h2>W kalendarzu</h2><button className="text-button" onClick={() => onNavigate("planner")}>Planer <ArrowUpRight size={16} /></button></div>{calendar.length ? calendar.map((block) => <article className={block.done ? "is-done" : ""} key={block.id}><time>{new Date(block.start).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</time><strong>{block.title}</strong><button className="icon-button no-print" aria-label={`${block.done ? "Cofnij ukończenie" : "Ukończ"}: ${block.title}`} aria-pressed={block.done} onClick={() => onUpdate((s) => ({ ...s, calendar: s.calendar.map((b) => b.id === block.id ? { ...b, done: !b.done } : b) }))}><Check size={16} /></button></article>) : <p className="home-quiet">Dzisiaj nie masz zaplanowanych bloków. Zarezerwuj czas na jedną ważną rzecz.</p>}{exam ? <button className="next-exam" onClick={() => more("exams")}><Target size={19} /><span><small>NAJBLIŻSZY EGZAMIN · {new Date(`${exam.date}T12:00:00`).toLocaleDateString("pl-PL")}</small><strong>{exam.title}</strong></span><ArrowRight size={17} /></button> : null}</section>
      </div>
    </div>
    {state.habits.length ? <section className="panel home-habits"><div className="panel-heading"><h2>Małe codzienne zwycięstwa</h2><button className="text-button" onClick={() => more("habits")}>Nawyki <ArrowRight size={16} /></button></div><div>{state.habits.map((habit) => <button aria-pressed={habit.checks.includes(today)} key={habit.id} onClick={() => onUpdate((s) => ({ ...s, habits: s.habits.map((h) => h.id === habit.id ? { ...h, checks: h.checks.includes(today) ? h.checks.filter((d) => d !== today) : [...h.checks, today] } : h) }))}><Check size={17} />{habit.name}</button>)}</div></section> : null}
    {state.settings.showDashboardShortcuts ? <section className="home-links no-print"><div className="panel-heading"><div><p className="eyebrow">POD RĘKĄ</p><h2>Twoje szybkie przejścia</h2></div><button className="text-button" onClick={onEditShortcuts}>Dostosuj <ArrowUpRight size={16} /></button></div><div>{links.map((link) => { const href = link.kind === "url" ? normalizeWebUrl(link.url ?? "") : null; const content = <><span>{shortcutCaption(link)}</span><strong>{link.label}</strong><ArrowUpRight size={18} /></>; return href ? <a key={link.id} href={href} rel="noopener noreferrer" target={link.openInNewTab === false ? undefined : "_blank"}>{content}</a> : <button key={link.id} onClick={() => onNavigate(link.view ?? "home")}>{content}</button>; })}</div>{!links.length ? <p className="home-quiet">Dodaj linki do swoich materiałów, kursów i ulubionych narzędzi.</p> : null}</section> : null}
  </div>;
}
