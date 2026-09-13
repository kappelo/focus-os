"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Dices,
  GitFork,
  GraduationCap,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";
import {
  answersMatch,
  generateQuizFromText,
  quizFromFlashcards,
  recommendedReviewTopics,
} from "@/lib/study-tools";
import type {
  QuizAttempt,
  QuizQuestion,
  StudyNote,
  StudyQuiz,
  WorkspaceState,
} from "@/lib/types";

type ToolkitTab =
  | "generator"
  | "quizzes"
  | "mistakes"
  | "oral"
  | "notes"
  | "journal"
  | "teach";

type UpdateWorkspace = (
  recipe: (state: WorkspaceState) => WorkspaceState,
) => void;

const TOOL_TABS: {
  id: ToolkitTab;
  label: string;
  icon: typeof Sparkles;
}[] = [
  { id: "generator", label: "Generator", icon: Sparkles },
  { id: "quizzes", label: "Quizy i egzaminy", icon: ClipboardCheck },
  { id: "mistakes", label: "Baza błędów", icon: CircleAlert },
  { id: "oral", label: "Pytania ustne", icon: Dices },
  { id: "notes", label: "Cornell i mapy", icon: GitFork },
  { id: "journal", label: "Dziennik", icon: NotebookPen },
  { id: "teach", label: "Naucz mnie", icon: GraduationCap },
];

export function StudyToolkit({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: UpdateWorkspace;
}) {
  const [tab, setTab] = useState<ToolkitTab>("generator");
  const [runningQuiz, setRunningQuiz] = useState<StudyQuiz | null>(null);
  const [lastResult, setLastResult] = useState<number | null>(null);

  function completeQuiz(
    quiz: StudyQuiz,
    answers: QuizAttempt["answers"],
    startedAt: string,
  ) {
    const endedAt = new Date().toISOString();
    const correct = answers.filter((answer) => answer.correct).length;
    const score = Math.round((correct / Math.max(1, quiz.questions.length)) * 100);
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - new Date(startedAt).getTime()) / 1_000),
    );
    const attempt: QuizAttempt = {
      id: createId(),
      quizId: quiz.id,
      startedAt,
      endedAt,
      durationSeconds,
      score,
      answers,
      createdAt: endedAt,
    };
    onUpdate((current) => {
      const newMistakes = answers.flatMap((answer) => {
        if (answer.correct) return [];
        const question = quiz.questions.find(
          (item) => item.id === answer.questionId,
        );
        if (!question) return [];
        const existing = current.mistakes.find(
          (item) =>
            item.sourceId === question.id && item.status === "active",
        );
        if (existing) return [];
        return [{
          id: createId(),
          question: question.prompt,
          correctAnswer: question.answer,
          userAnswer: answer.answer || "Brak odpowiedzi",
          subjectId: quiz.subjectId,
          topic: question.topic ?? quiz.title,
          sourceId: question.id,
          count: 1,
          status: "active" as const,
          nextReviewAt: new Date(Date.now() + 86_400_000).toISOString(),
          createdAt: endedAt,
          updatedAt: endedAt,
        }];
      });
      const updatedExisting = current.mistakes.map((mistake) => {
        const wrong = answers.find((answer) => {
          const question = quiz.questions.find((item) => item.id === answer.questionId);
          return !answer.correct && question?.id === mistake.sourceId;
        });
        return wrong
          ? { ...mistake, count: mistake.count + 1, userAnswer: wrong.answer, updatedAt: endedAt }
          : mistake;
      });
      const xp = Math.max(5, Math.round(score / 5));
      return {
        ...current,
        quizAttempts: [...current.quizAttempts, attempt],
        mistakes: [...updatedExisting, ...newMistakes],
        progress: { ...current.progress, xp: current.progress.xp + xp },
        activityLog: [
          ...current.activityLog,
          {
            id: createId(),
            type: "quiz" as const,
            description: `${quiz.kind === "mock-exam" ? "Próbny egzamin" : "Quiz"}: ${quiz.title} · ${score}%`,
            xp,
            entityId: quiz.id,
            createdAt: endedAt,
          },
        ].slice(-1000),
      };
    });
    setLastResult(score);
    setRunningQuiz(null);
    setTab("quizzes");
  }

  if (runningQuiz) {
    return (
      <QuizRunner
        quiz={runningQuiz}
        onExit={() => setRunningQuiz(null)}
        onComplete={completeQuiz}
      />
    );
  }

  return (
    <div className="toolkit-layout">
      <nav className="toolkit-nav" aria-label="Narzędzia nauki">
        {TOOL_TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <Icon size={18} />
              {item.label}
              {item.id === "mistakes" && state.mistakes.some((entry) => entry.status === "active") ? (
                <span>{state.mistakes.filter((entry) => entry.status === "active").length}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="toolkit-content">
        {tab === "generator" ? (
          <QuizGenerator state={state} onUpdate={onUpdate} onRun={setRunningQuiz} />
        ) : null}
        {tab === "quizzes" ? (
          <QuizLibrary
            state={state}
            onUpdate={onUpdate}
            onRun={setRunningQuiz}
            lastResult={lastResult}
          />
        ) : null}
        {tab === "mistakes" ? <MistakeDatabase state={state} onUpdate={onUpdate} /> : null}
        {tab === "oral" ? <OralQuestions state={state} onUpdate={onUpdate} /> : null}
        {tab === "notes" ? <NotesStudio state={state} onUpdate={onUpdate} /> : null}
        {tab === "journal" ? <StudyJournal state={state} onUpdate={onUpdate} /> : null}
        {tab === "teach" ? <TeachMe state={state} onUpdate={onUpdate} /> : null}
      </div>
    </div>
  );
}

function QuizGenerator({
  state,
  onUpdate,
  onRun,
}: {
  state: WorkspaceState;
  onUpdate: UpdateWorkspace;
  onRun: (quiz: StudyQuiz) => void;
}) {
  const [source, setSource] = useState(state.materials[0]?.id ?? "flashcards");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<StudyQuiz["kind"]>("practice");
  const [count, setCount] = useState(10);
  const [subjectId, setSubjectId] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [message, setMessage] = useState("");

  function generate(runNow = false) {
    let quiz: StudyQuiz;
    if (source === "flashcards") {
      const cards = state.flashcards.filter(
        (card) => !subjectId || card.subjectId === subjectId,
      );
      if (!cards.length) {
        setMessage("Dodaj fiszki albo wybierz materiał tekstowy.");
        return;
      }
      quiz = quizFromFlashcards(
        cards,
        title.trim() || "Quiz z inteligentnych fiszek",
        kind,
        count,
      );
    } else {
      const material = state.materials.find((item) => item.id === source);
      if (!material || !material.content.trim() || material.dataUrl) {
        setMessage("Generator potrzebuje materiału tekstowego lub Markdown.");
        return;
      }
      quiz = generateQuizFromText({
        title: title.trim() || material.title,
        text: material.content,
        count,
        kind,
        subjectId: subjectId || undefined,
        sourceMaterialId: material.id,
        timeLimitMinutes: timeLimit,
      });
    }
    if (!quiz.questions.length) {
      setMessage("Materiał jest zbyt krótki, aby utworzyć pytania.");
      return;
    }
    onUpdate((current) => ({
      ...current,
      quizzes: [quiz, ...current.quizzes],
    }));
    setMessage(`Utworzono ${quiz.questions.length} pytań lokalnie.`);
    if (runNow) onRun(quiz);
  }

  return (
    <div className="tool-grid two-columns">
      <section className="panel feature-hero">
        <span className="feature-icon"><Sparkles size={25} /></span>
        <div className="feature-copy">
          <p className="eyebrow">LOKALNY GENERATOR</p>
          <h2>Quiz z Twoich notatek</h2>
          <p>
            Focus OS wykrywa definicje i najważniejsze zdania bez wysyłania treści
            do zewnętrznej chmury. Wynik możesz edytować i uruchomić jako egzamin.
          </p>
          <div className="privacy-pill">Działa offline · dane zostają u Ciebie</div>
        </div>
      </section>
      <section className="panel form-panel">
        <div className="form-grid">
          <label>
            Źródło
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="flashcards">Inteligentne fiszki</option>
              {state.materials.filter((item) => !item.dataUrl).map((material) => (
                <option value={material.id} key={material.id}>{material.title}</option>
              ))}
            </select>
          </label>
          <label>
            Przedmiot
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">Wszystkie / ogólne</option>
              {state.subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
            </select>
          </label>
          <label>
            Nazwa
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Genetyka — próbny test" />
          </label>
          <label>
            Tryb
            <select value={kind} onChange={(event) => setKind(event.target.value as StudyQuiz["kind"])}>
              <option value="practice">Quiz ćwiczeniowy</option>
              <option value="mock-exam">Próbny egzamin</option>
              <option value="oral">Pytania ustne</option>
            </select>
          </label>
          <label>
            Liczba pytań
            <input type="number" min="1" max="100" value={count} onChange={(event) => setCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} />
          </label>
          {kind === "mock-exam" ? (
            <label>
              Limit minut
              <input type="number" min="1" max="240" value={timeLimit} onChange={(event) => setTimeLimit(Math.min(240, Math.max(1, Number(event.target.value) || 1)))} />
            </label>
          ) : null}
        </div>
        <div className="form-actions">
          <button className="button button-quiet" onClick={() => generate(false)}><Plus size={17} /> Zapisz quiz</button>
          <button className="button button-primary" onClick={() => generate(true)}><Play size={17} /> Utwórz i rozpocznij</button>
        </div>
        {message ? <p className="inline-notice" role="status">{message}</p> : null}
      </section>
    </div>
  );
}

function QuizLibrary({
  state,
  onUpdate,
  onRun,
  lastResult,
}: {
  state: WorkspaceState;
  onUpdate: UpdateWorkspace;
  onRun: (quiz: StudyQuiz) => void;
  lastResult: number | null;
}) {
  const averageScore = state.quizAttempts.length
    ? Math.round(state.quizAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / state.quizAttempts.length)
    : 0;
  return (
    <div className="page-stack compact-stack">
      <div className="metric-grid">
        <article className="metric-card"><span>Quizów</span><strong>{state.quizzes.length}</strong><small>w bibliotece</small></article>
        <article className="metric-card"><span>Podejść</span><strong>{state.quizAttempts.length}</strong><small>zapisanych</small></article>
        <article className="metric-card"><span>Średni wynik</span><strong>{averageScore}%</strong><small>ze wszystkich prób</small></article>
        <article className="metric-card"><span>Ostatni wynik</span><strong>{lastResult ?? "—"}{lastResult === null ? "" : "%"}</strong><small>bieżąca sesja</small></article>
      </div>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">BIBLIOTEKA</p><h2>Quizy i próbne egzaminy</h2></div></div>
        {state.quizzes.length ? (
          <div className="quiz-library">
            {state.quizzes.map((quiz) => {
              const attempts = state.quizAttempts.filter((item) => item.quizId === quiz.id);
              const best = attempts.length ? Math.max(...attempts.map((item) => item.score)) : null;
              return (
                <article key={quiz.id}>
                  <span className={`quiz-kind ${quiz.kind}`}><BookOpenCheck size={18} /></span>
                  <div><strong>{quiz.title}</strong><small>{quiz.questions.length} pytań · {quiz.kind === "mock-exam" ? `${quiz.timeLimitMinutes} min` : quiz.kind === "oral" ? "ustny" : "ćwiczenie"} · rekord {best === null ? "—" : `${best}%`}</small></div>
                  <button className="button button-secondary" onClick={() => onRun(quiz)}><Play size={15} /> Start</button>
                  <button className="icon-button danger" aria-label={`Usuń ${quiz.title}`} onClick={() => {
                    if (state.settings.confirmBeforeDelete && !window.confirm(`Przenieść „${quiz.title}” do kosza?`)) return;
                    const deletedAt = new Date().toISOString();
                    onUpdate((current) => ({
                      ...current,
                      quizzes: current.quizzes.filter((item) => item.id !== quiz.id),
                      trash: [...current.trash, { id: createId(), collection: "quizzes", label: quiz.title, snapshot: quiz, deletedAt, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), createdAt: deletedAt }],
                    }));
                  }}><Trash2 size={16} /></button>
                </article>
              );
            })}
          </div>
        ) : <EmptyState icon={ClipboardCheck} title="Nie ma jeszcze quizów" text="Wygeneruj pierwszy quiz z materiału lub fiszek." />}
      </section>
    </div>
  );
}

function QuizRunner({
  quiz,
  onExit,
  onComplete,
}: {
  quiz: StudyQuiz;
  onExit: () => void;
  onComplete: (quiz: StudyQuiz, answers: QuizAttempt["answers"], startedAt: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [answers, setAnswers] = useState<QuizAttempt["answers"]>([]);
  const [remaining, setRemaining] = useState(quiz.timeLimitMinutes * 60);
  const [startedAt] = useState(() => new Date().toISOString());
  const completed = useRef(false);
  const question = quiz.questions[index];

  const finish = useCallback((finalAnswers: QuizAttempt["answers"]) => {
    if (completed.current) return;
    completed.current = true;
    onComplete(quiz, finalAnswers, startedAt);
  }, [onComplete, quiz, startedAt]);

  useEffect(() => {
    if (quiz.kind !== "mock-exam") return;
    const interval = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(interval);
  }, [quiz.kind]);

  useEffect(() => {
    if (quiz.kind === "mock-exam" && remaining === 0) finish(answers);
  }, [answers, finish, quiz.kind, remaining]);

  if (!question) return null;
  function submit() {
    const entry = {
      questionId: question.id,
      answer,
      correct: answersMatch(answer, question.answer),
      confidence,
    };
    const next = [...answers, entry];
    if (index >= quiz.questions.length - 1) finish(next);
    else {
      setAnswers(next);
      setIndex((value) => value + 1);
      setAnswer("");
      setConfidence(3);
    }
  }
  return (
    <section className="exam-runner panel">
      <header>
        <button className="text-button" onClick={onExit}>Zakończ bez zapisu</button>
        <div><span style={{ width: `${((index + 1) / quiz.questions.length) * 100}%` }} /></div>
        <strong>{index + 1}/{quiz.questions.length}</strong>
        {quiz.kind === "mock-exam" ? <time className={remaining < 60 ? "urgent" : ""}><Timer size={16} /> {formatSeconds(remaining)}</time> : null}
      </header>
      <div className="exam-question">
        <p className="eyebrow">{quiz.title}</p>
        <h2>{question.prompt}</h2>
        {question.options?.length ? (
          <div className="exam-options">
            {question.options.map((option, optionIndex) => (
              <button key={`${option}-${optionIndex}`} className={answer === option ? "active" : ""} onClick={() => setAnswer(option)}>{String.fromCharCode(65 + optionIndex)}. {option}</button>
            ))}
          </div>
        ) : (
          <label>Twoja odpowiedź<textarea autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Zapisz odpowiedź własnymi słowami…" /></label>
        )}
        <div className="confidence-row"><span>Pewność:</span>{[1, 2, 3, 4, 5].map((value) => <button className={confidence === value ? "active" : ""} key={value} onClick={() => setConfidence(value as 1 | 2 | 3 | 4 | 5)}>{value}</button>)}</div>
        <button className="button button-primary button-large" onClick={submit} disabled={!answer.trim()}> {index === quiz.questions.length - 1 ? "Zakończ i oceń" : "Następne pytanie"}<ChevronRight size={17} /></button>
      </div>
    </section>
  );
}

function MistakeDatabase({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const topics = recommendedReviewTopics({ subjects: state.subjects, mistakes: state.mistakes, cards: state.flashcards });
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const visible = state.mistakes.filter((item) => filter === "all" || item.status === filter);
  return (
    <div className="tool-grid two-columns mistake-layout">
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">NASTĘPNE POWTÓRKI</p><h2>Zagadnienia wymagające uwagi</h2></div></div>
        {topics.length ? <div className="priority-topic-list">{topics.map((topic, index) => <article key={`${topic.label}-${index}`}><span>{index + 1}</span><div><strong>{topic.label}</strong><small>{topic.reason}</small></div><b>{Math.round(topic.score)}</b></article>)}</div> : <p className="empty-copy">Brak słabych zagadnień — świetnie!</p>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">HISTORIA BŁĘDÓW</p><h2>Baza błędów</h2></div><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="active">Do poprawy</option><option value="resolved">Opanowane</option><option value="all">Wszystkie</option></select></div>
        {visible.length ? <div className="mistake-list">{visible.map((mistake) => <article key={mistake.id}><div><strong>{mistake.question}</strong><small>{mistake.topic} · pomyłki: {mistake.count} · powtórka {new Date(mistake.nextReviewAt).toLocaleDateString("pl-PL")}</small><details><summary>Zobacz odpowiedzi</summary><p><b>Twoja:</b> {mistake.userAnswer}</p><p><b>Poprawna:</b> {mistake.correctAnswer}</p></details></div><button className="button button-quiet" onClick={() => onUpdate((current) => ({ ...current, mistakes: current.mistakes.map((item) => item.id === mistake.id ? { ...item, status: item.status === "active" ? "resolved" : "active", updatedAt: new Date().toISOString() } : item) }))}>{mistake.status === "active" ? <><Check size={15} /> Opanowane</> : <><RotateCcw size={15} /> Przywróć</>}</button></article>)}</div> : <EmptyState icon={CircleAlert} title="Brak zapisanych błędów" text="Błędne odpowiedzi z quizów i fiszek pojawią się tutaj automatycznie." />}
      </section>
    </div>
  );
}

function OralQuestions({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const pool = useMemo<QuizQuestion[]>(() => [
    ...state.flashcards.map((card) => ({ id: card.id, prompt: card.front, answer: card.back, topic: card.deck })),
    ...state.quizzes.flatMap((quiz) => quiz.questions),
  ], [state.flashcards, state.quizzes]);
  const [seed, setSeed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const question = pool.length ? pool[Math.abs(seed) % pool.length] : undefined;
  function next() {
    if (question) {
      const now = new Date().toISOString();
      onUpdate((current) => ({ ...current, progress: { ...current.progress, xp: current.progress.xp + confidence }, activityLog: [...current.activityLog, { id: createId(), type: "quiz" as const, description: `Pytanie ustne: ${question.prompt.slice(0, 70)}`, xp: confidence, entityId: question.id, createdAt: now }].slice(-1000) }));
    }
    setSeed((value) => value + 1 + Math.floor(Math.random() * 11));
    setRevealed(false);
    setConfidence(3);
  }
  return (
    <section className="panel oral-card">
      <span className="feature-icon"><Dices size={26} /></span><p className="eyebrow">ODPOWIEDŹ NA GŁOS</p>
      {question ? <><small>{question.topic ?? "Losowe pytanie"}</small><h2>{question.prompt}</h2><div className="confidence-row"><span>Oceń pewność przed sprawdzeniem:</span>{[1,2,3,4,5].map((value) => <button className={confidence === value ? "active" : ""} key={value} onClick={() => setConfidence(value as 1|2|3|4|5)}>{value}</button>)}</div>{revealed ? <div className="oral-answer"><span>Wzorcowa odpowiedź</span><strong>{question.answer}</strong></div> : <button className="button button-secondary" onClick={() => setRevealed(true)}>Pokaż odpowiedź</button>}<button className="button button-primary" onClick={next}>Losuj następne <Dices size={16} /></button></> : <EmptyState icon={Dices} title="Brak pytań" text="Dodaj fiszki albo wygeneruj quiz." />}
    </section>
  );
}

function NotesStudio({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [open, setOpen] = useState<StudyNote["type"] | null>(null);
  return (
    <div className="page-stack compact-stack">
      <div className="tool-grid two-columns">
        <button className="panel creation-card" onClick={() => setOpen("cornell")}><NotebookPen size={26} /><div><strong>Nowa notatka Cornell</strong><small>Wskazówki, właściwe notatki i podsumowanie.</small></div><Plus size={18} /></button>
        <button className="panel creation-card" onClick={() => setOpen("mindmap")}><GitFork size={26} /><div><strong>Nowa mapa myśli</strong><small>Hierarchia pojęć zapisywana jako gałęzie.</small></div><Plus size={18} /></button>
      </div>
      <section className="notes-library">
        {state.studyNotes.length ? state.studyNotes.map((note) => <article className="panel note-card" key={note.id}><span>{note.type === "cornell" ? <NotebookPen size={20} /> : <GitFork size={20} />}</span><div><small>{note.type === "cornell" ? "CORNELL" : "MAPA MYŚLI"}</small><h3>{note.title}</h3>{note.type === "cornell" ? <><p>{note.summary || note.notes.slice(0, 180)}</p><details><summary>Otwórz notatkę</summary><div className="cornell-preview"><aside><b>Wskazówki</b>{note.cues}</aside><main><b>Notatki</b>{note.notes}</main><footer><b>Podsumowanie</b>{note.summary}</footer></div></details></> : <MindMapPreview note={note} />}</div><button className="icon-button danger" aria-label="Usuń notatkę" onClick={() => onUpdate((current) => ({ ...current, studyNotes: current.studyNotes.filter((item) => item.id !== note.id) }))}><Trash2 size={16} /></button></article>) : <EmptyState icon={NotebookPen} title="Brak notatek strukturalnych" text="Utwórz notatkę Cornell lub prostą mapę myśli." />}
      </section>
      {open ? <NoteForm type={open} subjects={state.subjects} onClose={() => setOpen(null)} onSave={(note) => { onUpdate((current) => ({ ...current, studyNotes: [note, ...current.studyNotes] })); setOpen(null); }} /> : null}
    </div>
  );
}

function NoteForm({ type, subjects, onClose, onSave }: { type: StudyNote["type"]; subjects: WorkspaceState["subjects"]; onClose: () => void; onSave: (note: StudyNote) => void }) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [cues, setCues] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    const nodes = type === "mindmap" ? parseMindMap(notes) : [];
    onSave({ id: createId(), type, title: title.trim(), subjectId: subjectId || undefined, cues: type === "cornell" ? cues.trim() : "", notes: notes.trim(), summary: summary.trim(), nodes, createdAt: now, updatedAt: now });
  }
  return <Modal title={type === "cornell" ? "Nowa notatka Cornell" : "Nowa mapa myśli"} onClose={onClose} wide><form className="form-stack" onSubmit={submit}><div className="form-grid"><label>Tytuł<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Przedmiot<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Ogólne</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label></div>{type === "cornell" ? <label>Pytania i słowa kluczowe<textarea value={cues} onChange={(event) => setCues(event.target.value)} placeholder="Jak? Dlaczego? Najważniejsze pojęcia…" /></label> : null}<label>{type === "cornell" ? "Notatki" : "Gałęzie mapy — każda linia: Rodzic > Dziecko"}<textarea required className="large-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={type === "cornell" ? "Główna treść notatki…" : "Fotosynteza\nFotosynteza > Faza jasna\nFotosynteza > Cykl Calvina"} /></label><label>{type === "cornell" ? "Podsumowanie własnymi słowami" : "Opis mapy"}<textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label><div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Anuluj</button><button className="button button-primary">Zapisz</button></div></form></Modal>;
}

function MindMapPreview({ note }: { note: StudyNote }) {
  const roots = note.nodes.filter((node) => !node.parentId);
  return <div className="mindmap-preview">{roots.slice(0, 5).map((root) => <div key={root.id}><strong>{root.label}</strong><span>{note.nodes.filter((node) => node.parentId === root.id).map((node) => <small key={node.id}>{node.label}</small>)}</span></div>)}</div>;
}

function StudyJournal({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const today = localDateKey();
  const existing = state.journalEntries.find((entry) => entry.date === today);
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [win, setWin] = useState(existing?.win ?? "");
  const [challenge, setChallenge] = useState(existing?.challenge ?? "");
  const [nextStep, setNextStep] = useState(existing?.nextStep ?? "");
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(existing?.mood ?? 3);
  const [saved, setSaved] = useState(false);
  function save(event: FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    const entry = { id: existing?.id ?? createId(), date: today, summary: summary.trim(), win: win.trim(), challenge: challenge.trim(), nextStep: nextStep.trim(), mood, createdAt: existing?.createdAt ?? now, updatedAt: now };
    onUpdate((current) => ({ ...current, journalEntries: current.journalEntries.some((item) => item.date === today) ? current.journalEntries.map((item) => item.date === today ? entry : item) : [entry, ...current.journalEntries] }));
    setSaved(true);
  }
  return <div className="tool-grid two-columns"><form className="panel journal-form" onSubmit={save}><p className="eyebrow">{new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</p><h2>Podsumuj dzień nauki</h2><label>Czego się dziś nauczyłem/am?<textarea required value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Największy sukces<input value={win} onChange={(event) => setWin(event.target.value)} /></label><label>Co było trudne?<input value={challenge} onChange={(event) => setChallenge(event.target.value)} /></label><label>Pierwszy krok na jutro<input value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label><div className="confidence-row"><span>Energia dnia:</span>{[1,2,3,4,5].map((value) => <button type="button" className={mood === value ? "active" : ""} key={value} onClick={() => setMood(value as 1|2|3|4|5)}>{value}</button>)}</div><button className="button button-primary">{saved ? <Check size={16} /> : null}{saved ? "Zapisano" : "Zapisz wpis"}</button></form><section className="panel journal-history"><div className="panel-heading"><div><p className="eyebrow">HISTORIA</p><h2>Ostatnie wpisy</h2></div></div>{state.journalEntries.slice(0, 10).map((entry) => <article key={entry.id}><time>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("pl-PL")}</time><strong>{entry.summary}</strong><small>Sukces: {entry.win || "—"} · energia {entry.mood}/5</small></article>)}</section></div>;
}

function TeachMe({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const options = [
    ...state.materials.filter((item) => !item.dataUrl).map((item) => ({ id: `material:${item.id}`, label: item.title, content: item.content, subjectId: undefined as string | undefined })),
    ...state.subjects.flatMap((subject) => subject.topics.map((topic) => ({ id: `topic:${topic.id}`, label: `${subject.name}: ${topic.name}`, content: topic.name, subjectId: subject.id }))),
  ];
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [step, setStep] = useState(0);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflection, setReflection] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const source = options.find((item) => item.id === selected);
  const snippets = source?.content.split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim()).filter(Boolean).slice(0, 3) ?? [];
  const steps = source ? [
    { title: "Zbuduj obraz całości", text: snippets[0] ?? `Zacznij od określenia, czym jest ${source.label}.`, prompt: "Po przeczytaniu zamknij tekst i powiedz główną ideę jednym zdaniem." },
    { title: "Połącz z przykładem", text: snippets[1] ?? "Znajdź konkretny przykład z życia, zadania lub lekcji.", prompt: "Zapisz własny przykład — im bardziej konkretny, tym lepiej." },
    { title: "Znajdź lukę", text: snippets[2] ?? "Wytłumacz temat tak, jak osobie młodszej o kilka lat.", prompt: "W którym miejscu wyjaśnienie staje się niejasne? To jest luka do powtórki." },
    { title: "Sprawdź bez podpowiedzi", text: `Odpowiedz: co jest najważniejsze w temacie „${source.label}” i dlaczego?`, prompt: "Oceń pewność, zapisz refleksję i zakończ lekcję." },
  ] : [];
  function finish() {
    if (!source) return;
    const now = new Date().toISOString();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    onUpdate((current) => ({ ...current, studyRuns: [...current.studyRuns, { id: createId(), method: "feynman", subjectId: source.subjectId, startedAt: new Date(startedAt).toISOString(), endedAt: now, durationMinutes, notes: reflection.trim(), score: confidence * 20 }], progress: { ...current.progress, xp: current.progress.xp + 10 + confidence }, activityLog: [...current.activityLog, { id: createId(), type: "quiz" as const, description: `Lekcja prowadzona: ${source.label}`, xp: 10 + confidence, createdAt: now }].slice(-1000) }));
    setStep(0); setReflection(""); setStartedAt(Date.now());
  }
  return <div className="teach-layout"><aside className="panel"><span className="feature-icon"><BrainCircuit size={25} /></span><p className="eyebrow">PROWADZONA LEKCJA</p><h2>Naucz mnie krok po kroku</h2><p>Technika łączy uproszczenie Feynmana, active recall i samoocenę pewności.</p><label>Temat<select value={selected} onChange={(event) => { setSelected(event.target.value); setStep(0); setStartedAt(Date.now()); }}><option value="">Wybierz materiał lub temat</option>{options.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><ol>{steps.map((item, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={item.title}><span>{index < step ? <Check size={13} /> : index + 1}</span>{item.title}</li>)}</ol></aside><section className="panel teach-step">{source && steps[step] ? <><p className="eyebrow">KROK {step + 1} Z {steps.length}</p><h2>{steps[step].title}</h2><div className="teach-source">{steps[step].text}</div><strong>{steps[step].prompt}</strong><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Zapisz odpowiedź lub refleksję…" /><div className="confidence-row"><span>Rozumiem na:</span>{[1,2,3,4,5].map((value) => <button className={confidence === value ? "active" : ""} key={value} onClick={() => setConfidence(value as 1|2|3|4|5)}>{value}</button>)}</div><button className="button button-primary button-large" onClick={() => step === steps.length - 1 ? finish() : setStep((value) => value + 1)}>{step === steps.length - 1 ? "Zakończ i zapisz" : "Przejdź dalej"}<ChevronRight size={17} /></button></> : <EmptyState icon={GraduationCap} title="Wybierz temat" text="Dodaj materiał tekstowy albo temat w przedmiocie, aby rozpocząć prowadzoną lekcję." />}</section></div>;
}

function parseMindMap(value: string) {
  const nodes: StudyNote["nodes"] = [];
  const byLabel = new Map<string, string>();
  for (const line of value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const parts = line.split(">").map((item) => item.trim()).filter(Boolean);
    let parentId: string | undefined;
    for (const label of parts) {
      const key = `${parentId ?? "root"}:${label.toLocaleLowerCase("pl")}`;
      let id = byLabel.get(key);
      if (!id) {
        id = createId();
        byLabel.set(key, id);
        nodes.push({ id, label, parentId });
      }
      parentId = id;
    }
  }
  return nodes;
}

function formatSeconds(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
