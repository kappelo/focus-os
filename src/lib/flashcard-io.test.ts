import { describe, expect, it } from "vitest";
import { exportFlashcards, parseFlashcards, retentionEstimate, smartReviewQueue } from "@/lib/flashcard-io";
import type { Flashcard } from "@/lib/types";

const card = (changes: Partial<Flashcard>): Flashcard => ({ id: crypto.randomUUID(), front: "term", back: "definition", dueAt: new Date(0).toISOString(), intervalDays: 3, ease: 2.5, repetitions: 2, ...changes });

describe("flashcard import and intelligence", () => {
  it("imports Quizlet tab-separated exports and removes duplicates", () => {
    const result = parseFlashcards("cat\tkot\ndog\tpies\ncat\tkot", "quizlet");
    expect(result).toEqual([{ front: "cat", back: "kot" }, { front: "dog", back: "pies" }]);
  });

  it("supports JSON aliases used by common exporters", () => {
    expect(parseFlashcards('[{"term":"ATP","definition":"nośnik energii"}]', "json")[0]).toMatchObject({ front: "ATP", back: "nośnik energii" });
  });

  it("imports Markdown question and answer blocks", () => {
    expect(parseFlashcards("Q: Co to jest RNA?\nA: Kwas rybonukleinowy\n\nPytanie: Ile boków ma trójkąt?\nOdpowiedź: Trzy", "markdown")).toHaveLength(2);
  });

  it("round-trips quoted CSV values", () => {
    const source = card({ front: "Hello, world", back: "Powitanie \"świata\"", deck: "English" });
    const exported = exportFlashcards([source], "csv");
    expect(parseFlashcards(exported, "csv")[0]).toMatchObject({ front: source.front, back: source.back });
  });

  it("round-trips TSV deck and tags while Quizlet stays two-column", () => {
    const source = card({ front: "ATP", back: "Energia", deck: "Biologia", tags: ["komórka", "matura"] });
    expect(parseFlashcards(exportFlashcards([source], "tsv"), "tsv")[0]).toMatchObject({ deck: "Biologia", tags: ["komórka", "matura"] });
    expect(exportFlashcards([source], "quizlet").split("\t")).toHaveLength(2);
  });

  it("interleaves due subjects and prioritizes leeches", () => {
    const queue = smartReviewQueue([card({ id: "a", subjectId: "math", lapses: 0 }), card({ id: "b", subjectId: "math", lapses: 4 }), card({ id: "c", subjectId: "english" })], Date.now());
    expect(queue.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("returns a bounded retention estimate", () => {
    expect(retentionEstimate(card({ lastReviewedAt: new Date().toISOString() }))).toBeGreaterThan(90);
  });
});
