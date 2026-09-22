"use client";

import { useMemo, useState } from "react";
import { BarChart3, Clock3 } from "lucide-react";
import { planVsActual, subjectInsights } from "@/lib/study-insights";
import type { WorkspaceState } from "@/lib/types";

export function StudyInsights({ state }: { state: WorkspaceState }) {
  const [selected, setSelected] = useState("");
  const accuracy = useMemo(() => planVsActual(state), [state]);
  const subjects = useMemo(() => subjectInsights(state), [state]);
  const visible = selected ? subjects.filter((item) => item.id === selected) : subjects;
  return <div className="study-insights">
    <section className="panel insight-report">
      <div className="panel-heading"><div><p className="eyebrow">SZACUNKI I FAKTY</p><h2>Plan kontra wykonanie</h2></div><Clock3 size={20} /></div>
      {accuracy.completedCount ? <>
        <div className="insight-metrics"><span><small>Plan ukończonych zadań</small><strong>{accuracy.estimated} min</strong></span><span><small>Rzeczywisty czas</small><strong>{accuracy.actual} min</strong></span><span><small>Różnica</small><strong>{accuracy.difference > 0 ? "+" : ""}{accuracy.difference} min</strong></span></div>
        <p>{accuracy.adjustment === null ? "Po ukończeniu co najmniej 3 zadań pokażemy sugestię kolejnych szacunków." : `Na podstawie mediany ${accuracy.completedCount} zadań: przy następnym planowaniu przewiduj około ${Math.round(25 * accuracy.adjustment)} min na pracę wcześniej szacowaną na 25 min.`}</p>
      </> : <p>Ukończ zadanie z przypisaną sesją, aby porównać szacunek z rzeczywistym czasem. Brak danych nie oznacza braku postępu.</p>}
      <small>Pozostałe zadania: {accuracy.pendingEstimate} min według obecnych szacunków. Sugestia nie zmienia ich automatycznie.</small>
    </section>
    <section className="panel insight-report">
      <div className="panel-heading"><div><p className="eyebrow">OSTATNIE 30 DNI</p><h2>Raport według przedmiotu</h2></div><BarChart3 size={20} /></div>
      {subjects.length ? <>
        <label className="insight-subject-filter">Przedmiot <select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Wszystkie</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <div className="insight-subjects">{visible.map((item) => <article key={item.id}>
          <h3><i style={{ background: item.color }} />{item.name}</h3>
          <div className="insight-metrics"><span><small>Skupienie</small><strong>{item.focusMinutes} min</strong></span><span><small>Quizy</small><strong>{item.quizAverage === null ? "Brak danych" : `${item.quizAverage}%`}</strong></span><span><small>Fiszki do powtórki</small><strong>{item.dueCards}</strong></span><span><small>Aktywne błędy</small><strong>{item.activeMistakes}</strong></span></div>
          <p>{item.activeMistakes || item.dueCards ? `Warto wrócić do ${item.activeMistakes} błędów i ${item.dueCards} fiszek.` : item.quizAverage !== null && item.quizAverage < 70 ? "Wyniki quizów sugerują dodatkowe ćwiczenia." : item.quizAverage === null && !item.focusMinutes ? "Dodaj sesję lub quiz, aby uzyskać wskazówki." : "Brak pilnych zaległości w zapisanych danych."}</p>
          <small>{item.quizCount} prób quizowych · {item.openTasks} otwartych zadań</small>
        </article>)}</div>
      </> : <p>Dodaj przedmiot, aby zobaczyć jego raport.</p>}
    </section>
  </div>;
}
