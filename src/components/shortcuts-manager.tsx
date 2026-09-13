"use client";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { createId } from "@/lib/ids";
import { normalizeWebUrl, shortcutViewLabel } from "@/lib/shortcuts";
import type { ShortcutLink, ViewId, WorkspaceState } from "@/lib/types";

const VIEWS: ViewId[] = ["home", "tasks", "focus", "learn", "planner", "more"];

export function ShortcutsManager({
  state,
  onUpdate,
}: {
  state: WorkspaceState;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const links = state.settings.shortcutLinks;

  function setLinks(shortcutLinks: ShortcutLink[]) {
    onUpdate((current) => ({
      ...current,
      settings: { ...current.settings, shortcutLinks },
    }));
  }

  function update(id: string, patch: Partial<ShortcutLink>) {
    setLinks(
      links.map((shortcut) =>
        shortcut.id === id ? { ...shortcut, ...patch } : shortcut,
      ),
    );
  }

  function add(kind: ShortcutLink["kind"]) {
    setLinks([
      ...links,
      {
        id: createId(),
        label: kind === "url" ? "Nowa strona" : "Nowy skrót",
        kind,
        view: "learn",
        url: "",
        category: kind === "url" ? "Materiały" : "Focus OS",
        openInNewTab: kind === "url",
        enabled: true,
      },
    ]);
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= links.length) return;
    const reordered = [...links];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    setLinks(reordered);
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">WŁASNY PANEL STARTOWY</p>
          <h1>Skróty</h1>
          <p>
            Dodawaj przejścia w Focus OS oraz bezpieczne linki do materiałów,
            słowników, kursów i szkolnych platform.
          </p>
        </div>
        <div className="button-group">
          <button className="button button-secondary" onClick={() => add("view")}>
            <Plus size={16} /> Ekran aplikacji
          </button>
          <button className="button button-primary" onClick={() => add("url")}>
            <Link2 size={16} /> Link do strony
          </button>
        </div>
      </section>

      <section className="panel shortcuts-settings-card">
        <div className="settings-group-heading">
          <div>
            <h2>Widoczność na stronie „Dzisiaj”</h2>
            <p>Możesz wyłączyć cały panel albo ograniczyć liczbę przycisków.</p>
          </div>
        </div>
        <div className="configuration-grid shortcut-general-settings">
          <label className="switch-row compact-switch">
            <span>
              <strong>Pokaż panel skrótów</strong>
              <small>Ukrywa panel bez usuwania zapisanych linków.</small>
            </span>
            <input
              type="checkbox"
              checked={state.settings.showDashboardShortcuts}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    showDashboardShortcuts: event.target.checked,
                  },
                }))
              }
            />
          </label>
          <label>
            Maksymalna liczba przycisków
            <input
              type="number"
              min="1"
              max="24"
              value={state.settings.dashboardShortcutLimit}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    dashboardShortcutLimit: Math.min(
                      24,
                      Math.max(1, Number(event.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="shortcut-manager-list" aria-label="Lista skrótów">
        {links.map((shortcut, index) => {
          const normalizedUrl =
            shortcut.kind === "url" ? normalizeWebUrl(shortcut.url ?? "") : null;
          const invalidUrl = shortcut.kind === "url" && Boolean(shortcut.url) && !normalizedUrl;
          return (
            <article className="panel shortcut-manager-card" key={shortcut.id}>
              <header>
                <span className="shortcut-number">{index + 1}</span>
                <div>
                  <strong>{shortcut.label || "Bez nazwy"}</strong>
                  <small>
                    {shortcut.kind === "url"
                      ? normalizedUrl?.replace(/^https?:\/\//, "") ?? "Uzupełnij adres"
                      : shortcutViewLabel(shortcut.view ?? "home")}
                  </small>
                </div>
                <label className="mini-check shortcut-enabled">
                  <input
                    type="checkbox"
                    checked={shortcut.enabled !== false}
                    onChange={(event) => update(shortcut.id, { enabled: event.target.checked })}
                  />
                  Aktywny
                </label>
              </header>

              <div className="shortcut-manager-fields">
                <label>
                  Nazwa przycisku
                  <input
                    value={shortcut.label}
                    maxLength={60}
                    onChange={(event) => update(shortcut.id, { label: event.target.value })}
                    placeholder="np. Słownik angielski"
                  />
                </label>
                <label>
                  Kategoria
                  <input
                    value={shortcut.category ?? ""}
                    maxLength={30}
                    onChange={(event) => update(shortcut.id, { category: event.target.value })}
                    placeholder="np. Języki"
                  />
                </label>
                <label>
                  Rodzaj
                  <select
                    value={shortcut.kind}
                    onChange={(event) =>
                      update(shortcut.id, {
                        kind: event.target.value as ShortcutLink["kind"],
                      })
                    }
                  >
                    <option value="view">Ekran Focus OS</option>
                    <option value="url">Strona WWW</option>
                  </select>
                </label>
                {shortcut.kind === "url" ? (
                  <label className="shortcut-target-field">
                    Adres strony
                    <input
                      value={shortcut.url ?? ""}
                      inputMode="url"
                      aria-invalid={invalidUrl}
                      onChange={(event) => update(shortcut.id, { url: event.target.value })}
                      onBlur={() => {
                        if (normalizedUrl) update(shortcut.id, { url: normalizedUrl });
                      }}
                      placeholder="https://wikipedia.org"
                    />
                    {invalidUrl ? (
                      <small className="field-error">Dozwolone są tylko adresy HTTP i HTTPS.</small>
                    ) : null}
                  </label>
                ) : (
                  <label className="shortcut-target-field">
                    Ekran docelowy
                    <select
                      value={shortcut.view ?? "home"}
                      onChange={(event) =>
                        update(shortcut.id, { view: event.target.value as ViewId })
                      }
                    >
                      {VIEWS.map((view) => (
                        <option value={view} key={view}>
                          {shortcutViewLabel(view)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <footer>
                {shortcut.kind === "url" ? (
                  <label className="mini-check">
                    <input
                      type="checkbox"
                      checked={shortcut.openInNewTab !== false}
                      onChange={(event) =>
                        update(shortcut.id, { openInNewTab: event.target.checked })
                      }
                    />
                    Otwieraj w nowej karcie
                  </label>
                ) : (
                  <span />
                )}
                <div className="shortcut-card-actions">
                  {normalizedUrl ? (
                    <a
                      className="button button-quiet"
                      href={normalizedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={15} /> Testuj
                    </a>
                  ) : null}
                  <button
                    className="icon-button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Przesuń skrót ${shortcut.label} w górę`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={index === links.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Przesuń skrót ${shortcut.label} w dół`}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    onClick={() => setLinks(links.filter((item) => item.id !== shortcut.id))}
                    aria-label={`Usuń skrót ${shortcut.label}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
        {!links.length ? (
          <div className="panel shortcut-empty">
            <Link2 size={28} />
            <h2>Nie masz jeszcze skrótów</h2>
            <p>Dodaj ekran aplikacji albo stronę, z której korzystasz podczas nauki.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
