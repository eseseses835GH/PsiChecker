"use client";

import { useCallback, useMemo, useState } from "react";
import { requestDraftGrades } from "@/client/services/aiGradingClient";
import { isLanguageFilled } from "@/client/constants/languages";
import {
  attributeSubmissionsToExplicitStudent,
  parseBulkSubmissions,
} from "@/client/services/uploadParser";
import type {
  ExerciseInput,
  ParsedSubmission,
  RubricCriterionInput,
  SavedExercise,
  StudentAggregate,
  StudentExerciseRecord,
  SubmissionDraftResult,
} from "@/types/domain";

const DEFAULT_CRITERIA: RubricCriterionInput[] = [
  {
    id: "correctness",
    label: "Correctness",
    maxPoints: 50,
    guidance: "Program meets all functional requirements.",
  },
  {
    id: "code_quality",
    label: "Code Quality",
    maxPoints: 30,
    guidance: "Readable structure, naming, and maintainability.",
  },
  {
    id: "conventions",
    label: "Conventions",
    maxPoints: 20,
    guidance: "Follows teacher coding conventions and constraints.",
  },
];

type FlowStep = "rubric" | "upload" | "results";

export type UploadAttributionMode = "explicit" | "infer";

export type ExerciseFormState = {
  open: boolean;
  mode: "create" | "edit";
  editingId: string | null;
  draft: ExerciseInput;
};

export type TeacherFlowState = {
  step: FlowStep;
  exercises: SavedExercise[];
  selectedExerciseId: string | null;
  exerciseForm: ExerciseFormState;
  exerciseSearchQuery: string;
  /** "all" or exact language string from an exercise */
  exerciseLanguageFilter: string;
  uploading: boolean;
  grading: boolean;
  error: string | null;
  drafts: SubmissionDraftResult[];
  importedCount: number;
  studentRecords: StudentExerciseRecord[];
  uploadMode: UploadAttributionMode;
  explicitStudentName: string;
  llmUnavailableMessage: string | null;
  pendingLocalGrade: {
    exercise: ExerciseInput;
    exerciseId: string | undefined;
    submissions: ParsedSubmission[];
    batchRowIds: string[];
  } | null;
};

function initialExercise(): ExerciseInput {
  return {
    title: "Exercise 1",
    language: "TypeScript",
    maxPoints: 100,
    rubric: {
      title: "Default Rubric",
      conventions:
        "Use clear naming, avoid unused code, keep functions focused, and include error handling.",
      criteria: DEFAULT_CRITERIA,
    },
  };
}

function closedExerciseForm(): ExerciseFormState {
  return {
    open: false,
    mode: "create",
    editingId: null,
    draft: initialExercise(),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function displayForSubmission(s: ParsedSubmission): string {
  return s.displayName?.trim() || s.studentRef;
}

function buildAggregates(records: StudentExerciseRecord[]): StudentAggregate[] {
  const byRef = new Map<string, StudentAggregate>();

  for (const row of records) {
    const key = row.studentRef;
    let agg = byRef.get(key);
    if (!agg) {
      agg = {
        studentRef: row.studentRef,
        displayName: row.displayName,
        exerciseCount: 0,
        gradedCount: 0,
        totalScore: 0,
        maxPointsSum: 0,
        isActive: false,
      };
      byRef.set(key, agg);
    }

    agg.exerciseCount += 1;
    if (row.status === "graded" && row.score != null && row.maxPoints != null) {
      agg.gradedCount += 1;
      agg.totalScore += row.score;
      agg.maxPointsSum += row.maxPoints;
    }
    if (row.status === "parsing" || row.status === "grading") {
      agg.isActive = true;
    }
    if (row.displayName && row.displayName !== row.studentRef) {
      agg.displayName = row.displayName;
    }
  }

  return Array.from(byRef.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );
}

function exerciseFormValid(draft: ExerciseInput, rubricTotal: number): boolean {
  return (
    draft.title.trim().length > 0 &&
    isLanguageFilled(draft.language) &&
    draft.rubric.criteria.length > 0 &&
    draft.rubric.criteria.every((criterion) => criterion.maxPoints > 0) &&
    rubricTotal === draft.maxPoints &&
    draft.maxPoints > 0
  );
}

export function useTeacherUploadFlow() {
  const [state, setState] = useState<TeacherFlowState>({
    step: "rubric",
    exercises: [],
    selectedExerciseId: null,
    exerciseForm: closedExerciseForm(),
    exerciseSearchQuery: "",
    exerciseLanguageFilter: "all",
    uploading: false,
    grading: false,
    error: null,
    drafts: [],
    importedCount: 0,
    studentRecords: [],
    uploadMode: "explicit",
    explicitStudentName: "",
    llmUnavailableMessage: null,
    pendingLocalGrade: null,
  });

  const aggregates = useMemo(() => buildAggregates(state.studentRecords), [state.studentRecords]);

  const formDraft = state.exerciseForm.draft;

  const rubricCriteriaTotal = useMemo(
    () =>
      formDraft.rubric.criteria.reduce(
        (sum, c) => sum + (Number.isFinite(c.maxPoints) ? c.maxPoints : 0),
        0,
      ),
    [formDraft.rubric.criteria],
  );

  const rubricPointsMatchExercise = rubricCriteriaTotal === formDraft.maxPoints;

  const canCommitExerciseForm = useMemo(
    () => exerciseFormValid(formDraft, rubricCriteriaTotal),
    [formDraft, rubricCriteriaTotal],
  );

  const filteredExercises = useMemo(() => {
    const q = state.exerciseSearchQuery.trim().toLowerCase();
    return state.exercises.filter((ex) => {
      const d = ex.data;
      const langOk =
        state.exerciseLanguageFilter === "all" || d.language === state.exerciseLanguageFilter;
      const textOk =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.language.toLowerCase().includes(q) ||
        d.rubric.conventions.toLowerCase().includes(q) ||
        d.rubric.criteria.some((c) => c.label.toLowerCase().includes(q));
      return langOk && textOk;
    });
  }, [state.exercises, state.exerciseSearchQuery, state.exerciseLanguageFilter]);

  const uniqueLanguages = useMemo(() => {
    const set = new Set(state.exercises.map((e) => e.data.language));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [state.exercises]);

  const selectedExercise = useMemo(
    () => state.exercises.find((e) => e.id === state.selectedExerciseId) ?? null,
    [state.exercises, state.selectedExerciseId],
  );

  const setUploadMode = useCallback((mode: UploadAttributionMode) => {
    setState((prev) => ({ ...prev, uploadMode: mode, error: null }));
  }, []);

  const setExplicitStudentName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, explicitStudentName: name, error: null }));
  }, []);

  const setExerciseSearchQuery = useCallback((q: string) => {
    setState((prev) => ({ ...prev, exerciseSearchQuery: q }));
  }, []);

  const setExerciseLanguageFilter = useCallback((lang: string) => {
    setState((prev) => ({ ...prev, exerciseLanguageFilter: lang }));
  }, []);

  const updateExerciseFormDraft = useCallback((next: ExerciseInput) => {
    setState((prev) => ({
      ...prev,
      exerciseForm: { ...prev.exerciseForm, draft: next },
      error: null,
    }));
  }, []);

  const openCreateExerciseForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      exerciseForm: {
        open: true,
        mode: "create",
        editingId: null,
        draft: initialExercise(),
      },
      error: null,
    }));
  }, []);

  const openEditExerciseForm = useCallback((id: string) => {
    setState((prev) => {
      const found = prev.exercises.find((e) => e.id === id);
      if (!found) {
        return prev;
      }
      return {
        ...prev,
        exerciseForm: {
          open: true,
          mode: "edit",
          editingId: id,
          draft: structuredClone(found.data),
        },
        error: null,
      };
    });
  }, []);

  const closeExerciseForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      exerciseForm: closedExerciseForm(),
      error: null,
    }));
  }, []);

  const commitExerciseForm = useCallback(() => {
    if (!canCommitExerciseForm) {
      return false;
    }
    setState((prev) => {
      const draft = prev.exerciseForm.draft;
      if (prev.exerciseForm.mode === "create") {
        const saved: SavedExercise = {
          id: crypto.randomUUID(),
          createdAt: nowIso(),
          data: structuredClone(draft),
        };
        return {
          ...prev,
          exercises: [...prev.exercises, saved],
          exerciseForm: closedExerciseForm(),
        };
      }
      const id = prev.exerciseForm.editingId;
      if (!id) {
        return prev;
      }
      return {
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.id === id ? { ...e, data: structuredClone(draft) } : e,
        ),
        exerciseForm: closedExerciseForm(),
      };
    });
    return true;
  }, [canCommitExerciseForm]);

  const deleteExercise = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== id),
      selectedExerciseId: prev.selectedExerciseId === id ? null : prev.selectedExerciseId,
      exerciseForm:
        prev.exerciseForm.editingId === id ? closedExerciseForm() : prev.exerciseForm,
    }));
  }, []);

  const selectExerciseForGrading = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedExerciseId: id,
      error: null,
    }));
  }, []);

  const goToStep = useCallback((step: FlowStep) => {
    setState((prev) => ({ ...prev, step, error: null }));
  }, []);

  const clearStudentHistory = useCallback(() => {
    setState((prev) => ({ ...prev, studentRecords: [] }));
  }, []);

  async function handleUploads(files: File[]): Promise<boolean> {
    const saved = selectedExercise;
    if (!saved) {
      setState((prev) => ({
        ...prev,
        error: "Select an exercise from the library before submitting work.",
      }));
      return false;
    }

    const exerciseSnapshot = saved.data;
    const exerciseId = saved.id;
    const mode = state.uploadMode;
    const explicitName = state.explicitStudentName.trim();

    if (mode === "explicit" && !explicitName) {
      setState((prev) => ({
        ...prev,
        error: "Enter the student name or ID for this upload, or switch to “Infer from files”.",
      }));
      return false;
    }

    let batchRowIds: string[] = [];

    setState((prev) => ({
      ...prev,
      uploading: true,
      grading: false,
      error: null,
      drafts: [],
      llmUnavailableMessage: null,
      pendingLocalGrade: null,
    }));

    try {
      let submissions: ParsedSubmission[] = await parseBulkSubmissions(files);
      if (submissions.length === 0) {
        throw new Error("No supported code files found. Upload source files or ZIP archives.");
      }

      if (mode === "explicit") {
        submissions = attributeSubmissionsToExplicitStudent(submissions, explicitName);
        if (submissions.length === 0) {
          throw new Error("No files left after attributing to student.");
        }
      }

      const newRows: StudentExerciseRecord[] = submissions.map((sub) => ({
        id: crypto.randomUUID(),
        exerciseId,
        studentRef: sub.studentRef,
        displayName: displayForSubmission(sub),
        exerciseTitle: exerciseSnapshot.title,
        status: "grading",
        score: null,
        maxPoints: exerciseSnapshot.maxPoints,
        errorMessage: null,
        updatedAt: nowIso(),
      }));

      batchRowIds = newRows.map((r) => r.id);

      setState((prev) => ({
        ...prev,
        studentRecords: [...prev.studentRecords, ...newRows],
        importedCount: submissions.length,
        uploading: false,
        grading: true,
      }));

      const gradeResult = await requestDraftGrades({
        exercise: exerciseSnapshot,
        submissions,
      });

      if (gradeResult.status === "llm_unavailable") {
        setState((prev) => ({
          ...prev,
          grading: false,
          uploading: false,
          llmUnavailableMessage: gradeResult.message,
          pendingLocalGrade: {
            exercise: exerciseSnapshot,
            exerciseId,
            submissions,
            batchRowIds,
          },
          studentRecords: prev.studentRecords.map((r) =>
            batchRowIds.includes(r.id)
              ? {
                  ...r,
                  status: "error" as const,
                  errorMessage: gradeResult.message,
                  updatedAt: nowIso(),
                }
              : r,
          ),
        }));
        return false;
      }

      const drafts = gradeResult.drafts;
      const draftByRef = new Map(drafts.map((d) => [d.studentRef, d]));

      setState((prev) => ({
        ...prev,
        step: "results",
        drafts,
        grading: false,
        uploading: false,
        error: null,
        llmUnavailableMessage: null,
        pendingLocalGrade: null,
        studentRecords: prev.studentRecords.map((r) => {
          if (!batchRowIds.includes(r.id)) {
            return r;
          }
          const draft = draftByRef.get(r.studentRef);
          if (!draft) {
            return {
              ...r,
              status: "error" as const,
              errorMessage: "No draft returned for this student.",
              updatedAt: nowIso(),
            };
          }
          return {
            ...r,
            status: "graded" as const,
            score: draft.draft.totalScore,
            maxPoints: exerciseSnapshot.maxPoints,
            errorMessage: null,
            updatedAt: nowIso(),
          };
        }),
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setState((prev) => ({
        ...prev,
        grading: false,
        uploading: false,
        error: message,
        studentRecords:
          batchRowIds.length > 0
            ? prev.studentRecords.map((r) =>
                batchRowIds.includes(r.id)
                  ? { ...r, status: "error" as const, errorMessage: message, updatedAt: nowIso() }
                  : r,
              )
            : prev.studentRecords,
      }));
      return false;
    }
  }

  const handleLocalHeuristicGrade = useCallback(async (): Promise<boolean> => {
    const pending = state.pendingLocalGrade;
    if (!pending) {
      return false;
    }

    setState((prev) => ({
      ...prev,
      grading: true,
      error: null,
      llmUnavailableMessage: null,
      studentRecords: prev.studentRecords.map((r) =>
        pending.batchRowIds.includes(r.id)
          ? { ...r, status: "grading" as const, errorMessage: null, updatedAt: nowIso() }
          : r,
      ),
    }));

    try {
      const gradeResult = await requestDraftGrades({
        exercise: pending.exercise,
        submissions: pending.submissions,
        useLocalHeuristic: true,
      });

      if (gradeResult.status !== "graded") {
        throw new Error(
          gradeResult.status === "llm_unavailable"
            ? gradeResult.message
            : "Unable to compute local estimate.",
        );
      }

      const drafts = gradeResult.drafts;
      const draftByRef = new Map(drafts.map((d) => [d.studentRef, d]));
      const { batchRowIds } = pending;

      setState((prev) => ({
        ...prev,
        step: "results",
        drafts,
        grading: false,
        error: null,
        pendingLocalGrade: null,
        llmUnavailableMessage: null,
        studentRecords: prev.studentRecords.map((r) => {
          if (!batchRowIds.includes(r.id)) {
            return r;
          }
          const draft = draftByRef.get(r.studentRef);
          if (!draft) {
            return {
              ...r,
              status: "error" as const,
              errorMessage: "No draft returned for this student.",
              updatedAt: nowIso(),
            };
          }
          return {
            ...r,
            status: "graded" as const,
            score: draft.draft.totalScore,
            maxPoints: pending.exercise.maxPoints,
            errorMessage: null,
            updatedAt: nowIso(),
          };
        }),
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local grading failed.";
      setState((prev) => ({
        ...prev,
        grading: false,
        error: message,
        llmUnavailableMessage: null,
        studentRecords:
          pending.batchRowIds.length > 0
            ? prev.studentRecords.map((r) =>
                pending.batchRowIds.includes(r.id)
                  ? { ...r, status: "error" as const, errorMessage: message, updatedAt: nowIso() }
                  : r,
              )
            : prev.studentRecords,
      }));
      return false;
    }
  }, [state.pendingLocalGrade]);

  function clearDraftSession() {
    setState((prev) => ({
      ...prev,
      step: "rubric",
      drafts: [],
      importedCount: 0,
      llmUnavailableMessage: null,
      pendingLocalGrade: null,
      error: null,
    }));
  }

  return {
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
    resetFlow: clearDraftSession,
    setUploadMode,
    setExplicitStudentName,
    clearStudentHistory,
    handleLocalHeuristicGrade,
  };
}
