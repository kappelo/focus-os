import type { Flashcard, MediaAttachment } from "@/lib/types";
import { memoryProbability } from "@/lib/fsrs";

export type FlashcardImportFormat = "auto" | "quizlet" | "csv" | "tsv" | "json" | "markdown";
export type ImportedCard = {
  front: string;
  back: string;
  deck?: string;
  tags?: string[];
  kind?: Flashcard["kind"];
  frontMedia?: MediaAttachment;
  backMedia?: MediaAttachment;
  choices?: string[];
  correctChoice?: number;
};

export function parseFlashcards(text: string, format: FlashcardImportFormat = "auto"): ImportedCard[] {
  const source = text.replace(/^\uFEFF/, "").trim();
  if (!source) return [];
  const resolved = format === "auto" ? detectFormat(source) : format;
  let cards: ImportedCard[] = [];

  if (resolved === "json") {
    try {
      const parsed = JSON.parse(source) as unknown;
      const rows = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && "cards" in parsed ? (parsed as { cards: unknown[] }).cards : [];
      cards = rows.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        const front = String(item.front ?? item.term ?? item.question ?? "").trim();
        const back = String(item.back ?? item.definition ?? item.answer ?? "").trim();
        const deck = String(item.deck ?? "").trim() || undefined;
        const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
        const kind = ["text", "image", "audio", "multiple-choice"].includes(String(item.kind))
          ? (String(item.kind) as Flashcard["kind"])
          : undefined;
        const choices = Array.isArray(item.choices) ? item.choices.map(String) : undefined;
        const correctChoice = Number.isInteger(item.correctChoice) ? Number(item.correctChoice) : undefined;
        return front && back
          ? [{
              front,
              back,
              deck,
              tags,
              kind,
              choices,
              correctChoice,
              frontMedia: validMedia(item.frontMedia),
              backMedia: validMedia(item.backMedia),
            }]
          : [];
      });
    } catch {
      return [];
    }
  } else if (resolved === "markdown") {
    const qa = [...source.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:Q|Pytanie)\s*:\s*([\s\S]+?)\s*\n\s*(?:[-*]\s*)?(?:A|Odpowiedź)\s*:\s*([\s\S]+?)(?=\n\s*(?:[-*]\s*)?(?:Q|Pytanie)\s*:|$)/gi)];
    cards = qa.map((match) => ({ front: match[1].trim(), back: match[2].trim() }));
    if (!cards.length) cards = parseDelimited(source, "::");
  } else {
    const delimiter = resolved === "csv" ? "," : "\t";
    cards = parseDelimited(source, delimiter);
    if (!cards.length && resolved === "quizlet") cards = parseDelimited(source, ";");
    if (!cards.length && resolved === "quizlet") cards = parseDelimited(source, "::");
  }

  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.front.toLocaleLowerCase("pl")}\u0000${card.back.toLocaleLowerCase("pl")}`;
    if (!card.front || !card.back || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function smartReviewQueue(cards: Flashcard[], now = Date.now(), limit = 50) {
  const subjectBuckets = new Map<string, Flashcard[]>();
  for (const card of cards) {
    if (card.suspended) continue;
    if (new Date(card.dueAt).getTime() > now) continue;
    const bucket = card.subjectId ?? "general";
    const entries = subjectBuckets.get(bucket) ?? [];
    entries.push(card);
    subjectBuckets.set(bucket, entries);
  }
  for (const entries of subjectBuckets.values()) {
    entries.sort((a, b) => smartPriority(b, now) - smartPriority(a, now));
  }
  const result: Flashcard[] = [];
  const buckets = [...subjectBuckets.values()];
  while (result.length < limit && buckets.some((bucket) => bucket.length)) {
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (next) result.push(next);
      if (result.length >= limit) break;
    }
  }
  return result;
}

export function exportFlashcards(cards: Flashcard[], format: Exclude<FlashcardImportFormat, "auto" | "markdown">) {
  if (format === "json") return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), cards: cards.map((card) => ({ front: card.front, back: card.back, deck: card.deck ?? "Ogólne", tags: card.tags ?? [], kind: card.kind ?? "text", frontMedia: card.frontMedia, backMedia: card.backMedia, choices: card.choices, correctChoice: card.correctChoice })) }, null, 2);
  if (format === "quizlet") return cards.map((card) => [card.front, card.back].map((value) => escapeCell(value, "\t")).join("\t")).join("\n");
  const delimiter = format === "csv" ? "," : "\t";
  const rows = cards.map((card) => [card.front, card.back, card.deck ?? "Ogólne", (card.tags ?? []).join("|")].map((value) => escapeCell(value, delimiter)).join(delimiter));
  return [["front", "back", "deck", "tags"].join(delimiter), ...rows].join("\n");
}

export function retentionEstimate(card: Flashcard, now = Date.now()) {
  return Math.round(Math.max(1, Math.min(99, memoryProbability(card, now) * 100)));
}

function smartPriority(card: Flashcard, now: number) {
  const overdueDays = Math.max(0, (now - new Date(card.dueAt).getTime()) / 86_400_000);
  return overdueDays * 5 + (card.lapses ?? 0) * 8 + (3 - card.ease) * 10 - (card.correctStreak ?? 0) * 2;
}

function detectFormat(source: string): Exclude<FlashcardImportFormat, "auto"> {
  if (source.startsWith("[") || source.startsWith("{")) return "json";
  if (/^(?:[-*]\s*)?(?:Q|Pytanie)\s*:/im.test(source)) return "markdown";
  if (source.includes("\t")) return "quizlet";
  if (source.split("\n")[0]?.includes(",")) return "csv";
  return "quizlet";
}

function parseDelimited(source: string, delimiter: string): ImportedCard[] {
  return source.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    const cells = delimiter.length === 1 ? parseCsvLine(line, delimiter) : line.split(delimiter);
    if (index === 0 && /^(front|term|question)$/i.test(cells[0]?.trim() ?? "")) return [];
    const front = cells[0]?.trim() ?? "";
    const back = cells[1]?.trim() ?? "";
    const deck = cells[2]?.trim() || undefined;
    const tags = cells[3]?.split(/[|#]/).map((tag) => tag.trim()).filter(Boolean);
    return front && back ? [{ front, back, deck, tags }] : [];
  });
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(value); value = ""; }
    else value += char;
  }
  cells.push(value);
  return cells;
}

function escapeCell(value: string, delimiter: string) {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function validMedia(value: unknown): MediaAttachment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<MediaAttachment>;
  return typeof item.name === "string" &&
    typeof item.mimeType === "string" &&
    typeof item.dataUrl === "string" &&
    item.dataUrl.startsWith("data:")
    ? { name: item.name, mimeType: item.mimeType, dataUrl: item.dataUrl }
    : undefined;
}
