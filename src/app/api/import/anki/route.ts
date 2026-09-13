import "server-only";

import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import type { ImportedCard } from "@/lib/flashcard-io";
import type { MediaAttachment } from "@/lib/types";

const MAX_ARCHIVE_BYTES = 40_000_000;
const MAX_MEDIA_BYTES = 500_000;
const MAX_EMBEDDED_MEDIA_BYTES = 4_000_000;

type NoteRow = {
  id: number;
  flds: string;
  tags: string;
  did: number | null;
};

export async function POST(request: Request) {
  let temporaryDirectory = "";
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "anki-import", { limit: 20, windowMs: 60_000 });
    if (!(await getSession())) {
      return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Nie wybrano pliku Anki" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_ARCHIVE_BYTES) {
      return Response.json(
        { error: "Paczka Anki może mieć maksymalnie 40 MB" },
        { status: 413 },
      );
    }

    const archive = new Uint8Array(await file.arrayBuffer());
    const extracted = unzipSync(archive, {
      filter: (entry) =>
        entry.originalSize <= 150_000_000 &&
        (entry.name === "collection.anki2" ||
          entry.name === "collection.anki21" ||
          entry.name === "collection.anki21b" ||
          entry.name === "media" ||
          (/^\d+$/.test(entry.name) && entry.originalSize <= MAX_MEDIA_BYTES)),
    });
    const collection =
      extracted["collection.anki21"] ??
      extracted["collection.anki2"] ??
      extracted["collection.anki21b"];
    if (!collection) {
      return Response.json(
        { error: "Paczka nie zawiera obsługiwanej bazy Anki" },
        { status: 422 },
      );
    }

    temporaryDirectory = mkdtempSync(join(tmpdir(), "focus-os-anki-"));
    const databasePath = join(temporaryDirectory, "collection.sqlite");
    writeFileSync(databasePath, collection);
    const database = new Database(databasePath, { readonly: true });
    let notes: NoteRow[] = [];
    let decks: Record<string, { name?: string }> = {};
    try {
      notes = database
        .prepare(
          `SELECT n.id, n.flds, n.tags, MIN(c.did) AS did
           FROM notes n LEFT JOIN cards c ON c.nid = n.id
           GROUP BY n.id ORDER BY n.id LIMIT 20000`,
        )
        .all() as NoteRow[];
      const collectionRow = database
        .prepare("SELECT decks FROM col LIMIT 1")
        .get() as { decks?: string } | undefined;
      if (collectionRow?.decks) decks = JSON.parse(collectionRow.decks) as typeof decks;
    } finally {
      database.close();
    }

    const mediaMap = readMediaMap(extracted.media);
    let embeddedMediaBytes = 0;
    const cards = notes.flatMap<ImportedCard>((note) => {
      const fields = note.flds.split("\u001f").map(cleanAnkiField);
      const frontRaw = note.flds.split("\u001f")[0] ?? "";
      const backRaw = note.flds.split("\u001f")[1] ?? "";
      const front = fields[0]?.trim();
      const back = fields[1]?.trim();
      if (!front || !back) return [];
      const frontMedia = attachmentFromField(frontRaw, extracted, mediaMap);
      const backMedia = attachmentFromField(backRaw, extracted, mediaMap);
      const acceptedFront = acceptMedia(frontMedia);
      const acceptedBack = acceptMedia(backMedia);
      const tags = note.tags.trim().split(/\s+/).filter(Boolean);
      return [{
        front,
        back,
        deck: decks[String(note.did)]?.name?.replace(/::/g, " / ") ?? "Import Anki",
        tags: ["anki", ...tags],
        kind: acceptedFront?.mimeType.startsWith("audio/")
          ? "audio"
          : acceptedFront || acceptedBack
            ? "image"
            : "text",
        frontMedia: acceptedFront,
        backMedia: acceptedBack,
      }];

      function acceptMedia(media?: MediaAttachment & { byteLength: number }) {
        if (!media || embeddedMediaBytes + media.byteLength > MAX_EMBEDDED_MEDIA_BYTES)
          return undefined;
        embeddedMediaBytes += media.byteLength;
        const { byteLength: _byteLength, ...attachment } = media;
        return attachment;
      }
    });

    return Response.json(
      {
        cards,
        skipped: Math.max(0, notes.length - cards.length),
        mediaIncluded: cards.filter((card) => card.frontMedia || card.backMedia).length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  } finally {
    if (temporaryDirectory) {
      const safeRoot = resolve(tmpdir());
      const safeTarget = resolve(/* turbopackIgnore: true */ temporaryDirectory);
      if (safeTarget.startsWith(`${safeRoot}\\`) || safeTarget.startsWith(`${safeRoot}/`)) {
        rmSync(safeTarget, { recursive: true, force: true });
      }
    }
  }
}

function readMediaMap(source?: Uint8Array) {
  if (!source) return {} as Record<string, string>;
  try {
    return JSON.parse(strFromU8(source)) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

function cleanAnkiField(value: string) {
  return value
    .replace(/\[sound:[^\]]+]/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/{{c\d+::(.*?)(?:::[^}]*)?}}/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function attachmentFromField(
  field: string,
  extracted: Record<string, Uint8Array>,
  mediaMap: Record<string, string>,
) {
  const soundName = field.match(/\[sound:([^\]]+)]/i)?.[1];
  const imageName = field.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const wanted = soundName ?? imageName;
  if (!wanted) return undefined;
  const mediaEntry = Object.entries(mediaMap).find(([, name]) => name === wanted);
  if (!mediaEntry) return undefined;
  const bytes = extracted[mediaEntry[0]];
  if (!bytes || bytes.byteLength > MAX_MEDIA_BYTES) return undefined;
  const mimeType = mimeFromName(wanted);
  return {
    name: wanted,
    mimeType,
    dataUrl: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
    byteLength: bytes.byteLength,
  };
}

function mimeFromName(name: string) {
  switch (extname(name).toLowerCase()) {
    case ".png": return "image/png";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".svg": return "image/svg+xml";
    case ".mp3": return "audio/mpeg";
    case ".ogg": return "audio/ogg";
    case ".wav": return "audio/wav";
    default: return "image/jpeg";
  }
}
