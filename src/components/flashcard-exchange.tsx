"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  Clipboard,
  Download,
  FileJson,
  FileSpreadsheet,
  Import,
  RefreshCcw,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { SubjectPicker } from "@/components/subject-picker";
import {
  exportFlashcards,
  parseFlashcards,
  type FlashcardImportFormat,
  type ImportedCard,
} from "@/lib/flashcard-io";
import { createId } from "@/lib/ids";
import type { Flashcard, Subject } from "@/lib/types";

export function FlashcardExchange({
  cards,
  subjects,
  defaultDeck,
  defaultSubjectId,
  onCreateSubject,
  onClose,
  onImport,
}: {
  cards: Flashcard[];
  subjects: Subject[];
  defaultDeck: string;
  defaultSubjectId: string;
  onCreateSubject: (subject: Subject) => void;
  onClose: () => void;
  onImport: (cards: Flashcard[]) => void;
}) {
  const [tab, setTab] = useState<"import" | "export">("import");
  const [format, setFormat] = useState<FlashcardImportFormat>("auto");
  const [text, setText] = useState("");
  const [deck, setDeck] = useState(defaultDeck || "Importowana talia");
  const [subjectId, setSubjectId] = useState(
    subjects.some((subject) => subject.id === defaultSubjectId)
      ? defaultSubjectId
      : "",
  );
  const [tags, setTags] = useState("import");
  const [reverse, setReverse] = useState(false);
  const [exportFormat, setExportFormat] = useState<
    "quizlet" | "csv" | "tsv" | "json"
  >("quizlet");
  const [exportDeck, setExportDeck] = useState("all");
  const [message, setMessage] = useState("");
  const [ankiCards, setAnkiCards] = useState<ImportedCard[] | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(
    () => ankiCards ?? parseFlashcards(text, format),
    [ankiCards, format, text],
  );
  const known = useMemo(
    () =>
      new Set(
        cards.map(
          (card) =>
            `${card.front.toLocaleLowerCase("pl")}\u0000${card.back.toLocaleLowerCase("pl")}`,
        ),
      ),
    [cards],
  );
  const fresh = useMemo(
    () =>
      parsed.filter(
        (card) =>
          !known.has(
            `${card.front.toLocaleLowerCase("pl")}\u0000${card.back.toLocaleLowerCase("pl")}`,
          ),
      ),
    [known, parsed],
  );
  const decks = [...new Set(cards.map((card) => card.deck ?? "Ogólne"))];
  const exportCards =
    exportDeck === "all"
      ? cards
      : cards.filter((card) => (card.deck ?? "Ogólne") === exportDeck);

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const limit = extension === "apkg" ? 40_000_000 : 8_000_000;
    if (file.size > limit) {
      setMessage(`Plik jest większy niż ${limit / 1_000_000} MB.`);
      return;
    }
    if (extension === "apkg") {
      setLoadingFile(true);
      setMessage("Odczytywanie bazy i multimediów Anki…");
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/import/anki", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          body,
        });
        const data = (await response.json().catch(() => ({}))) as {
          cards?: ImportedCard[];
          error?: string;
          skipped?: number;
          mediaIncluded?: number;
        };
        if (!response.ok || !data.cards) throw new Error(data.error ?? "Nie udało się odczytać paczki Anki");
        setAnkiCards(data.cards);
        setText("");
        setFormat("auto");
        setDeck(file.name.replace(/\.[^.]+$/, ""));
        setTags("import, anki");
        setMessage(`Wczytano ${data.cards.length} kart Anki · multimedia: ${data.mediaIncluded ?? 0} · pominięto: ${data.skipped ?? 0}.`);
      } catch (error) {
        setAnkiCards(null);
        setMessage(error instanceof Error ? error.message : "Nie udało się odczytać Anki");
      } finally {
        setLoadingFile(false);
        event.target.value = "";
      }
      return;
    }
    const nextFormat: FlashcardImportFormat =
      extension === "json"
        ? "json"
        : extension === "csv"
          ? "csv"
          : extension === "tsv"
            ? "tsv"
            : extension === "md" || extension === "markdown"
              ? "markdown"
              : "auto";
    setText(await file.text());
    setAnkiCards(null);
    setFormat(nextFormat);
    setDeck(file.name.replace(/\.[^.]+$/, ""));
    setMessage(`Wczytano ${file.name}.`);
    event.target.value = "";
  }

  function importNow() {
    if (!fresh.length) {
      setMessage(
        parsed.length
          ? "Wszystkie wykryte karty już istnieją."
          : "Nie znaleziono par pytanie–odpowiedź.",
      );
      return;
    }
    const now = new Date().toISOString();
    const commonTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const imported = fresh.flatMap<Flashcard>((card) => {
      const base: Flashcard = {
        id: createId(),
        front: card.front,
        back: card.back,
        subjectId: subjectId || undefined,
        dueAt: now,
        intervalDays: 0,
        ease: 2.5,
        repetitions: 0,
        deck: (card.deck ?? deck.trim()) || "Importowana talia",
        tags: [...new Set([...commonTags, ...(card.tags ?? [])])],
        createdAt: now,
        lapses: 0,
        correctStreak: 0,
        kind: card.kind ?? "text",
        frontMedia: card.frontMedia,
        backMedia: card.backMedia,
        choices: card.choices,
        correctChoice: card.correctChoice,
        updatedAt: now,
        source: ankiCards ? "anki" : format === "quizlet" ? "quizlet" : "file",
      };
      return reverse
        ? [
            base,
            {
              ...base,
              id: createId(),
              front: base.back,
              back: base.front,
              tags: [...(base.tags ?? []), "rewers"],
            },
          ]
        : [base];
    });
    onImport(imported);
    setMessage(`Dodano ${imported.length} kart. Duplikaty zostały pominięte.`);
    setText("");
    setAnkiCards(null);
  }

  function download() {
    if (!exportCards.length) return;
    const payload = exportFlashcards(exportCards, exportFormat);
    const extension = exportFormat === "quizlet" ? "txt" : exportFormat;
    const type =
      exportFormat === "json"
        ? "application/json"
        : exportFormat === "csv"
          ? "text/csv"
          : "text/plain";
    const url = URL.createObjectURL(
      new Blob([payload], { type: `${type};charset=utf-8` }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `focus-os-flashcards.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Wyeksportowano ${exportCards.length} kart.`);
  }

  async function copyQuizlet() {
    await navigator.clipboard.writeText(
      exportFlashcards(exportCards, "quizlet"),
    );
    setMessage("Format Quizlet skopiowany do schowka.");
  }

  return (
    <Modal
      title="Import i eksport inteligentnych fiszek"
      onClose={onClose}
      wide
    >
      <nav className="exchange-tabs">
        <button
          className={tab === "import" ? "active" : ""}
          onClick={() => setTab("import")}
        >
          <Import size={16} />
          Importuj
        </button>
        <button
          className={tab === "export" ? "active" : ""}
          onClick={() => setTab("export")}
        >
          <Download size={16} />
          Eksportuj
        </button>
      </nav>
      {tab === "import" ? (
        <div className="exchange-layout">
          <section className="exchange-source">
            <div className="import-drop">
              <input
                hidden
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,.csv,.tsv,.json,.apkg"
                onChange={loadFile}
              />
              <button
                className="button button-secondary"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={17} />
                {loadingFile ? "Odczytywanie…" : "Wybierz plik"}
              </button>
              <span>Quizlet · CSV · TSV · JSON · Markdown · Anki APKG</span>
            </div>
            <label>
              Format
              <select
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as FlashcardImportFormat)
                }
              >
                <option value="auto">Wykryj automatycznie</option>
                <option value="quizlet">Quizlet / tabulator</option>
                <option value="csv">CSV</option>
                <option value="tsv">TSV</option>
                <option value="json">JSON</option>
                <option value="markdown">Markdown Q:/A:</option>
              </select>
            </label>
            <label>
              Wklej eksport Quizleta lub treść pliku
              <textarea
                value={text}
                onChange={(event) => {
                  setAnkiCards(null);
                  setText(event.target.value);
                }}
                placeholder={
                  "photosynthesis\tprocess using light\nmitosis\tcell division"
                }
              />
            </label>
            <div className="parse-status">
              <RefreshCcw size={15} />
              <span>
                Wykryto <strong>{parsed.length}</strong> · nowych{" "}
                <strong>{fresh.length}</strong> · duplikatów{" "}
                <strong>{parsed.length - fresh.length}</strong>
              </span>
            </div>
          </section>
          <section className="exchange-options">
            <label>
              Nazwa talii
              <input
                value={deck}
                onChange={(event) => setDeck(event.target.value)}
              />
            </label>
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
              Wspólne tagi
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="quizlet, biologia"
              />
            </label>
            <label className="switch-row">
              <span>
                <strong>Utwórz karty odwrotne</strong>
                <small>Definicja stanie się drugim pytaniem.</small>
              </span>
              <input
                type="checkbox"
                checked={reverse}
                onChange={(event) => setReverse(event.target.checked)}
              />
            </label>
            <div className="import-preview">
              <strong>Podgląd</strong>
              {fresh.slice(0, 4).map((card, index) => (
                <div key={`${card.front}-${index}`}>
                  <span>{card.front}</span>
                  <small>{card.back}</small>
                </div>
              ))}
              {fresh.length > 4 ? (
                <em>+ {fresh.length - 4} kolejnych</em>
              ) : null}
            </div>
            <button
              className="button button-primary button-large"
              onClick={importNow}
              disabled={!fresh.length}
            >
              <Import size={17} />
              Importuj {fresh.length}
              {reverse ? ` × 2` : ""} kart
            </button>
          </section>
        </div>
      ) : (
        <div className="export-panel">
          <div className="export-illustration">
            {exportFormat === "json" ? (
              <FileJson size={28} />
            ) : (
              <FileSpreadsheet size={28} />
            )}
          </div>
          <div>
            <h3>Przenieś talię bez utraty treści</h3>
            <p>
              Quizlet używa par rozdzielonych tabulatorem. JSON zachowuje także
              talie i tagi.
            </p>
          </div>
          <div className="export-controls">
            <label>
              Zakres
              <select
                value={exportDeck}
                onChange={(event) => setExportDeck(event.target.value)}
              >
                <option value="all">Wszystkie talie ({cards.length})</option>
                {decks.map((name) => (
                  <option value={name} key={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Format
              <select
                value={exportFormat}
                onChange={(event) =>
                  setExportFormat(event.target.value as typeof exportFormat)
                }
              >
                <option value="quizlet">Quizlet TXT</option>
                <option value="csv">CSV</option>
                <option value="tsv">TSV</option>
                <option value="json">Focus OS JSON</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button
              className="button button-quiet"
              disabled={!exportCards.length}
              onClick={copyQuizlet}
            >
              <Clipboard size={16} />
              Kopiuj dla Quizleta
            </button>
            <button
              className="button button-primary"
              disabled={!exportCards.length}
              onClick={download}
            >
              <Download size={16} />
              Pobierz {exportCards.length} kart
            </button>
          </div>
        </div>
      )}
      {message ? (
        <p className="exchange-message">
          <Check size={15} />
          {message}
        </p>
      ) : null}
    </Modal>
  );
}
