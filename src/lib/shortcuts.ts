import type { ShortcutLink, ViewId } from "@/lib/types";

const VIEW_LABELS: Record<ViewId, string> = {
  home: "Dzisiaj",
  tasks: "Zadania",
  focus: "Focus",
  learn: "Nauka",
  planner: "Planer",
  more: "Ustawienia",
};

/** Accepts user-friendly domains while rejecting script and local file URLs. */
export function normalizeWebUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function shortcutCaption(shortcut: ShortcutLink) {
  if (shortcut.category?.trim()) return shortcut.category.trim();
  return shortcut.kind === "url"
    ? "Strona WWW"
    : VIEW_LABELS[shortcut.view ?? "home"];
}

export function shortcutViewLabel(view: ViewId) {
  return VIEW_LABELS[view];
}
