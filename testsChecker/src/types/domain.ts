export type RubricCriterionInput = {
  id: string;
  label: string;
  maxPoints: number;
  guidance: string;
};

export type RubricInput = {
  title: string;
  conventions: string;
  criteria: RubricCriterionInput[];
};

export type ExerciseInput = {
  title: string;
  language: string;
  maxPoints: number;
  rubric: RubricInput;
};

/** Persisted exercise in the teacher library (client-side). */
export type SavedExercise = {
  id: string;
  createdAt: string;
  data: ExerciseInput;
};

export type SubmissionFile = {
  path: string;
  content: string;
};

export type ParsedSubmission = {
  /** Stable key for grouping (normalized). */
  studentRef: string;
  /** Teacher-facing label when they typed a name explicitly. */
  displayName?: string;
  source: "zip" | "files";
  files: SubmissionFile[];
};

/** One row in the student progress dashboard (per upload / exercise attempt). */
export type StudentExerciseRecord = {
  id: string;
  /** Which library exercise this attempt belongs to (when set). */
  exerciseId?: string;
  studentRef: string;
  displayName: string;
  exerciseTitle: string;
  status: "parsing" | "grading" | "graded" | "error";
  score: number | null;
  maxPoints: number | null;
  errorMessage: string | null;
  updatedAt: string;
};

/** Aggregated stats per student across all recorded exercises. */
export type StudentAggregate = {
  studentRef: string;
  displayName: string;
  exerciseCount: number;
  gradedCount: number;
  totalScore: number;
  maxPointsSum: number;
  /** True if any row for this student is currently parsing or grading. */
  isActive: boolean;
};

export type AiCriterionFeedback = {
  criterionId: string;
  points: number;
  confidence: number;
  comment: string;
  evidence: string[];
};

/** Inline review comment pinned to a source line (Git-style feedback). */
export type AiCodeLineComment = {
  /** Path as in submission.files[].path (model should reuse exact paths from the prompt). */
  path: string;
  /** 1-based start line in that file. */
  line: number;
  /** Optional inclusive end line for a small range; omit for a single line. */
  lineEnd?: number;
  message: string;
  /** Optional link to exercise.rubric.criteria[].id. */
  criterionId?: string;
};

export type AiDraftFeedback = {
  totalScore: number;
  confidence: number;
  summary: string;
  criteria: AiCriterionFeedback[];
  warnings: string[];
  /** Line-anchored comments; may be empty for heuristic or short model outputs. */
  lineComments: AiCodeLineComment[];
};

export type SubmissionDraftResult = {
  studentRef: string;
  /** Same as teacher input when provided; falls back to studentRef. */
  displayName?: string;
  draft: AiDraftFeedback;
  /** How this draft was produced (when the server sends it). */
  gradingSource?: "groq" | "openai" | "heuristic";
};

export type GradeDraftRequest = {
  exercise: ExerciseInput;
  submissions: ParsedSubmission[];
  /** When true and no LLM API key is configured, use the built-in heuristic estimate. */
  useLocalHeuristic?: boolean;
};

export type GradeDraftResponse =
  | {
      status: "graded";
      drafts: SubmissionDraftResult[];
    }
  | {
      status: "llm_unavailable";
      reason: "missing_api_key";
      message: string;
    };
