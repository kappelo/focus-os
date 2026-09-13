"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Check,
  Clock3,
  Columns3,
  Layers3,
  Lightbulb,
  Play,
  RefreshCcw,
  Shuffle,
  SquarePen,
} from "lucide-react";
import { SubjectPicker } from "@/components/subject-picker";
import { createId } from "@/lib/ids";
import type {
  StudyMethod,
  StudyRun,
  Subject,
  WorkspaceState,
} from "@/lib/types";

type MethodDefinition = {
  id: StudyMethod;
  title: string;
  subtitle: string;
  description: string;
  minutes: number;
  icon: typeof Lightbulb;
  whenToUse: string;
  bestSubjects: string[];
  steps: string[];
  avoidWhen: string;
  goals: StudyGoal[];
};

type StudyGoal =
  | "understand"
  | "remember"
  | "notes"
  | "problems"
  | "exam";

const STUDY_GOALS: { id: StudyGoal; label: string }[] = [
  { id: "understand", label: "Zrozumieć trudny temat" },
  { id: "remember", label: "Zapamiętać fakty i pojęcia" },
  { id: "notes", label: "Uporządkować notatki" },
  { id: "problems", label: "Ćwiczyć zadania i schematy" },
  { id: "exam", label: "Przygotować się do sprawdzianu" },
];

const METHODS: MethodDefinition[] = [
  {
    id: "feynman",
    title: "Technika Feynmana",
    subtitle: "Wyjaśnij prosto",
    description:
      "Napisz wyjaśnienie tak, jakby odbiorca miał 12 lat. System oceni klarowność i luki.",
    minutes: 15,
    icon: Lightbulb,
    whenToUse: "Po pierwszym przeczytaniu tematu, gdy chcesz sprawdzić, czy naprawdę rozumiesz zależności, a nie tylko rozpoznajesz słowa.",
    bestSubjects: ["matematyka", "fizyka", "chemia", "biologia", "informatyka", "WOS"],
    steps: ["Wybierz jedno pojęcie lub mechanizm.", "Wyjaśnij je prostymi słowami bez notatek.", "Zaznacz miejsca, których nie umiesz wyjaśnić.", "Uzupełnij luki w źródle i napisz krótszą wersję z przykładem."],
    avoidWhen: "Nie jest najlepsza do zapamiętywania dat, słówek i definicji jeden do jednego.",
    goals: ["understand", "problems"],
  },
  {
    id: "blurting",
    title: "Blurting",
    subtitle: "Wyrzut z pamięci",
    description:
      "Bez zaglądania do źródeł wypisz wszystko, co pamiętasz, a potem zaznacz braki.",
    minutes: 10,
    icon: BrainCircuit,
    whenToUse: "Na początku powtórki lub dzień po lekcji, żeby szybko odkryć, co zostało w pamięci bez podpowiedzi.",
    bestSubjects: ["historia", "biologia", "geografia", "WOS", "język polski", "chemia"],
    steps: ["Odłóż podręcznik i notatki.", "Wypisz wszystko, co pamiętasz o temacie.", "Porównaj zapis ze źródłem innym kolorem.", "Z braków utwórz pytania albo fiszki."],
    avoidWhen: "Nie zaczynaj od niej zupełnie nowego materiału — najpierw potrzebujesz pierwszego kontaktu z tematem.",
    goals: ["remember", "exam"],
  },
  {
    id: "cornell",
    title: "Cornell Sprint",
    subtitle: "Notatka w trzech polach",
    description: "Zapisuj tropy, główne notatki i jednozdaniowe podsumowanie.",
    minutes: 20,
    icon: Columns3,
    whenToUse: "Podczas lekcji, filmu edukacyjnego lub czytania rozdziału, gdy materiał trzeba uporządkować do późniejszej powtórki.",
    bestSubjects: ["historia", "język polski", "biologia", "geografia", "WOS", "języki obce"],
    steps: ["Po prawej zapisuj najważniejsze informacje i przykłady.", "Po lewej dopisz pytania, hasła i słowa kluczowe.", "Na dole streść całość w 1–3 zdaniach.", "Zakryj notatki i odpowiadaj tylko na pytania z lewej kolumny."],
    avoidWhen: "Do seryjnego rozwiązywania zadań rachunkowych lepsze będzie przeplatanie lub sprint egzaminacyjny.",
    goals: ["notes", "understand"],
  },
  {
    id: "interleaving",
    title: "Interleaving",
    subtitle: "Przeplatanie tematów",
    description:
      "Mieszaj karty i problemy z kilku przedmiotów, by ćwiczyć rozpoznawanie metody.",
    minutes: 18,
    icon: Shuffle,
    whenToUse: "Po opanowaniu podstaw kilku podobnych typów zadań, kiedy musisz nauczyć się rozpoznawać właściwą metodę.",
    bestSubjects: ["matematyka", "fizyka", "chemia", "gramatyka", "informatyka", "języki obce"],
    steps: ["Wybierz 2–4 powiązane typy zadań lub tematów.", "Pomieszaj je zamiast robić całe serie jednego rodzaju.", "Przed rozwiązaniem nazwij metodę, której użyjesz.", "Po sesji zapisz, które typy nadal ze sobą mylisz."],
    avoidWhen: "Nie przeplataj zbyt wcześnie — najpierw przećwicz podstawowy schemat każdego typu osobno.",
    goals: ["problems", "exam"],
  },
  {
    id: "exam-sprint",
    title: "Exam Sprint",
    subtitle: "Praca pod presją czasu",
    description:
      "Krótka symulacja egzaminu z jednym celem i natychmiastową retrospekcją.",
    minutes: 25,
    icon: Clock3,
    whenToUse: "W ostatniej fazie przygotowań, gdy znasz materiał i chcesz trenować tempo, kolejność zadań oraz odporność na presję.",
    bestSubjects: ["matematyka", "język polski", "języki obce", "fizyka", "matura", "egzaminy zawodowe"],
    steps: ["Ustal mały zestaw zadań i limit czasu.", "Pracuj bez notatek w warunkach podobnych do egzaminu.", "Po czasie zatrzymaj pracę i sprawdź wynik.", "Zapisz jeden błąd wiedzy i jeden błąd strategii."],
    avoidWhen: "Nie używaj jako jedynej nauki — symulacja diagnozuje braki, ale sama ich nie wyjaśnia.",
    goals: ["exam", "problems"],
  },
  {
    id: "leitner",
    title: "System Leitnera",
    subtitle: "Pudełka opanowania",
    description:
      "Zobacz, które fiszki utknęły w pierwszych pudełkach i wymagają częstszych powtórek.",
    minutes: 12,
    icon: Layers3,
    whenToUse: "Do długoterminowego zapamiętywania krótkich informacji, które można jednoznacznie sprawdzić pytaniem i odpowiedzią.",
    bestSubjects: ["języki obce", "biologia", "historia", "geografia", "chemia", "terminologia zawodowa"],
    steps: ["Umieść nowe i trudne fiszki w pierwszym pudełku.", "Poprawna odpowiedź przesuwa kartę wyżej.", "Błędna odpowiedź cofa ją do częstszych powtórek.", "Powtarzaj trudne pudełka częściej, opanowane rzadziej."],
    avoidWhen: "Nie dziel złożonych wyjaśnień na setki wyrwanych z kontekstu kart; najpierw zrozum temat.",
    goals: ["remember", "exam"],
  },
];

export function StudyMethods({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const methods = METHODS.filter((item) =>
    state.settings.enabledStudyMethods.includes(item.id),
  ).map((item) => ({
    ...item,
    minutes: state.settings.studyMethodMinutes[item.id] ?? item.minutes,
  }));
  const [selected, setSelected] = useState<StudyMethod>(
    methods[0]?.id ?? "feynman",
  );
  const [goal, setGoal] = useState<StudyGoal>("understand");
  const recommended = methods.filter((item) => item.goals.includes(goal));
  const method =
    methods.find((item) => item.id === selected) ?? methods[0] ?? METHODS[0];
  return (
    <>
      {state.settings.showStudyMethodGuides ? (
        <section className="panel method-advisor">
          <div>
            <p className="eyebrow">DOBIERZ METODĘ DO CELU</p>
            <h2>Co chcesz teraz osiągnąć?</h2>
            <p>
              Wybierz cel, a Focus OS wskaże metody najlepiej pasujące do tej
              sesji.
            </p>
          </div>
          <label>
            Cel nauki
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value as StudyGoal)}
            >
              {STUDY_GOALS.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="method-recommendations">
            {recommended.map((item) => (
              <button key={item.id} onClick={() => setSelected(item.id)}>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="methods-layout">
        <section className="method-grid">
          {methods.map((item) => {
            const Icon = item.icon;
            const count = state.studyRuns.filter(
              (run) => run.method === item.id,
            ).length;
            return (
              <button
                className={`method-card panel ${selected === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setSelected(item.id)}
              >
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <small>{item.subtitle}</small>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                <em>{count ? `${count} sesji` : `${item.minutes} min`}</em>
              </button>
            );
          })}
        </section>
        <MethodLab
          key={selected}
          method={method}
          state={state}
          onUpdate={onUpdate}
        />
      </div>
    </>
  );
}

function MethodLab({
  method,
  state,
  onUpdate,
}: {
  method: MethodDefinition;
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const MethodIcon = method.icon;
  const [subjectId, setSubjectId] = useState(
    state.subjects.some(
      (subject) => subject.id === state.settings.defaultSubjectId,
    )
      ? state.settings.defaultSubjectId
      : (state.subjects[0]?.id ?? ""),
  );
  const subject = state.subjects.find((item) => item.id === subjectId);
  const [topic, setTopic] = useState(subject?.topics[0]?.name ?? "");
  const [notes, setNotes] = useState("");
  const [cues, setCues] = useState("");
  const [summary, setSummary] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [result, setResult] = useState<number | null>(null);
  const durationSeconds = method.minutes * 60;
  const remaining = startedAt
    ? Math.max(0, durationSeconds - Math.floor((clock - startedAt) / 1000))
    : durationSeconds;
  const leitner = useMemo(
    () =>
      [0, 1, 2, 3, 4].map(
        (box) =>
          state.flashcards.filter(
            (card) => Math.min(4, card.repetitions) === box,
          ).length,
      ),
    [state.flashcards],
  );
  const interleaved = useMemo(() => {
    const buckets = new Map<string, typeof state.flashcards>();
    state.flashcards.forEach((card) =>
      buckets.set(card.subjectId ?? "general", [
        ...(buckets.get(card.subjectId ?? "general") ?? []),
        card,
      ]),
    );
    const resultCards: typeof state.flashcards = [];
    const values = [...buckets.values()];
    while (resultCards.length < 8 && values.some((bucket) => bucket.length))
      values.forEach((bucket) => {
        const card = bucket.shift();
        if (card && resultCards.length < 8) resultCards.push(card);
      });
    return resultCards;
  }, [state]);

  useEffect(() => {
    if (!startedAt) return;
    const interval = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  function chooseSubject(id: string) {
    setSubjectId(id);
    const next = state.subjects.find((item) => item.id === id);
    setTopic(next?.topics[0]?.name ?? "");
  }

  function createSubject(subject: Subject) {
    onUpdate((current) => ({
      ...current,
      subjects: [...current.subjects, subject],
    }));
  }

  function finish() {
    if (!startedAt || !notes.trim()) return;
    const combined = `${cues} ${notes} ${summary}`.trim();
    const score = scoreMethod(combined, topic, method.id, summary);
    const run: StudyRun = {
      id: createId(),
      method: method.id,
      subjectId: subjectId || undefined,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      durationMinutes: Math.max(
        1,
        Math.round((Date.now() - startedAt) / 60_000),
      ),
      notes: combined,
      score,
    };
    onUpdate((current) => ({
      ...current,
      studyRuns: [...current.studyRuns, run],
    }));
    setStartedAt(null);
    setResult(score);
  }

  return (
    <aside className="panel method-lab">
      <header>
        <span>
          <MethodIcon size={21} />
        </span>
        <div>
          <p className="eyebrow">AKTYWNY TRYB</p>
          <h2>{method.title}</h2>
        </div>
        <strong>{formatClock(remaining)}</strong>
      </header>
      <div className="method-progress">
        <i
          style={{
            width: `${((durationSeconds - remaining) / durationSeconds) * 100}%`,
          }}
        />
      </div>
      {state.settings.showStudyMethodGuides ? (
        <section className="method-guide">
          <div className="method-guide-summary">
            <div>
              <strong>Kiedy użyć</strong>
              <p>{method.whenToUse}</p>
            </div>
            <div>
              <strong>Najlepsze przedmioty</strong>
              <div className="tag-row">
                {method.bestSubjects.map((subjectName) => (
                  <span key={subjectName}>{subjectName}</span>
                ))}
              </div>
            </div>
          </div>
          <details>
            <summary>Instrukcja krok po kroku</summary>
            <ol>
              {method.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="method-warning">
              <strong>Kiedy wybrać inną metodę:</strong> {method.avoidWhen}
            </p>
          </details>
        </section>
      ) : null}
      <div className="method-fields">
        <label>
          Przedmiot
          <SubjectPicker
            subjects={state.subjects}
            value={subjectId}
            onChange={chooseSubject}
            onCreate={createSubject}
            emptyLabel="Ogólne"
          />
        </label>
        <label>
          Temat
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            {subject?.topics.map((item) => (
              <option key={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
      {method.id === "leitner" ? (
        <div className="leitner-boxes">
          {leitner.map((count, index) => (
            <div key={index}>
              <span>Pudełko {index + 1}</span>
              <strong>{count}</strong>
              <small>
                {index < 2 ? "często" : index < 4 ? "rzadziej" : "opanowane"}
              </small>
            </div>
          ))}
        </div>
      ) : null}
      {method.id === "interleaving" ? (
        <div className="interleave-queue">
          {interleaved.map((card, index) => (
            <span key={card.id}>
              <b>{index + 1}</b>
              {card.front}
              <small>
                {state.subjects.find((item) => item.id === card.subjectId)
                  ?.name ?? "Ogólne"}
              </small>
            </span>
          ))}
        </div>
      ) : null}
      {method.id === "cornell" ? (
        <div className="cornell-grid">
          <label>
            Tropy / pytania
            <textarea
              value={cues}
              onChange={(event) => setCues(event.target.value)}
              placeholder="Hasła wywołujące odpowiedź…"
            />
          </label>
          <label>
            Główne notatki
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Fakty, zależności, przykłady…"
            />
          </label>
          <label className="cornell-summary">
            Podsumowanie jednym zdaniem
            <input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <label className="method-notes">
          {method.id === "feynman"
            ? "Wyjaśnienie prostymi słowami"
            : method.id === "blurting"
              ? "Wszystko, co pamiętasz"
              : method.id === "exam-sprint"
                ? "Odpowiedź i retrospekcja"
                : "Notatki z przeplatanej sesji"}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              method.id === "feynman"
                ? "Wyobraź sobie, że tłumaczysz to komuś po raz pierwszy…"
                : "Pisz bez zaglądania do źródeł…"
            }
          />
        </label>
      )}
      {result !== null ? (
        <div className="method-result">
          <span>{result}</span>
          <div>
            <strong>Wynik sesji</strong>
            <p>
              {result >= 80
                ? "Wyjaśnienie jest konkretne i dobrze uporządkowane."
                : result >= 55
                  ? "Dobry fundament. Dodaj przykład lub połącz przyczyny ze skutkami."
                  : "Wróć do źródła, znajdź luki i spróbuj ponownie własnymi słowami."}
            </p>
          </div>
          <Check size={20} />
        </div>
      ) : null}
      <div className="method-actions">
        {startedAt ? (
          <>
            <button
              className="button button-quiet"
              onClick={() => {
                setStartedAt(null);
                setClock(Date.now());
              }}
            >
              <RefreshCcw size={16} />
              Reset
            </button>
            <button
              className="button button-primary"
              disabled={!notes.trim()}
              onClick={finish}
            >
              <Check size={16} />
              Zakończ i oceń
            </button>
          </>
        ) : (
          <button
            className="button button-primary button-large"
            onClick={() => {
              setStartedAt(Date.now());
              setClock(Date.now());
              setResult(null);
            }}
          >
            <Play size={18} fill="currentColor" />
            Rozpocznij {method.minutes} min
          </button>
        )}
      </div>
      <div className="method-history">
        <p className="eyebrow">
          <SquarePen size={13} /> OSTATNIE SESJE
        </p>
        {state.studyRuns
          .filter((run) => run.method === method.id)
          .slice(-3)
          .reverse()
          .map((run) => (
            <span key={run.id}>
              <strong>{run.score}/100</strong>
              {new Date(run.endedAt).toLocaleDateString("pl-PL")} ·{" "}
              {run.durationMinutes} min
            </span>
          ))}
        {!state.studyRuns.some((run) => run.method === method.id) ? (
          <small>Pierwszy wynik pojawi się po zapisaniu sesji.</small>
        ) : null}
      </div>
    </aside>
  );
}

function scoreMethod(
  text: string,
  topic: string,
  method: StudyMethod,
  summary: string,
) {
  const words = text.toLocaleLowerCase("pl").match(/[\p{L}\p{N}]+/gu) ?? [];
  const unique = new Set(words);
  const length = Math.min(45, words.length / 2.2);
  const variety = Math.min(20, unique.size / 2.5);
  const connections = Math.min(
    20,
    (text.match(/ponieważ|dlatego|więc|przykład|oznacza|wynika|zatem/gi)
      ?.length ?? 0) * 5,
  );
  const topicHits = topic
    .toLocaleLowerCase("pl")
    .split(/\s+/)
    .filter((word) => text.toLocaleLowerCase("pl").includes(word)).length;
  const methodBonus =
    method === "cornell" && summary.trim().length > 20
      ? 10
      : method === "feynman" && /na przykład|czyli|wyobraź/gi.test(text)
        ? 10
        : 5;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(length + variety + connections + topicHits * 3 + methodBonus),
    ),
  );
}

function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
