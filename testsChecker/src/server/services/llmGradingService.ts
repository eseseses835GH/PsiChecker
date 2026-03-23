import { aiDraftFeedbackSchema } from "@/server/lib/schemas";
import type {
  AiCriterionFeedback,
  AiDraftFeedback,
  ExerciseInput,
  ParsedSubmission,
  RubricCriterionInput,
} from "@/types/domain";

type GradeSubmissionInput = {
  exercise: ExerciseInput;
  submission: ParsedSubmission;
};

function clampScore(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function heuristicCriterionGrade(
  criterion: RubricCriterionInput,
  submission: ParsedSubmission,
): AiCriterionFeedback {
  const combinedText = submission.files.map((file) => file.content).join("\n");
  const keywordBonus = criterion.guidance
    .split(/\s+/)
    .filter((token) => token.length > 4)
    .reduce(
      (score, token) =>
        combinedText.toLowerCase().includes(token.toLowerCase()) ? score + 1 : score,
      0,
    );

  const densitySignal = Math.min(1, combinedText.length / 1500);
  const normalized = clampScore(
    (keywordBonus * 0.2 + densitySignal * 0.8) * criterion.maxPoints,
    0,
    criterion.maxPoints,
  );
  const points = Number(normalized.toFixed(2));

  return {
    criterionId: criterion.id,
    points,
    confidence: Number((0.55 + densitySignal * 0.35).toFixed(2)),
    comment:
      points >= criterion.maxPoints * 0.8
        ? "Submission aligns well with the criterion expectations."
        : "Criterion is partially met; manual review is recommended for edge cases.",
    evidence: submission.files.slice(0, 2).map((file) => file.path),
  };
}

function buildHeuristicDraft(input: GradeSubmissionInput): AiDraftFeedback {
  const criteria = input.exercise.rubric.criteria.map((criterion) =>
    heuristicCriterionGrade(criterion, input.submission),
  );
  const totalScore = Number(criteria.reduce((sum, item) => sum + item.points, 0).toFixed(2));
  const meanConfidence =
    criteria.length > 0
      ? Number(
          (
            criteria.reduce((sum, item) => sum + item.confidence, 0) / criteria.length
          ).toFixed(2),
        )
      : 0;

  return {
    totalScore: clampScore(totalScore, 0, input.exercise.maxPoints),
    confidence: meanConfidence,
    summary: "Draft grade generated from rubric guidance and static code signals.",
    criteria,
    warnings: [],
  };
}

async function gradeWithOpenAI(input: GradeSubmissionInput): Promise<AiDraftFeedback | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const payload = {
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert grading assistant. Return strict JSON with keys: totalScore, confidence, summary, criteria, warnings.",
      },
      {
        role: "user",
        content: JSON.stringify({
          exercise: input.exercise,
          submission: {
            studentRef: input.submission.studentRef,
            files: input.submission.files,
          },
        }),
      },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content);
  const validated = aiDraftFeedbackSchema.safeParse(parsed);
  if (!validated.success) {
    return null;
  }

  return {
    ...validated.data,
    totalScore: clampScore(validated.data.totalScore, 0, input.exercise.maxPoints),
    criteria: validated.data.criteria.map((criterion, idx) => {
      const rubricCriterion = input.exercise.rubric.criteria[idx];
      if (!rubricCriterion) {
        return criterion;
      }

      return {
        ...criterion,
        criterionId: rubricCriterion.id,
        points: clampScore(criterion.points, 0, rubricCriterion.maxPoints),
      };
    }),
  };
}

export type GradeDraftOutcome =
  | { kind: "ok"; draft: AiDraftFeedback; gradingSource: "openai" | "heuristic" }
  | { kind: "llm_unavailable"; reason: "missing_api_key" };

export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * @param options.allowHeuristic — If false and there is no OpenAI key, returns
 * `llm_unavailable` instead of a local estimate. If OpenAI is configured but
 * the call fails, still falls back to heuristic when allowed (always allowed when a key exists).
 */
export async function buildDraftGrade(
  input: GradeSubmissionInput,
  options: { allowHeuristic: boolean },
): Promise<GradeDraftOutcome> {
  if (hasOpenAiApiKey()) {
    const llmResult = await gradeWithOpenAI(input);
    if (llmResult) {
      return { kind: "ok", draft: aiDraftFeedbackSchema.parse(llmResult), gradingSource: "openai" };
    }
    const draft = aiDraftFeedbackSchema.parse(buildHeuristicDraft(input));
    return { kind: "ok", draft, gradingSource: "heuristic" };
  }

  if (options.allowHeuristic) {
    const draft = aiDraftFeedbackSchema.parse(buildHeuristicDraft(input));
    return { kind: "ok", draft, gradingSource: "heuristic" };
  }

  return { kind: "llm_unavailable", reason: "missing_api_key" };
}
