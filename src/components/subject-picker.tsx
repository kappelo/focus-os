"use client";

import { useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { createId } from "@/lib/ids";
import type { Subject } from "@/lib/types";

const SUBJECT_COLORS = [
  "#65724b",
  "#3f6fe8",
  "#7c4dcc",
  "#d64d96",
  "#d94b67",
  "#cf6d2f",
  "#16877d",
  "#167caa",
];

export function SubjectPicker({
  subjects,
  value,
  onChange,
  onCreate,
  emptyLabel = "Bez przedmiotu",
}: {
  subjects: Subject[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (subject: Subject) => void;
  emptyLabel?: string;
}) {
  const nameId = useId();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [topics, setTopics] = useState("");
  const [color, setColor] = useState(SUBJECT_COLORS[1]);
  const duplicate = subjects.some(
    (subject) =>
      subject.name.toLocaleLowerCase("pl") ===
      name.trim().toLocaleLowerCase("pl"),
  );

  function createSubject() {
    if (!name.trim() || duplicate) return;
    const subject: Subject = {
      id: createId(),
      name: name.trim(),
      color,
      mastery: 0,
      topics: topics
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean)
        .map((topic) => ({ id: createId(), name: topic, mastery: 0 })),
    };
    onCreate(subject);
    onChange(subject.id);
    setName("");
    setTopics("");
    setCreating(false);
  }

  return (
    <div className="subject-picker">
      <div className="subject-picker-control">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{emptyLabel}</option>
          {subjects.map((subject) => (
            <option value={subject.id} key={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="subject-create-trigger"
          aria-expanded={creating}
          aria-controls={`${nameId}-creator`}
          onClick={() => setCreating((current) => !current)}
        >
          {creating ? <X size={16} /> : <Plus size={16} />}
          {creating ? "Zamknij" : "Nowy"}
        </button>
      </div>
      {creating ? (
        <div className="quick-subject-creator" id={`${nameId}-creator`}>
          <div className="quick-subject-heading">
            <strong>Nowy przedmiot</strong>
            <small>Od razu przypisz go do tego elementu.</small>
          </div>
          <label htmlFor={nameId}>
            Nazwa
            <input
              id={nameId}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  createSubject();
                }
              }}
              placeholder="np. Biologia"
            />
          </label>
          <label>
            Tematy
            <input
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
              placeholder="Genetyka, ekologia…"
            />
          </label>
          <div className="quick-subject-colors" aria-label="Kolor przedmiotu">
            {SUBJECT_COLORS.map((option) => (
              <button
                type="button"
                key={option}
                className={color === option ? "active" : ""}
                style={{ background: option }}
                aria-label={`Wybierz kolor ${option}`}
                onClick={() => setColor(option)}
              >
                {color === option ? <Check size={13} /> : null}
              </button>
            ))}
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Własny kolor przedmiotu"
            />
          </div>
          {duplicate ? (
            <small className="form-error">
              Przedmiot o tej nazwie już istnieje.
            </small>
          ) : null}
          <button
            type="button"
            className="button button-primary quick-subject-submit"
            disabled={!name.trim() || duplicate}
            onClick={createSubject}
          >
            <Plus size={16} /> Dodaj i wybierz
          </button>
        </div>
      ) : null}
    </div>
  );
}
