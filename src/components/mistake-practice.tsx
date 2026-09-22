"use client";

import { useState } from "react";
import { BookPlus, Check, RotateCcw } from "lucide-react";
import { createId } from "@/lib/ids";
import { gradeMistake, hasMistakeFlashcard, mistakePracticeQueue } from "@/lib/mistake-practice";
import type { MistakeEntry, WorkspaceState } from "@/lib/types";

type UpdateWorkspace = (recipe: (state: WorkspaceState) => WorkspaceState) => void;

export function MistakePractice({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [queue, setQueue] = useState<MistakeEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const current = queue[index];

  function begin() {
    setQueue(mistakePracticeQueue(state.mistakes));
    setIndex(0);
    setAnswer("");
    setRevealed(false);
    setMessage("");
  }

  function grade(correct: boolean) {
    if (!current) return;
    const response = answer;
    onUpdate((workspace) => ({ ...workspace, mistakes: workspace.mistakes.map((item) =>
      item.id === current.id ? gradeMistake(item, response, correct) : item) }));
    setIndex((value) => value + 1);
    setAnswer("");
    setRevealed(false);
    setMessage(correct ? "Odpowiedź zapisana. Dwie poprawne próby zamykają błąd." : "Błąd wróci jutro do powtórki.");
  }

  function makeCard() {
    if (!current) return;
    if (hasMistakeFlashcard(state.flashcards, current)) {
      setMessage("Ta fiszka już istnieje.");
      return;
    }
    const now = new Date().toISOString();
    onUpdate((workspace) => {
      if (hasMistakeFlashcard(workspace.flashcards, current)) return workspace;
      return { ...workspace, flashcards: [...workspace.flashcards, {
        id: createId(), front: current.question, back: current.correctAnswer, subjectId: current.subjectId,
        dueAt: now, intervalDays: 0, ease: 2.5, repetitions: 0, deck: current.topic,
        tags: [current.topic], kind: "text" as const, source: "manual" as const,
        sourceMistakeId: current.id, createdAt: now, updatedAt: now,
      }] };
    });
    setMessage("Fiszka dodana do powtórek FSRS.");
  }

  return <section className="panel mistake-practice" aria-label="Sesja poprawiania błędów">
    <div className="panel-heading"><div><p className="eyebrow">AKTYWNE PRZYPOMINANIE</p><h2>Popraw moje błędy</h2></div><span>{state.mistakes.filter((item) => item.status === "active").length} do poprawy</span></div>
    {!queue.length || index >= queue.length ? <div className="mistake-practice-intro">
      <p>{queue.length ? "Sesja zakończona. Wróć do kolejnych pytań, gdy nadejdzie czas powtórki." : "Krótka seria do 8 pytań z Twojej bazy błędów. Najpierw odpowiedz samodzielnie, potem porównaj z rozwiązaniem."}</p>
      <button className="button button-primary" disabled={!state.mistakes.some((item) => item.status === "active")} onClick={begin}><RotateCcw size={16} /> {queue.length ? "Nowa sesja" : "Rozpocznij sesję"}</button>
    </div> : <div className="mistake-practice-question">
      <small>Pytanie {index + 1}/{queue.length} · {current.topic}</small>
      <h3>{current.question}</h3>
      <label>Twoja odpowiedź<textarea value={answer} disabled={revealed} onChange={(event) => setAnswer(event.target.value)} placeholder="Odpowiedz własnymi słowami…" /></label>
      {!revealed ? <button className="button button-primary" disabled={!answer.trim()} onClick={() => setRevealed(true)}>Pokaż rozwiązanie</button> : <>
        <div className="mistake-practice-answer"><small>Odpowiedź wzorcowa</small><strong>{current.correctAnswer}</strong><small>Twoja odpowiedź: {answer}</small></div>
        <p>Oceń treść odpowiedzi, nie tylko identyczność słów.</p>
        <div className="button-group"><button className="button button-secondary" onClick={() => grade(false)}>Wymaga poprawy</button><button className="button button-primary" onClick={() => grade(true)}><Check size={16} /> Poprawnie</button><button className="button button-quiet" onClick={makeCard}><BookPlus size={16} /> Zamień w fiszkę</button></div>
      </>}
    </div>}
    {message ? <p className="inline-notice" role="status">{message}</p> : null}
  </section>;
}
