"use client";

import { useState } from "react";
import type { ExerciseInput, SavedExercise } from "@/types/domain";

type ExerciseLibraryProps = {
  exercises: SavedExercise[];
  totalCount: number;
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  languageFilter: string;
  languageOptions: string[];
  onLanguageFilter: (lang: string) => void;
  onSelectForGrading: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddExercise: () => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function ExerciseLibrary({
  exercises,
  totalCount,
  selectedId,
  searchQuery,
  onSearchChange,
  languageFilter,
  languageOptions,
  onLanguageFilter,
  onSelectForGrading,
  onEdit,
  onDelete,
  onAddExercise,
}: ExerciseLibraryProps) {
  const [preview, setPreview] = useState<SavedExercise | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight app-text">
          📚 Exercise library
        </h2>
        <p className="mt-1 text-sm app-text-secondary">
          Build rubrics, save them as cards, then choose one to collect submissions.{" "}
          <span className="font-medium app-text">✨</span> Hover a card for actions.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="flex min-w-[200px] max-w-md flex-1 items-center gap-2 rounded-xl border border-app app-surface px-3 py-2 shadow-sm ring-[var(--theme-ring)]/30 focus-within:border-[var(--theme-primary)] focus-within:ring-2">
          <span className="text-lg" aria-hidden>
            🔎
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title, language, criteria…"
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-[var(--theme-text-subtle)]"
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium app-text-muted">🏷️ Filter</span>
          <select
            value={languageFilter}
            onChange={(e) => onLanguageFilter(e.target.value)}
            className="rounded-xl border border-app app-surface px-3 py-2 text-sm shadow-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
          >
            <option value="all">All languages</option>
            {languageOptions.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-app app-bg-subtle px-6 py-16 text-center">
          <p className="text-4xl">🎯</p>
          <p className="mt-3 text-lg font-semibold app-text">No exercises yet</p>
          <p className="mt-1 text-sm app-text-secondary">
            Click the card with the plus to create your first assignment and rubric.
          </p>
        </div>
      ) : exercises.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          🔍 No exercises match your search or filter. Try clearing the search or pick “All
          languages”.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {exercises.map((ex) => {
          const isSelected = selectedId === ex.id;
          const pts = ex.data.maxPoints;
          const critCount = ex.data.rubric.criteria.length;
          return (
            <li key={ex.id} className="group relative">
              <div
                className={`relative flex h-full min-h-[160px] flex-col overflow-hidden rounded-2xl border border-app app-surface p-4 shadow-sm transition-all duration-200 ${
                  isSelected
                    ? "border-[var(--theme-primary)] ring-2 ring-[var(--theme-ring)]/40"
                    : "hover:border-[var(--theme-primary)]/45"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--theme-primary-muted)]/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-base font-semibold app-text">
                      {ex.data.title || "Untitled"}
                    </h3>
                    <span className="shrink-0 rounded-full app-bg-subtle px-2 py-0.5 text-[11px] font-medium app-text-secondary">
                      {pts} pts
                    </span>
                  </div>
                  <p className="mt-2 text-xs app-text-muted">
                    💻 {ex.data.language} · {critCount} criteria · {formatDate(ex.createdAt)}
                  </p>
                </div>

                <div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-900/75 opacity-0 backdrop-blur-[2px] transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100"
                >
                  <div className="flex flex-wrap justify-center gap-2 px-3">
                    <button
                      type="button"
                      onClick={() => onEdit(ex.id)}
                      className="rounded-lg app-surface px-3 py-1.5 text-xs font-semibold app-text shadow hover:bg-[var(--theme-bg-subtle)]"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectForGrading(ex.id);
                      }}
                      className="btn-theme-primary rounded-lg px-3 py-1.5 text-xs font-semibold shadow"
                    >
                      📤 Submit here
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreview(ex)}
                      className="rounded-lg app-surface px-3 py-1.5 text-xs font-semibold app-text shadow hover:bg-[var(--theme-bg-subtle)]"
                    >
                      👁️ Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          window.confirm("Delete this exercise from the library?")
                        ) {
                          onDelete(ex.id);
                        }
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={onAddExercise}
            className="group flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-app app-input-bg app-text-muted transition-all hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-muted)]/50 hover:text-[var(--theme-primary)] hover:shadow-md"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-current text-3xl transition-transform group-hover:scale-110">
              +
            </span>
            <span className="text-sm font-semibold">New exercise</span>
            <span className="text-xs app-text-subtle group-hover:text-[var(--theme-text-secondary)]">
              Add title, rubric & criteria
            </span>
          </button>
        </li>
      </ul>

      {preview ? (
        <ExercisePreviewModal exercise={preview.data} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}

function ExercisePreviewModal({
  exercise,
  onClose,
}: {
  exercise: ExerciseInput;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="preview-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-app app-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="preview-title" className="text-lg font-bold app-text">
            👁️ {exercise.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-app px-2 py-1 text-sm app-text-secondary hover:bg-[var(--theme-bg-subtle)]"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm app-text-secondary">
          {exercise.language} · {exercise.maxPoints} points total
        </p>
        <h3 className="mt-4 text-xs font-bold uppercase tracking-wide app-text-muted">Conventions</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm app-text">{exercise.rubric.conventions}</p>
        <h3 className="mt-4 text-xs font-bold uppercase tracking-wide app-text-muted">Criteria</h3>
        <ul className="mt-2 space-y-2">
          {exercise.rubric.criteria.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-app app-bg-subtle px-3 py-2 text-sm"
            >
              <span className="font-medium app-text">{c.label}</span>{" "}
              <span className="app-text-muted">({c.maxPoints} pts)</span>
              <p className="mt-1 text-xs app-text-secondary">{c.guidance}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
