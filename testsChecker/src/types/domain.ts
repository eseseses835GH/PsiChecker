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

export type AiDraftFeedback = {
  totalScore: number;
  confidence: number;
  summary: string;
  criteria: AiCriterionFeedback[];
  warnings: string[];
};

export type SubmissionDraftResult = {
  studentRef: string;
  /** Same as teacher input when provided; falls back to studentRef. */
  displayName?: string;
  draft: AiDraftFeedback;
  /** How this draft was produced (when the server sends it). */
  gradingSource?: "openai" | "heuristic";
};

export type GradeDraftRequest = {
  exercise: ExerciseInput;
  submissions: ParsedSubmission[];
  /** When true and OpenAI is not configured, use the built-in heuristic estimate. */
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
