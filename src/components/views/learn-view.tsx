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
  ArrowLeft,
  ArrowRight,
  BookCopy,
  Brain,
  Check,
  Download,
  FileText,
  FolderOpen,
  FlaskConical,
  Import,
  Layers3,
  Image as ImageIcon,
  Music2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { reviewWithFsrs } from "@/lib/fsrs";
import { retentionEstimate, smartReviewQueue } from "@/lib/flashcard-io";
import { createId } from "@/lib/ids";
import { localDateKey } from "@/lib/dates";
import { Modal } from "@/components/modal";
import type { Flashcard, Material, MediaAttachment, Subject, WorkspaceState } from "@/lib/types";
import { FlashcardExchange } from "@/components/flashcard-exchange";
import { StudyMethods } from "@/components/study-methods";
import { StudyToolkit } from "@/components/study-toolkit";
import { SubjectPicker } from "@/components/subject-picker";

type LearnTab = "subjects" | "flashcards" | "toolkit" | "methods" | "materials";

function tabFromHash(): LearnTab {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return ["subjects", "flashcards", "toolkit", "methods", "materials"].includes(hash) ? hash as LearnTab : "subjects";
}

export function LearnView({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const [tab, setActiveTab] = useState<LearnTab>(tabFromHash);
  function setTab(next: LearnTab) {
    setActiveTab(next);
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
  }
  useEffect(() => {
    const restore = () => setActiveTab(tabFromHash());
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("hashchange", restore); window.removeEventListener("popstate", restore); };
  }, []);
  const [addSubject, setAddSubject] = useState(false);
  const [addCard, setAddCard] = useState(false);
  const [exchange, setExchange] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(interval); }, []);
  const due = useMemo(() => {
    const cards =
      state.settings.reviewOrder === "smart"
        ? smartReviewQueue(state.flashcards, now)
        : state.flashcards
            .filter((card) => !card.suspended && new Date(card.dueAt).getTime() <= now)
            .slice()
            .sort((first, second) =>
              state.settings.reviewOrder === "due"
                ? first.dueAt.localeCompare(second.dueAt)
                : stableCardOrder(first.id) - stableCardOrder(second.id),
            );
    return cards.slice(0, state.settings.reviewLimit);
  }, [
    state.flashcards,
    state.settings.reviewLimit,
    state.settings.reviewOrder,
    now,
  ]);
  const today = localDateKey(now);
  const reviewedToday =
    state.reviewActivity.find((entry) => entry.date === today)?.count ?? 0;
  const createSubject = (subject: Subject) =>
    onUpdate((current) => ({
      ...current,
      subjects: [...current.subjects, subject],
    }));
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">AKTYWNE PRZYPOMINANIE</p>
          <h1>Centrum nauki</h1>
          <p>
            Przedmioty, inteligentne fiszki i metody uczenia połączone w jedną
            mapę wiedzy.
          </p>
        </div>
        {tab === "subjects" ? (
          <button
            className="button button-primary"
            onClick={() => setAddSubject(true)}
          >
            <Plus size={18} />
            Nowy przedmiot
          </button>
        ) : tab === "flashcards" ? (
          <div className="button-group">
            <button
              className="button button-quiet"
              onClick={() => setExchange(true)}
            >
              <Import size={18} />
              Import / eksport
            </button>
            <button
              className="button button-primary"
              onClick={() => setAddCard(true)}
            >
              <Plus size={18} />
              Nowa fiszka
            </button>
          </div>
        ) : null}
      </section>
      <nav className="tabs" aria-label="Sekcje nauki">
        <button
          className={tab === "toolkit" ? "active" : ""}
          onClick={() => setTab("toolkit")}
        >
          <FlaskConical size={17} />
          Laboratorium
        </button>
        <button
          className={tab === "subjects" ? "active" : ""}
          onClick={() => setTab("subjects")}
        >
          <Layers3 size={17} />
          Przedmioty
        </button>
        <button
          className={tab === "flashcards" ? "active" : ""}
          onClick={() => setTab("flashcards")}
        >
          <BookCopy size={17} />
          Inteligentne fiszki <span>{due.length}</span>
        </button>
        <button
          className={tab === "methods" ? "active" : ""}
          onClick={() => setTab("methods")}
        >
          <WandSparkles size={17} />
          Tryby nauki
        </button>
        <button
          className={tab === "materials" ? "active" : ""}
          onClick={() => setTab("materials")}
        >
          <FolderOpen size={17} />
          Materiały
        </button>
      </nav>

      {tab === "subjects" ? (
        <Subjects state={state} onUpdate={onUpdate} />
      ) : null}
      {tab === "flashcards" ? (
        reviewing ? (
          <Review
            cards={due}
            subjects={state.subjects}
            flipOnClick={state.settings.flipCardOnClick}
            onExit={() => setReviewing(false)}
            onGrade={(card, grade, confidence, responseMs) =>
              onUpdate((current) => {
                const source = current.flashcards.find((item) => item.id === card.id) ?? card;
                const result = reviewWithFsrs(source, grade, confidence, responseMs);
                const nowIso = result.review.reviewedAt;
                const existingMistake = current.mistakes.find(
                  (item) => item.sourceId === card.id && item.status === "active",
                );
                return {
                  ...current,
                flashcards: current.flashcards.map((item) =>
                  item.id === card.id ? result.card : item,
                ),
                flashcardReviews: [...current.flashcardReviews, result.review],
                reviewActivity: current.reviewActivity.some(
                  (entry) => entry.date === today,
                )
                  ? current.reviewActivity.map((entry) =>
                      entry.date === today
                        ? {
                            ...entry,
                            count: entry.count + 1,
                            updatedAt: new Date().toISOString(),
                          }
                        : entry,
                    )
                  : [
                      ...current.reviewActivity,
                      {
                        id: today,
                        date: today,
                        count: 1,
                        updatedAt: new Date().toISOString(),
                      },
                    ],
                mistakes:
                  grade === 0
                    ? existingMistake
                      ? current.mistakes.map((item) =>
                          item.id === existingMistake.id
                            ? { ...item, count: item.count + 1, nextReviewAt: result.card.dueAt, updatedAt: nowIso }
                            : item,
                        )
                      : [
                          ...current.mistakes,
                          {
                            id: createId(),
                            question: card.front,
                            correctAnswer: card.back,
                            userAnswer: "Nie pamiętam",
                            subjectId: card.subjectId,
                            topic: card.tags?.[0] ?? card.deck ?? "Fiszki",
                            sourceId: card.id,
                            count: 1,
                            status: "active" as const,
                            nextReviewAt: result.card.dueAt,
                            createdAt: nowIso,
                            updatedAt: nowIso,
                          },
                        ]
                    : current.mistakes,
                progress: {
                  ...current.progress,
                  xp: current.progress.xp + (grade === 0 ? 1 : grade + 2),
                },
                activityLog: [
                  ...current.activityLog,
                  {
                    id: createId(),
                    type: "review" as const,
                    description: `Powtórka fiszki: ${card.front.slice(0, 80)}`,
                    xp: grade === 0 ? 1 : grade + 2,
                    entityId: card.id,
                    createdAt: nowIso,
                  },
                ].slice(-1000),
                };
              })
            }
          />
        ) : (
          <Flashcards
            state={state}
            due={due}
            now={now}
            reviewedToday={reviewedToday}
            onReview={() => setReviewing(true)}
            onDelete={(id) => {
              if (
                state.settings.confirmBeforeDelete &&
                !window.confirm("Usunąć tę fiszkę?")
              )
                return;
              onUpdate((current) => ({
                ...current,
                flashcards: current.flashcards.filter((card) => card.id !== id),
                trash: [
                  ...current.trash,
                  ...current.flashcards
                    .filter((card) => card.id === id)
                    .map((card) => ({
                      id: createId(),
                      collection: "flashcards" as const,
                      label: card.front,
                      snapshot: card,
                      deletedAt: new Date().toISOString(),
                      expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
                      createdAt: new Date().toISOString(),
                    })),
                ],
              }));
            }}
          />
        )
      ) : null}
      {tab === "methods" ? (
        <StudyMethods state={state} onUpdate={onUpdate} />
      ) : null}
      {tab === "toolkit" ? (
        <StudyToolkit state={state} onUpdate={onUpdate} />
      ) : null}
      {tab === "materials" ? (
        <Materials state={state} onUpdate={onUpdate} />
      ) : null}
      {addSubject ? (
        <SubjectForm
          onClose={() => setAddSubject(false)}
          onSubmit={(subject) => {
            onUpdate((current) => ({
              ...current,
              subjects: [...current.subjects, subject],
            }));
            setAddSubject(false);
          }}
        />
      ) : null}
      {addCard ? (
        <CardForm
          subjects={state.subjects}
          defaultDeck={state.settings.defaultDeck}
          defaultSubjectId={state.settings.defaultSubjectId}
          onCreateSubject={createSubject}
          onClose={() => setAddCard(false)}
          onSubmit={(card) => {
            onUpdate((current) => ({
              ...current,
              flashcards: [card, ...current.flashcards],
            }));
            setAddCard(false);
          }}
        />
      ) : null}
      {exchange ? (
        <FlashcardExchange
          cards={state.flashcards}
          subjects={state.subjects}
          defaultDeck={state.settings.defaultDeck}
          defaultSubjectId={state.settings.defaultSubjectId}
          onCreateSubject={createSubject}
          onClose={() => setExchange(false)}
          onImport={(cards) =>
            onUpdate((current) => ({
              ...current,
              flashcards: [...cards, ...current.flashcards],
            }))
          }
        />
      ) : null}
    </div>
  );
}

function Subjects({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [topicSubjectId, setTopicSubjectId] = useState<string | null>(null);
  const [topicName, setTopicName] = useState("");
  function removeSubject(subject: Subject) {
    if (
      state.settings.confirmBeforeDelete &&
      !window.confirm(
        `Usunąć przedmiot „${subject.name}”? Zadania i fiszki pozostaną jako ogólne.`,
      )
    )
      return;
    onUpdate((current) => ({
      ...current,
      subjects: current.subjects.filter((item) => item.id !== subject.id),
      tasks: current.tasks.map((task) =>
        task.subjectId === subject.id
          ? { ...task, subjectId: undefined }
          : task,
      ),
      flashcards: current.flashcards.map((card) =>
        card.subjectId === subject.id
          ? { ...card, subjectId: undefined }
          : card,
      ),
      exams: current.exams.map((exam) => ({
        ...exam,
        subjectIds: exam.subjectIds.filter((id) => id !== subject.id),
      })),
      settings: {
        ...current.settings,
        defaultSubjectId:
          current.settings.defaultSubjectId === subject.id
            ? ""
            : current.settings.defaultSubjectId,
      },
    }));
  }

  function renameSubject(subject: Subject) {
    setEditingSubject(subject);
    setSubjectName(subject.name);
  }

  function removeTopic(subjectId: string, topicId: string) {
    onUpdate((current) => ({
      ...current,
      subjects: current.subjects.map((subject) => {
        if (subject.id !== subjectId) return subject;
        const topics = subject.topics.filter((topic) => topic.id !== topicId);
        return {
          ...subject,
          topics,
          mastery: topics.length
            ? Math.round(
                topics.reduce((sum, topic) => sum + topic.mastery, 0) /
                  topics.length,
              )
            : 0,
        };
      }),
    }));
  }

  return (
    <section className="subject-grid">
      {state.subjects.map((subject) => (
        <article className="panel subject-card" key={subject.id}>
          <div className="subject-top">
            <span style={{ background: subject.color }}>
              {subject.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2>{subject.name}</h2>
              <p>
                {subject.topics.length}{" "}
                {subject.topics.length === 1 ? "temat" : "tematy"}
              </p>
            </div>
            <strong>{subject.mastery}%</strong>
            <div className="subject-actions">
              <input
                type="color"
                value={subject.color}
                aria-label={`Kolor przedmiotu ${subject.name}`}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    subjects: current.subjects.map((item) =>
                      item.id === subject.id
                        ? { ...item, color: event.target.value }
                        : item,
                    ),
                  }))
                }
              />
              <button
                className="icon-button"
                aria-label={`Zmień nazwę ${subject.name}`}
                onClick={() => renameSubject(subject)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`Usuń przedmiot ${subject.name}`}
                onClick={() => removeSubject(subject)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="mastery-bar">
            <i
              style={{
                width: `${subject.mastery}%`,
                background: subject.color,
              }}
            />
          </div>
          <div className="topic-list">
            {subject.topics.map((topic) => (
              <div className="topic-control" key={topic.id}>
                <label>
                  <span>
                    {topic.name}
                    <small>{topic.mastery}%</small>
                  </span>
                  <input
                    aria-label={`Opanowanie: ${topic.name}`}
                    type="range"
                    min="0"
                    max="100"
                    value={topic.mastery}
                    onChange={(event) => {
                      const mastery = Number(event.target.value);
                      onUpdate((current) => ({
                        ...current,
                        subjects: current.subjects.map((item) =>
                          item.id === subject.id
                            ? {
                                ...item,
                                topics: item.topics.map((entry) =>
                                  entry.id === topic.id
                                    ? { ...entry, mastery }
                                    : entry,
                                ),
                                mastery: Math.round(
                                  item.topics.reduce(
                                    (sum, entry) =>
                                      sum +
                                      (entry.id === topic.id
                                        ? mastery
                                        : entry.mastery),
                                    0,
                                  ) / item.topics.length,
                                ),
                              }
                            : item,
                        ),
                      }));
                    }}
                  />
                </label>
                <button
                  className="icon-button danger"
                  aria-label={`Usuń temat ${topic.name}`}
                  onClick={() => removeTopic(subject.id, topic.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="button button-quiet"
            onClick={() => {
              setTopicSubjectId(subject.id);
              setTopicName("");
            }}
          >
            <Plus size={15} />
            Dodaj temat
          </button>
        </article>
      ))}
      {!state.subjects.length ? (
        <EmptyState
          icon={Layers3}
          title="Nie masz jeszcze przedmiotów"
          text="Dodaj pierwszy przedmiot tutaj albo bezpośrednio podczas tworzenia zadania lub fiszki."
        />
      ) : null}
      {editingSubject ? (
        <Modal title="Zmień nazwę przedmiotu" onClose={() => setEditingSubject(null)}>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!subjectName.trim()) return;
              onUpdate((current) => ({
                ...current,
                subjects: current.subjects.map((item) =>
                  item.id === editingSubject.id ? { ...item, name: subjectName.trim() } : item,
                ),
              }));
              setEditingSubject(null);
            }}
          >
            <label>Nazwa przedmiotu<input autoFocus value={subjectName} onChange={(event) => setSubjectName(event.target.value)} maxLength={80} required /></label>
            <div className="form-actions"><button className="button button-primary" type="submit">Zapisz</button></div>
          </form>
        </Modal>
      ) : null}
      {topicSubjectId ? (
        <Modal title="Dodaj temat" onClose={() => setTopicSubjectId(null)}>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!topicName.trim()) return;
              onUpdate((current) => ({
                ...current,
                subjects: current.subjects.map((item) =>
                  item.id === topicSubjectId
                    ? { ...item, topics: [...item.topics, { id: createId(), name: topicName.trim(), mastery: 0 }] }
                    : item,
                ),
              }));
              setTopicSubjectId(null);
            }}
          >
            <label>Nazwa tematu<input autoFocus value={topicName} onChange={(event) => setTopicName(event.target.value)} maxLength={100} required /></label>
            <div className="form-actions"><button className="button button-primary" type="submit">Dodaj temat</button></div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function Flashcards({
  state,
  due,
  now,
  reviewedToday,
  onReview,
  onDelete,
}: {
  state: WorkspaceState;
  due: Flashcard[];
  now: number;
  reviewedToday: number;
  onReview: () => void;
  onDelete: (id: string) => void;
}) {
  const [deck, setDeck] = useState("all");
  const decks = [
    ...new Set(state.flashcards.map((card) => card.deck ?? "Ogólne")),
  ];
  const visible =
    deck === "all"
      ? state.flashcards
      : state.flashcards.filter((card) => (card.deck ?? "Ogólne") === deck);
  const weak = state.flashcards.filter(
    (card) => (card.lapses ?? 0) >= 3,
  ).length;
  const forgettingRate = state.flashcardReviews.length
    ? Math.round((state.flashcardReviews.filter((review) => review.grade === 0).length / state.flashcardReviews.length) * 100)
    : 0;
  const averageResponse = state.flashcardReviews.length
    ? Math.round(state.flashcardReviews.reduce((sum, review) => sum + review.responseMs, 0) / state.flashcardReviews.length / 100) / 10
    : 0;
  const hardest = state.flashcards
    .filter((card) => (card.lapses ?? 0) > 0)
    .slice()
    .sort((first, second) => (second.lapses ?? 0) - (first.lapses ?? 0))
    .slice(0, 5);
  return (
    <div className="learn-grid">
      <article className="panel review-hero smart-review-hero">
        <div>
          <p className="eyebrow">
            <Brain size={14} /> SMART REVIEW
          </p>
          <h2>
            {due.length
              ? `${due.length} kart w inteligentnej kolejce`
              : "Wszystko powtórzone"}
          </h2>
          <p>
            Przeplatamy przedmioty, wcześniej pokazujemy zaległe i trudne karty,
            a interwały uczą się z każdej odpowiedzi.
          </p>
          <div className="smart-review-stats">
            <span>
              <strong>{reviewedToday} / {state.settings.dailyReviewGoal}</strong> cel dzienny
            </span>
            <span>
              <strong>{weak}</strong> trudne karty
            </span>
            <span>
              <strong>{decks.length}</strong> talie
            </span>
            <span>
              <strong>
                {
                  state.flashcards.filter(
                    (card) => (card.correctStreak ?? 0) >= 5,
                  ).length
                }
              </strong>{" "}
              opanowane
            </span>
            <span><strong>{forgettingRate}%</strong> zapominania</span>
            <span><strong>{averageResponse || "—"}{averageResponse ? " s" : ""}</strong> średnia odpowiedź</span>
          </div>
        </div>
        <button
          className="button button-primary button-large"
          disabled={!due.length}
          onClick={onReview}
        >
          Rozpocznij Smart Review <ArrowRight size={18} />
        </button>
      </article>
      <section className="panel card-library">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BIBLIOTEKA</p>
            <h2>Wszystkie fiszki</h2>
          </div>
          <div className="card-library-controls">
            <select
              aria-label="Filtruj talię"
              value={deck}
              onChange={(event) => setDeck(event.target.value)}
            >
              <option value="all">Wszystkie talie</option>
              {decks.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
            <span>{visible.length}</span>
          </div>
        </div>
        {visible.length ? (
          <div className="flashcard-list">
            {visible.map((card) => {
              const retention = retentionEstimate(card, now);
              return (
                <article key={card.id}>
                  <div>
                    <small>
                      {card.deck ?? "Ogólne"} ·{" "}
                      {state.subjects.find(
                        (subject) => subject.id === card.subjectId,
                      )?.name ?? "Ogólne"}
                    </small>
                    <strong>{card.front}</strong>
                    <span>{card.back}</span>
                    <div className="tag-row">
                      {(card.tags ?? []).slice(0, 4).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <time>
                    <b className={retention < 60 ? "low-retention" : ""}>
                      {retention}% pamięci
                    </b>
                    Następna: {new Date(card.dueAt).toLocaleDateString("pl-PL")}
                  </time>
                  <button
                    className="icon-button danger"
                    onClick={() => onDelete(card.id)}
                    aria-label="Usuń fiszkę"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={BookCopy}
            title="Brak fiszek"
            text="Dodaj kartę albo zaimportuj talię z Quizleta lub pliku."
          />
        )}
      </section>
      <section className="panel flashcard-insights">
        <div className="panel-heading"><div><p className="eyebrow">FSRS MEMORY LAB</p><h2>Najtrudniejsze karty</h2></div><span>{state.flashcardReviews.length} ocen</span></div>
        {hardest.length ? hardest.map((card) => (
          <article key={card.id}><div><strong>{card.front}</strong><small>{card.deck ?? "Ogólne"} · trudność FSRS {card.fsrs?.difficulty.toFixed(1) ?? "—"}</small></div><span><b>{card.lapses ?? 0}</b> pomyłek</span><span><b>{retentionEstimate(card, now)}%</b> pamięci</span></article>
        )) : <p className="empty-copy">Po pierwszych powtórkach zobaczysz tu karty o największym ryzyku zapomnienia.</p>}
      </section>
    </div>
  );
}

function Review({
  cards,
  subjects,
  flipOnClick,
  onExit,
  onGrade,
}: {
  cards: Flashcard[];
  subjects: Subject[];
  flipOnClick: boolean;
  onExit: () => void;
  onGrade: (
    card: Flashcard,
    grade: 0 | 1 | 2 | 3,
    confidence: 1 | 2 | 3 | 4 | 5,
    responseMs: number,
  ) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [answerChoice, setAnswerChoice] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const card = cards[index];
  if (!card)
    return (
      <section className="panel review-complete">
        <span>
          <Check size={28} />
        </span>
        <h2>Powtórki zakończone</h2>
        <p>Każda karta ma już wyznaczony następny termin.</p>
        <button className="button button-primary" onClick={onExit}>
          Wróć do biblioteki
        </button>
      </section>
    );
  function grade(value: 0 | 1 | 2 | 3) {
    onGrade(card, value, confidence ?? 3, Date.now() - startedAt);
    setRevealed(false);
    setConfidence(null);
    setAnswerChoice(null);
    setStartedAt(Date.now());
    setIndex((current) => current + 1);
  }
  return (
    <section className="review-page">
      <header>
        <button className="text-button" onClick={onExit}>
          <ArrowLeft size={16} />
          Zakończ
        </button>
        <div>
          <span style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
        <strong>
          {index + 1} / {cards.length}
        </strong>
      </header>
      <article
        className={`study-card ${revealed ? "revealed" : ""}`}
        role={flipOnClick ? "button" : undefined}
        tabIndex={flipOnClick ? 0 : undefined}
        onClick={flipOnClick ? () => setRevealed(true) : undefined}
        onKeyDown={
          flipOnClick
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setRevealed(true);
                }
              }
            : undefined
        }
      >
        <small>
          {subjects.find((subject) => subject.id === card.subjectId)?.name ??
            "Ogólne"}
        </small>
        <div>
          <p>PYTANIE</p>
          <h2>{card.front}</h2>
          <CardMedia media={card.frontMedia} />
          {card.kind === "multiple-choice" && card.choices?.length ? (
            <div className="review-choices" onClick={(event) => event.stopPropagation()}>
              {card.choices.map((choice, choiceIndex) => (
                <button
                  type="button"
                  className={answerChoice === choiceIndex ? "active" : ""}
                  key={`${choice}-${choiceIndex}`}
                  onClick={() => setAnswerChoice(choiceIndex)}
                >
                  {String.fromCharCode(65 + choiceIndex)}. {choice}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {revealed ? (
          <div className="card-answer">
            <p>ODPOWIEDŹ</p>
            <strong>{card.back}</strong>
            <CardMedia media={card.backMedia} />
            {card.kind === "multiple-choice" && card.correctChoice !== undefined ? (
              <small>
                {answerChoice === card.correctChoice ? "Wybrano poprawną odpowiedź." : `Poprawna odpowiedź: ${String.fromCharCode(65 + card.correctChoice)}.`}
              </small>
            ) : null}
          </div>
        ) : (
          <div className="confidence-before-answer" onClick={(event) => event.stopPropagation()}>
            <span>Jak pewna jest Twoja odpowiedź?</span>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  className={confidence === value ? "active" : ""}
                  key={value}
                  onClick={() => setConfidence(value as 1 | 2 | 3 | 4 | 5)}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              className="button button-secondary"
              disabled={!confidence}
              onClick={() => setRevealed(true)}
            >
              Pokaż odpowiedź
            </button>
          </div>
        )}
      </article>
      {revealed ? (
        <div className="grade-row">
          <button onClick={() => grade(0)}>
            <span>1</span>Nie pamiętam
          </button>
          <button onClick={() => grade(1)}>
            <span>2</span>Trudne
          </button>
          <button onClick={() => grade(2)}>
            <span>3</span>Dobrze
          </button>
          <button onClick={() => grade(3)}>
            <span>4</span>Łatwe
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Materials({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      window.alert("Maksymalny rozmiar pojedynczego pliku to 2 MB.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "txt", "md", "markdown", "png", "jpg", "jpeg", "webp"].includes(extension)) {
      window.alert("Obsługiwane są PDF, obrazy, TXT i Markdown.");
      return;
    }
    let content = "";
    const binary = extension === "pdf" || ["png", "jpg", "jpeg", "webp"].includes(extension);
    const dataUrl = binary ? await readAsDataUrl(file) : undefined;
    if (!binary) content = await file.text();
    else content = `Załącznik: ${file.name}`;
    const material: Material = {
      id: createId(),
      title: file.name,
      type:
        extension === "pdf" ? "pdf" : binary ? "image" : extension === "txt" ? "txt" : "markdown",
      content,
      dataUrl,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };
    onUpdate((current) => ({
      ...current,
      materials: [material, ...current.materials],
    }));
    event.target.value = "";
  }
  function saveText() {
    if (!text.trim()) return;
    const material: Material = {
      id: createId(),
      title:
        title.trim() || `Notatka ${new Date().toLocaleDateString("pl-PL")}`,
      type: "text",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    onUpdate((current) => ({
      ...current,
      materials: [material, ...current.materials],
    }));
    setText("");
    setTitle("");
  }
  function extract(material: Material) {
    const sentences = material.content
      .split(/[.!?\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 18)
      .slice(0, 6);
    const cards: Flashcard[] = sentences.map((sentence) => ({
      id: createId(),
      front: `Wyjaśnij: ${sentence.split(" ").slice(0, 5).join(" ")}…`,
      back: sentence,
      dueAt: new Date().toISOString(),
      intervalDays: 0,
      ease: 2.5,
      repetitions: 0,
    }));
    onUpdate((current) => ({
      ...current,
      flashcards: [...cards, ...current.flashcards],
    }));
    window.alert(`Utworzono ${cards.length} pytań Active Recall lokalnie.`);
  }
  return (
    <div className="materials-layout">
      <section className="panel import-panel">
        <div>
          <span className="import-icon">
            <Upload size={22} />
          </span>
          <h2>Dodaj materiał</h2>
          <p>
            PDF, obraz, TXT, Markdown lub wklejony tekst. Załączniki do 2 MB są
            zaszyfrowane w workspace i synchronizowane offline.
          </p>
          <input
            hidden
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown"
            onChange={upload}
          />
          <button
            className="button button-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={17} />
            Wybierz plik
          </button>
        </div>
        <div className="paste-area">
          <label>
            Tytuł
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nazwa notatki"
            />
          </label>
          <label>
            Wklej treść
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Wklej fragment podręcznika lub własne notatki…"
            />
          </label>
          <button className="button button-primary" onClick={saveText}>
            Zapisz materiał
          </button>
        </div>
      </section>
      <section className="panel material-library">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BIBLIOTEKA</p>
            <h2>Twoje materiały</h2>
          </div>
          <span>{state.materials.length}</span>
        </div>
        {state.materials.length ? (
          state.materials.map((material) => (
            <article className="material-row" key={material.id}>
              <span>
                <FileText size={20} />
              </span>
              <div>
                <strong>{material.title}</strong>
                <small>
                  {material.type.toUpperCase()} · {material.sizeBytes ? `${Math.ceil(material.sizeBytes / 1024)} KB` : `${material.content.length} znaków`} ·{" "}
                  {new Date(material.createdAt).toLocaleDateString("pl-PL")}
                </small>
              </div>
              {material.dataUrl ? (
                <a className="button button-quiet" href={material.dataUrl} download={material.title}>
                  <Download size={15} /> Pobierz plik
                </a>
              ) : (
                <button
                  className="button button-quiet"
                  onClick={() => extract(material)}
                >
                  <Sparkles size={15} /> Utwórz pytania
                </button>
              )}
              <button
                className="icon-button danger"
                aria-label="Usuń materiał"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    materials: current.materials.filter(
                      (item) => item.id !== material.id,
                    ),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="Biblioteka jest pusta"
            text="Dodaj notatkę lub plik z materiałem."
          />
        )}
      </section>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function SubjectForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (subject: Subject) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6f7dff");
  const [topics, setTopics] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      id: createId(),
      name: name.trim(),
      color,
      mastery: 0,
      topics: topics
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean)
        .map((topic) => ({ id: createId(), name: topic, mastery: 0 })),
    });
  }
  return (
    <Modal title="Nowy przedmiot" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Nazwa
          <input
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="np. Biologia"
          />
        </label>
        <label>
          Kolor
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
        <label>
          Tematy (po przecinku)
          <textarea
            value={topics}
            onChange={(event) => setTopics(event.target.value)}
            placeholder="Genetyka, Ekologia, Anatomia"
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
            <Plus size={16} />
            Dodaj
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CardForm({
  subjects,
  defaultDeck,
  defaultSubjectId,
  onCreateSubject,
  onClose,
  onSubmit,
}: {
  subjects: Subject[];
  defaultDeck: string;
  defaultSubjectId: string;
  onCreateSubject: (subject: Subject) => void;
  onClose: () => void;
  onSubmit: (card: Flashcard) => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [subjectId, setSubjectId] = useState(
    subjects.some((subject) => subject.id === defaultSubjectId)
      ? defaultSubjectId
      : (subjects[0]?.id ?? ""),
  );
  const [deck, setDeck] = useState(defaultDeck || "Ogólne");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<NonNullable<Flashcard["kind"]>>("text");
  const [frontMedia, setFrontMedia] = useState<MediaAttachment | undefined>();
  const [backMedia, setBackMedia] = useState<MediaAttachment | undefined>();
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctChoice, setCorrectChoice] = useState(0);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!front.trim() || !back.trim()) return;
    onSubmit({
      id: createId(),
      subjectId: subjectId || undefined,
      front: front.trim(),
      back: back.trim(),
      dueAt: new Date().toISOString(),
      intervalDays: 0,
      ease: 2.5,
      repetitions: 0,
      deck: deck.trim() || "Ogólne",
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      source: "manual",
      createdAt: new Date().toISOString(),
      lapses: 0,
      correctStreak: 0,
      kind,
      frontMedia,
      backMedia,
      choices:
        kind === "multiple-choice"
          ? choices.map((choice) => choice.trim()).filter(Boolean)
          : undefined,
      correctChoice: kind === "multiple-choice" ? correctChoice : undefined,
      updatedAt: new Date().toISOString(),
    });
  }
  return (
    <Modal title="Nowa inteligentna fiszka" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Przedmiot
          <SubjectPicker
            subjects={subjects}
            value={subjectId}
            onChange={setSubjectId}
            onCreate={onCreateSubject}
            emptyLabel="Ogólne"
          />
        </label>
        <label>
          Talia
          <input
            value={deck}
            onChange={(event) => setDeck(event.target.value)}
            placeholder="np. Matura — funkcje"
          />
        </label>
        <label>
          Typ fiszki
          <select value={kind} onChange={(event) => setKind(event.target.value as NonNullable<Flashcard["kind"]>)}>
            <option value="text">Tekstowa</option>
            <option value="image">Obrazkowa</option>
            <option value="audio">Dźwiękowa</option>
            <option value="multiple-choice">Wielokrotnego wyboru</option>
          </select>
        </label>
        <label>
          Przód
          <textarea
            autoFocus
            required
            value={front}
            onChange={(event) => setFront(event.target.value)}
            placeholder="Pytanie lub pojęcie"
          />
        </label>
        {kind === "image" || kind === "audio" ? (
          <MediaPicker
            label="Plik na przodzie"
            accept={kind === "image" ? "image/*" : "audio/*"}
            value={frontMedia}
            onChange={setFrontMedia}
          />
        ) : null}
        <label>
          Tył
          <textarea
            required
            value={back}
            onChange={(event) => setBack(event.target.value)}
            placeholder="Odpowiedź"
          />
        </label>
        {kind === "image" || kind === "audio" ? (
          <MediaPicker
            label="Plik przy odpowiedzi"
            accept={kind === "image" ? "image/*" : "audio/*"}
            value={backMedia}
            onChange={setBackMedia}
          />
        ) : null}
        {kind === "multiple-choice" ? (
          <fieldset className="choice-editor">
            <legend>Odpowiedzi — zaznacz poprawną</legend>
            {choices.map((choice, index) => (
              <label key={index}>
                <input
                  type="radio"
                  name="correct-choice"
                  checked={correctChoice === index}
                  onChange={() => setCorrectChoice(index)}
                />
                <input
                  value={choice}
                  required={index < 2}
                  placeholder={`Odpowiedź ${String.fromCharCode(65 + index)}`}
                  onChange={(event) =>
                    setChoices((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))
                  }
                />
              </label>
            ))}
          </fieldset>
        ) : null}
        <label>
          Tagi
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="wzory, trudne, rozdział-3"
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
          <button className="button button-primary">Dodaj kartę</button>
        </div>
      </form>
    </Modal>
  );
}

function stableCardOrder(id: string) {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) {
    value = (value * 31 + id.charCodeAt(index)) | 0;
  }
  return value;
}

function CardMedia({ media }: { media?: MediaAttachment }) {
  if (!media) return null;
  return media.mimeType.startsWith("image/") ? (
    // User-provided data URLs cannot use the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="flashcard-media" src={media.dataUrl} alt={media.name} />
  ) : (
    <audio className="flashcard-audio" controls preload="metadata" src={media.dataUrl}>
      Twoja przeglądarka nie obsługuje dźwięku.
    </audio>
  );
}

function MediaPicker({
  label,
  accept,
  value,
  onChange,
}: {
  label: string;
  accept: string;
  value?: MediaAttachment;
  onChange: (value?: MediaAttachment) => void;
}) {
  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      window.alert("Plik fiszki może mieć maksymalnie 1,5 MB.");
      event.target.value = "";
      return;
    }
    onChange({ name: file.name, mimeType: file.type, dataUrl: await readAsDataUrl(file) });
  }
  return (
    <label className="media-picker">
      {label}
      <span>
        {accept.startsWith("image") ? <ImageIcon size={17} /> : <Music2 size={17} />}
        <input type="file" accept={accept} onChange={(event) => void pick(event)} />
        {value?.name ?? "Wybierz plik"}
        {value ? <button type="button" onClick={() => onChange(undefined)}>Usuń</button> : null}
      </span>
    </label>
  );
}
