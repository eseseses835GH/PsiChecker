"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { PRESET_LANGUAGES, isPresetLanguage } from "@/client/constants/languages";
import { useTheme, THEME_OPTIONS, type ThemeId } from "@/client/context/ThemeContext";
import { ExerciseLibrary } from "@/client/components/ExerciseLibrary";
import { GradingFunLoader } from "@/client/components/GradingFunLoader";
import { StudentDashboard } from "@/client/components/StudentDashboard";
import { useTeacherUploadFlow } from "@/client/hooks/useTeacherUploadFlow";
import type { ExerciseInput, RubricCriterionInput } from "@/types/domain";

type NavId = "dashboard" | "exercises" | "upload" | "results";

function updateCriterion(
  exercise: ExerciseInput,
  index: number,
  next: RubricCriterionInput,
): ExerciseInput {
  const criteria = [...exercise.rubric.criteria];
  criteria[index] = next;
  return {
    ...exercise,
    rubric: {
      ...exercise.rubric,
      criteria,
    },
  };
}

function addCriterion(exercise: ExerciseInput): ExerciseInput {
  const id = `criterion_${crypto.randomUUID()}`;
  return {
    ...exercise,
    rubric: {
      ...exercise.rubric,
      criteria: [
        ...exercise.rubric.criteria,
        {
          id,
          label: "New criterion",
          maxPoints: 1,
          guidance: "Describe what this criterion checks.",
        },
      ],
    },
  };
}

function removeCriterion(exercise: ExerciseInput, index: number): ExerciseInput {
  if (exercise.rubric.criteria.length <= 1) {
    return exercise;
  }
  return {
    ...exercise,
    rubric: {
      ...exercise.rubric,
      criteria: exercise.rubric.criteria.filter((_, i) => i !== index),
    },
  };
}

function SideNav({
  active,
  onSelect,
  canUseSubmissions,
}: {
  active: NavId;
  onSelect: (id: NavId) => void;
  canUseSubmissions: boolean;
}) {
  const items: { id: NavId; label: string; hint: string; emoji: string; needsExercise?: boolean }[] =
    [
      { id: "dashboard", label: "Students", hint: "Grades & activity", emoji: "👥" },
      { id: "exercises", label: "Exercises", hint: "Library & rubrics", emoji: "📚" },
      {
        id: "upload",
        label: "Submissions",
        hint: "Upload student work",
        emoji: "📤",
        needsExercise: true,
      },
      {
        id: "results",
        label: "Drafts",
        hint: "Latest AI grades",
        emoji: "📋",
        needsExercise: true,
      },
    ];

  return (
    <aside className="app-sidebar flex w-56 shrink-0 flex-col border-r border-app">
      <div className="border-b border-app px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider app-text-subtle">
          AutoGrade
        </p>
        <p className="mt-0.5 text-sm font-semibold app-text">🎓 Classroom</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {items.map((item) => {
          const blocked = item.needsExercise && !canUseSubmissions;
          const highlight = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={blocked}
              title={
                blocked
                  ? "Pick an exercise from the library first (use Submit here on a card)"
                  : undefined
              }
              onClick={() => {
                if (!blocked) {
                  onSelect(item.id);
                }
              }}
              className={`rounded-lg px-3 py-2.5 text-left transition-colors ${
                blocked
                  ? "cursor-not-allowed opacity-40"
                  : highlight
                    ? "surface-muted app-text"
                    : "app-text-secondary hover:bg-[var(--theme-input-bg)]"
              }`}
            >
              <span className="block text-sm font-medium">
                {item.emoji} {item.label}
              </span>
              <span className="block text-xs app-text-muted">{item.hint}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function RubricPane({
  exercise,
  onChange,
  canSubmit,
  onSubmit,
  onCancel,
  submitLabel,
  rubricCriteriaTotal,
  rubricPointsMatchExercise,
}: {
  exercise: ExerciseInput;
  onChange: (next: ExerciseInput) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  rubricCriteriaTotal: number;
  rubricPointsMatchExercise: boolean;
}) {
  const languageSelectValue = isPresetLanguage(exercise.language)
    ? exercise.language
    : "__other__";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold app-text">📝 Exercise & rubric</h2>
        <p className="mt-1 text-sm app-text-secondary">
          Add criteria and point weights; they are sent to the AI for grading. Criteria points must
          add up to the assignment max.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-app app-surface p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide app-text-muted">Assignment</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium app-text-secondary">Title</span>
              <input
                value={exercise.title}
                onChange={(e) => onChange({ ...exercise, title: e.target.value })}
                className="w-full rounded-lg border border-app app-input-bg px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium app-text-secondary">Language</span>
              <select
                value={languageSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__other__") {
                    onChange({ ...exercise, language: "" });
                  } else {
                    onChange({ ...exercise, language: v });
                  }
                }}
                className="w-full rounded-lg border border-app app-input-bg px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
              >
                {PRESET_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
                <option value="__other__">Other…</option>
              </select>
            </label>
            {languageSelectValue === "__other__" ? (
              <label className="space-y-1.5">
                <span className="text-xs font-medium app-text-secondary">Language name</span>
                <input
                  value={exercise.language}
                  onChange={(e) => onChange({ ...exercise, language: e.target.value })}
                  placeholder="e.g. Rust, Java, C++"
                  className="w-full rounded-lg border border-app app-input-bg px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
                />
              </label>
            ) : null}
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium app-text-secondary">Max points (assignment total)</span>
              <input
                type="number"
                min={1}
                value={exercise.maxPoints}
                onChange={(e) =>
                  onChange({ ...exercise, maxPoints: Number(e.target.value) })
                }
                className="w-full max-w-xs rounded-lg border border-app app-input-bg px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
              />
            </label>
          </div>
          <label className="mt-4 block space-y-1.5">
            <span className="text-xs font-medium app-text-secondary">Conventions</span>
            <textarea
              value={exercise.rubric.conventions}
              onChange={(e) =>
                onChange({
                  ...exercise,
                  rubric: { ...exercise.rubric, conventions: e.target.value },
                })
              }
              rows={5}
              className="w-full resize-y rounded-lg border border-app app-input-bg px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
            />
          </label>
        </section>

        <section className="rounded-xl border border-app app-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide app-text-muted">Criteria</h3>
            <button
              type="button"
              onClick={() => onChange(addCriterion(exercise))}
              className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                borderColor: "var(--theme-accent-soft)",
                backgroundColor: "var(--theme-primary-muted)",
                color: "var(--theme-primary)",
              }}
            >
              ➕ Add criterion
            </button>
          </div>

          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              rubricPointsMatchExercise
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
            role="status"
          >
            <span className="font-medium">⚖️ Points check: </span>
            Sum of criteria = <strong>{rubricCriteriaTotal}</strong> pts · Assignment max ={" "}
            <strong>{exercise.maxPoints}</strong> pts
            {rubricPointsMatchExercise ? (
              <span className="ml-1 text-emerald-800">— aligned ✓</span>
            ) : (
              <span className="ml-1 block sm:inline">
                — Adjust weights or assignment max until they match.
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {exercise.rubric.criteria.map((criterion, index) => (
              <div
                key={criterion.id}
                className="space-y-2 rounded-lg border border-app app-bg-subtle p-3"
              >
                <div className="flex gap-2">
                  <input
                    value={criterion.label}
                    onChange={(e) =>
                      onChange(
                        updateCriterion(exercise, index, {
                          ...criterion,
                          label: e.target.value,
                        }),
                      )
                    }
                    placeholder="Criterion name"
                    className="min-w-0 flex-1 rounded-md border border-app app-surface px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={exercise.rubric.criteria.length <= 1}
                    onClick={() => onChange(removeCriterion(exercise, index))}
                    className="shrink-0 rounded-md border border-app app-surface px-2 py-1.5 text-xs font-medium app-text-secondary hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Remove criterion"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1.5 text-xs app-text-secondary">
                    <span className="whitespace-nowrap">Max pts</span>
                    <input
                      type="number"
                      min={1}
                      value={criterion.maxPoints}
                      onChange={(e) =>
                        onChange(
                          updateCriterion(exercise, index, {
                            ...criterion,
                            maxPoints: Number(e.target.value),
                          }),
                        )
                      }
                      className="w-20 rounded-md border border-app app-surface px-2 py-1.5 text-sm"
                    />
                  </label>
                  <input
                    value={criterion.guidance}
                    onChange={(e) =>
                      onChange(
                        updateCriterion(exercise, index, {
                          ...criterion,
                          guidance: e.target.value,
                        }),
                      )
                    }
                    placeholder="What the AI should look for (sent to the model)"
                    className="min-w-[12rem] flex-1 rounded-md border border-app app-surface px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-app app-surface px-4 py-2.5 text-sm font-medium app-text-secondary shadow-sm hover:bg-[var(--theme-bg-subtle)] sm:w-auto"
          >
            Cancel
          </button>
        ) : null}
        {!canSubmit && exercise.rubric.criteria.length > 0 && !rubricPointsMatchExercise ? (
          <p className="mr-auto max-w-md text-left text-xs text-amber-800 sm:text-right">
            Fix the points mismatch so the sum equals the assignment max.
          </p>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="btn-theme-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function UploadPane({
  onUpload,
  uploading,
  grading,
  uploadMode,
  explicitStudentName,
  onModeChange,
  onStudentNameChange,
  llmUnavailableMessage,
  hasPendingLocalGrade,
  onRunLocalHeuristic,
  activeExerciseTitle,
}: {
  onUpload: (files: File[]) => Promise<boolean>;
  uploading: boolean;
  grading: boolean;
  uploadMode: "explicit" | "infer";
  explicitStudentName: string;
  onModeChange: (mode: "explicit" | "infer") => void;
  onStudentNameChange: (name: string) => void;
  llmUnavailableMessage: string | null;
  hasPendingLocalGrade: boolean;
  onRunLocalHeuristic: () => Promise<void>;
  activeExerciseTitle: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<{ files: File[]; fromFolder: boolean }>({
    files: [],
    fromFolder: false,
  });

  const files = bundle.files;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold app-text">📤 Submissions</h2>
        <p className="mt-1 text-sm app-text-secondary">
          Grading for:{" "}
          <strong className="app-text">{activeExerciseTitle}</strong>. Add files or a folder —
          paths are preserved for the AI.
        </p>
      </div>

      <section className="rounded-xl border border-app app-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold app-text">👤 Who is this upload for?</h3>
        <p className="mt-1 text-xs app-text-muted">
          Use a name or ID you recognize. It appears on the Students dashboard.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm app-text-secondary">
            <input
              type="radio"
              name="uploadMode"
              checked={uploadMode === "explicit"}
              onChange={() => onModeChange("explicit")}
              className="border-app"
              style={{ accentColor: "var(--theme-primary)" }}
            />
            One student
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm app-text-secondary">
            <input
              type="radio"
              name="uploadMode"
              checked={uploadMode === "infer"}
              onChange={() => onModeChange("infer")}
              className="border-app"
              style={{ accentColor: "var(--theme-primary)" }}
            />
            Infer from ZIP / file names
          </label>
        </div>

        {uploadMode === "explicit" ? (
          <label className="mt-4 block space-y-1.5">
            <span className="text-xs font-medium app-text-secondary">Student name or ID</span>
            <input
              value={explicitStudentName}
              onChange={(e) => onStudentNameChange(e.target.value)}
              placeholder="e.g. Dana Levy"
              className="w-full rounded-lg border border-app app-input-bg px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
            />
          </label>
        ) : (
          <p className="mt-4 rounded-lg app-bg-subtle px-3 py-2 text-xs app-text-secondary">
            For ZIPs: first folder segment is the student. Names like{" "}
            <code className="rounded app-bg-subtle px-1">student__main.ts</code> work too.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-app app-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold app-text">📁 Project files or folder</h3>
        <p className="mt-1 text-xs app-text-muted">
          Folders keep paths (e.g. <code className="rounded app-bg-subtle px-1">src/app/page.tsx</code>
          ).
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const next = Array.from(e.target.files ?? []);
            setBundle({ files: next, fromFolder: false });
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          {...({
            webkitdirectory: "",
            directory: "",
          } as Partial<ComponentProps<"input">>)}
          onChange={(e) => {
            const next = Array.from(e.target.files ?? []);
            setBundle({ files: next, fromFolder: true });
            e.target.value = "";
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-app app-surface px-4 py-2.5 text-sm font-medium app-text shadow-sm hover:bg-[var(--theme-bg-subtle)]"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm"
            style={{
              borderColor: "var(--theme-accent-soft)",
              backgroundColor: "var(--theme-primary-muted)",
              color: "var(--theme-primary)",
            }}
          >
            Choose folder
          </button>
        </div>

        <p className="mt-3 text-xs app-text-muted">
          {files.length === 0
            ? "No files selected yet."
            : bundle.fromFolder
              ? `${files.length} file(s) from folder — tree preserved 🌳`
              : `${files.length} file(s) selected`}
        </p>
        <button
          type="button"
          onClick={async () => {
            await onUpload(files);
          }}
          disabled={files.length === 0 || uploading || grading}
          className="btn-theme-primary mt-4 w-full rounded-lg py-2.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {uploading ? "Reading files…" : grading ? "Grading… ✨" : "Run draft grading"}
        </button>
      </section>

      {llmUnavailableMessage ? (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
          role="status"
        >
          <h3 className="text-sm font-semibold text-amber-950">🤖 AI grading unavailable</h3>
          <p className="mt-2 text-sm text-amber-900/90">{llmUnavailableMessage}</p>
          <p className="mt-3 text-xs text-amber-800/80">
            No score yet. You can still run a rough local estimate (not real AI).
          </p>
          <button
            type="button"
            disabled={!hasPendingLocalGrade || grading}
            onClick={() => {
              void onRunLocalHeuristic();
            }}
            className="mt-4 rounded-lg border border-amber-300 app-surface px-4 py-2.5 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grading ? "Working…" : "🔧 Use local heuristic estimate"}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function ResultsPane({
  drafts,
  importedCount,
  onBackToLibrary,
  onOpenDashboard,
  exerciseTitle,
}: {
  drafts: ReturnType<typeof useTeacherUploadFlow>["state"]["drafts"];
  importedCount: number;
  onBackToLibrary: () => void;
  onOpenDashboard: () => void;
  exerciseTitle: string;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold app-text">📋 Draft results</h2>
          <p className="mt-1 text-sm app-text-secondary">
            <span className="font-medium app-text">{exerciseTitle}</span> · {importedCount}{" "}
            submission(s). Full history under <strong>Students</strong> 👥
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="rounded-lg border border-app app-surface px-3 py-2 text-sm font-medium app-text-secondary shadow-sm hover:bg-[var(--theme-bg-subtle)]"
          >
            Open Students
          </button>
          <button
            type="button"
            onClick={onBackToLibrary}
            className="rounded-lg border border-app app-surface px-3 py-2 text-sm font-medium app-text-secondary shadow-sm hover:bg-[var(--theme-bg-subtle)]"
          >
            📚 Back to library
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-app app-surface px-4 py-10 text-center text-sm app-text-muted shadow-sm">
          No draft in this session yet. Upload under <strong>Submissions</strong> first.
        </p>
      ) : null}

      <ul className="space-y-3">
        {drafts.map((entry) => (
          <li
            key={entry.studentRef}
            className="rounded-xl border border-app app-surface p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium app-text">
                {entry.displayName ?? entry.studentRef}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                ⭐ {entry.draft.totalScore.toFixed(1)} pts
              </span>
            </div>
            {entry.gradingSource === "heuristic" ? (
              <p className="mt-2 text-xs font-medium text-amber-800">
                🔧 Local heuristic (no AI) — rough draft only.
              </p>
            ) : null}
            <p className="mt-2 text-sm app-text-secondary">{entry.draft.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.draft.criteria.map((c) => (
                <span
                  key={`${entry.studentRef}-${c.criterionId}`}
                  className="rounded-md app-bg-subtle px-2 py-1 text-xs app-text-secondary"
                >
                  {c.criterionId}: {c.points.toFixed(1)}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeacherIdeWorkspace() {
  const { theme, setTheme } = useTheme();
  const {
    state,
    aggregates,
    filteredExercises,
    uniqueLanguages,
    selectedExercise,
    canCommitExerciseForm,
    rubricCriteriaTotal,
    rubricPointsMatchExercise,
    updateExerciseFormDraft,
    openCreateExerciseForm,
    openEditExerciseForm,
    closeExerciseForm,
    commitExerciseForm,
    deleteExercise,
    selectExerciseForGrading,
    setExerciseSearchQuery,
    setExerciseLanguageFilter,
    goToStep,
    handleUploads,
    handleLocalHeuristicGrade,
    resetFlow,
    setUploadMode,
    setExplicitStudentName,
    clearStudentHistory,
  } = useTeacherUploadFlow();

  const [nav, setNav] = useState<NavId>("exercises");

  const busy = state.uploading || state.grading;
  useEffect(() => {
    document.body.style.overflow = busy ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [busy]);

  const canUseSubmissions = state.selectedExerciseId != null;

  function selectNav(id: NavId) {
    if ((id === "upload" || id === "results") && !canUseSubmissions) {
      return;
    }
    setNav(id);
    if (id === "upload") {
      goToStep("upload");
    }
    if (id === "results") {
      goToStep("results");
    }
  }

  const loaderPhase = state.uploading ? "reading" : state.grading ? "ai" : "idle";

  const activeTitle = selectedExercise?.data.title ?? "—";

  return (
    <main className="app-bg flex h-screen w-screen overflow-hidden antialiased">
      <GradingFunLoader phase={loaderPhase} />
      <SideNav active={nav} onSelect={selectNav} canUseSubmissions={canUseSubmissions} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-app px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-sm font-semibold app-text">✨ Teacher workspace</h1>
            <p className="text-xs app-text-muted">
              Library → pick exercise → submissions → drafts
              {canUseSubmissions ? (
                <>
                  {" "}
                  · Active: <strong className="app-text-secondary">{activeTitle}</strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(state.uploading || state.grading) && (
              <span
                className="rounded-full px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: "var(--theme-primary)" }}
              >
                {state.uploading ? "📂 Reading…" : "⚡ Grading…"}
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs font-medium app-text-secondary">
              <span>🎨</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeId)}
                className="app-input rounded-lg border px-2 py-1.5 text-xs shadow-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-ring)]/30"
              >
                {THEME_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {nav === "dashboard" && (
            <StudentDashboard
              records={state.studentRecords}
              aggregates={aggregates}
              isParsing={state.uploading}
              isGrading={state.grading}
              onClearHistory={clearStudentHistory}
            />
          )}

          {nav === "exercises" && (
            <ExerciseLibrary
              exercises={filteredExercises}
              totalCount={state.exercises.length}
              selectedId={state.selectedExerciseId}
              searchQuery={state.exerciseSearchQuery}
              onSearchChange={setExerciseSearchQuery}
              languageFilter={state.exerciseLanguageFilter}
              languageOptions={uniqueLanguages}
              onLanguageFilter={setExerciseLanguageFilter}
              onSelectForGrading={(id) => {
                selectExerciseForGrading(id);
                goToStep("upload");
                setNav("upload");
              }}
              onEdit={(id) => openEditExerciseForm(id)}
              onDelete={deleteExercise}
              onAddExercise={openCreateExerciseForm}
            />
          )}

          {nav === "upload" && !canUseSubmissions && (
            <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center shadow-sm">
              <p className="text-3xl">📌</p>
              <p className="mt-3 text-lg font-semibold text-amber-950">Choose an exercise first</p>
              <p className="mt-2 text-sm text-amber-900/90">
                Open <strong>Exercises</strong>, then use <strong>Submit here</strong> on a card — or
                select one — before uploading submissions.
              </p>
              <button
                type="button"
                onClick={() => setNav("exercises")}
                className="btn-theme-primary mt-6 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Go to library
              </button>
            </div>
          )}

          {nav === "upload" && canUseSubmissions && (
            <UploadPane
              onUpload={async (files) => {
                const ok = await handleUploads(files);
                if (ok) {
                  setNav("results");
                }
                return ok;
              }}
              uploading={state.uploading}
              grading={state.grading}
              uploadMode={state.uploadMode}
              explicitStudentName={state.explicitStudentName}
              onModeChange={setUploadMode}
              onStudentNameChange={setExplicitStudentName}
              llmUnavailableMessage={state.llmUnavailableMessage}
              hasPendingLocalGrade={state.pendingLocalGrade != null}
              onRunLocalHeuristic={async () => {
                const ok = await handleLocalHeuristicGrade();
                if (ok) {
                  setNav("results");
                }
              }}
              activeExerciseTitle={activeTitle}
            />
          )}

          {nav === "results" && !canUseSubmissions && (
            <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center shadow-sm">
              <p className="text-3xl">📋</p>
              <p className="mt-3 text-lg font-semibold text-amber-950">No active exercise</p>
              <p className="mt-2 text-sm text-amber-900/90">
                Select an exercise from the library to tie drafts to an assignment.
              </p>
              <button
                type="button"
                onClick={() => setNav("exercises")}
                className="btn-theme-primary mt-6 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Go to library
              </button>
            </div>
          )}

          {nav === "results" && canUseSubmissions && (
            <ResultsPane
              drafts={state.drafts}
              importedCount={state.importedCount}
              exerciseTitle={activeTitle}
              onBackToLibrary={() => {
                resetFlow();
                setNav("exercises");
              }}
              onOpenDashboard={() => setNav("dashboard")}
            />
          )}

          {state.error ? (
            <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              ⚠️ {state.error}
            </div>
          ) : null}
        </div>
      </div>

      {state.exerciseForm.open ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal
        >
          <div className="my-4 w-full max-w-5xl rounded-2xl border border-app app-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold app-text">
                {state.exerciseForm.mode === "create" ? "➕ New exercise" : "✏️ Edit exercise"}
              </h2>
              <button
                type="button"
                onClick={closeExerciseForm}
                className="rounded-lg border border-app px-3 py-1.5 text-sm app-text-secondary hover:bg-[var(--theme-bg-subtle)]"
              >
                Close
              </button>
            </div>
            <RubricPane
              exercise={state.exerciseForm.draft}
              onChange={updateExerciseFormDraft}
              canSubmit={canCommitExerciseForm}
              rubricCriteriaTotal={rubricCriteriaTotal}
              rubricPointsMatchExercise={rubricPointsMatchExercise}
              submitLabel={
                state.exerciseForm.mode === "create"
                  ? "➕ Add to library"
                  : "💾 Save changes"
              }
              onSubmit={() => {
                commitExerciseForm();
              }}
              onCancel={closeExerciseForm}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
