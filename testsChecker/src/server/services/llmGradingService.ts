import { aiDraftFeedbackSchema } from "@/server/lib/schemas";
import type {
  AiCodeLineComment,
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

/** Groq OpenAI-compatible base URL (no trailing slash). */
const GROQ_OPENAI_BASE = "https://api.groq.com/openai";
const OPENAI_BASE = "https://api.openai.com";

/** Default Groq model for rubric-grounded grading (3.1 70B was retired; see Groq deprecations). */
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

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
    lineComments: [],
  };
}

function normalizeAndClampDraft(
  raw: AiDraftFeedback,
  input: GradeSubmissionInput,
): AiDraftFeedback {
  return {
    ...raw,
    totalScore: clampScore(raw.totalScore, 0, input.exercise.maxPoints),
    lineComments: raw.lineComments ?? [],
    criteria: raw.criteria.map((criterion, idx) => {
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

function slugKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function criterionKeyMatchesIdOrLabel(key: string, rc: RubricCriterionInput): boolean {
  const k = key.trim();
  if (k === rc.id) return true;
  if (k.toLowerCase() === rc.label.toLowerCase()) return true;
  if (slugKey(k) === slugKey(rc.label)) return true;
  if (slugKey(k) === slugKey(rc.id)) return true;
  return false;
}

function coerceCriterionRecord(val: unknown, fallbackId: string): Record<string, unknown> {
  const base =
    val && typeof val === "object" && !Array.isArray(val)
      ? (val as Record<string, unknown>)
      : {};
  const pointsRaw = base.points;
  const points =
    typeof pointsRaw === "number" && !Number.isNaN(pointsRaw) ? pointsRaw : Number(pointsRaw);
  const confRaw = base.confidence;
  const confidence =
    typeof confRaw === "number" && !Number.isNaN(confRaw) ? confRaw : Number(confRaw ?? 0.75);
  const comment =
    typeof base.comment === "string" && base.comment.trim().length > 0
      ? base.comment
      : "Graded per rubric.";
  const evidence = Array.isArray(base.evidence)
    ? base.evidence.filter((x): x is string => typeof x === "string")
    : [];
  const criterionId =
    typeof base.criterionId === "string" && base.criterionId.length > 0
      ? base.criterionId
      : fallbackId;

  return {
    criterionId,
    points: Number.isFinite(points) ? points : 0,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.75,
    comment,
    evidence,
  };
}

/**
 * Models often return `criteria` as an object keyed by name; our schema expects an array
 * ordered like exercise.rubric.criteria (normalizeAndClampDraft maps by index).
 */
function normalizeLlmDraftJson(parsed: unknown, exercise: ExerciseInput): unknown {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const o = parsed as Record<string, unknown>;
  const rubric = exercise.rubric.criteria;
  const rawCriteria = o.criteria;

  type Cand = { keys: string[]; body: Record<string, unknown> };
  const candidates: Cand[] = [];

  const pushCandidate = (explicitId: string, val: unknown) => {
    const coerced = coerceCriterionRecord(val, explicitId);
    const idStr = String(coerced.criterionId);
    const keys = [...new Set([idStr, explicitId, slugKey(idStr), slugKey(explicitId)])].filter(
      (k) => k.length > 0,
    );
    candidates.push({ keys, body: coerced });
  };

  if (Array.isArray(rawCriteria)) {
    rawCriteria.forEach((item, i) => {
      pushCandidate(rubric[i]?.id ?? `idx_${i}`, item);
    });
  } else if (rawCriteria && typeof rawCriteria === "object" && !Array.isArray(rawCriteria)) {
    for (const [key, val] of Object.entries(rawCriteria as Record<string, unknown>)) {
      pushCandidate(key, val);
    }
  } else {
    return parsed;
  }

  const used = new Set<number>();
  const pickForRubric = (rc: RubricCriterionInput): Record<string, unknown> => {
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;
      if (candidates[i].keys.some((k) => criterionKeyMatchesIdOrLabel(k, rc))) {
        used.add(i);
        return { ...candidates[i].body, criterionId: rc.id };
      }
    }
    return coerceCriterionRecord(
      {
        comment: "No model output matched this rubric criterion.",
        points: 0,
        confidence: 0.4,
        evidence: [],
      },
      rc.id,
    );
  };

  const criteria = rubric.map((rc) => pickForRubric(rc));
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((x): x is string => typeof x === "string")
    : [];

  return { ...o, criteria, warnings, lineComments: coerceLineComments(o.lineComments) };
}

function coerceLineComments(raw: unknown): AiCodeLineComment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: AiCodeLineComment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const path = typeof r.path === "string" ? r.path.trim() : "";
    const line = typeof r.line === "number" ? r.line : Number(r.line);
    const message = typeof r.message === "string" ? r.message.trim() : "";
    if (!path || !Number.isFinite(line) || line < 1 || !message) continue;
    const lineEndRaw = r.lineEnd;
    const lineEnd =
      lineEndRaw === undefined || lineEndRaw === null
        ? undefined
        : typeof lineEndRaw === "number"
          ? lineEndRaw
          : Number(lineEndRaw);
    const criterionId =
      typeof r.criterionId === "string" && r.criterionId.trim().length > 0
        ? r.criterionId.trim()
        : undefined;
    out.push({
      path,
      line: Math.trunc(line),
      lineEnd:
        lineEnd != null && Number.isFinite(lineEnd) && lineEnd >= Math.trunc(line)
          ? Math.trunc(lineEnd)
          : undefined,
      message,
      criterionId,
    });
  }
  return out;
}

/**
 * OpenAI-compatible chat/completions (works for OpenAI, Groq, and similar providers).
 */
async function gradeWithOpenAiCompatibleChat(
  input: GradeSubmissionInput,
  options: { baseUrl: string; apiKey: string; model: string },
): Promise<AiDraftFeedback | null> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const payload = {
    model: options.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert grading assistant. Return strict JSON with keys: totalScore, confidence, summary, criteria, warnings, lineComments. " +
          "The criteria value MUST be a JSON array (not an object), with one object per rubric criterion in the same order as exercise.rubric.criteria. " +
          "Each criterion object must include string criterionId (use the rubric criterion id field), number points, number confidence between 0 and 1, string comment, and string array evidence. " +
          "lineComments MUST be a JSON array of objects, each with: path (exact string matching a submission file path from the user message), " +
          "line (1-based integer line number in that file), optional lineEnd (inclusive end line for a short range), message (concise reviewer note—what is wrong or good), optional criterionId (rubric criterion id). " +
          "Add several lineComments that pinpoint real issues or highlights in the code, like Git pull-request comments. Use paths exactly as they appear in submission.files.",
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const normalized = normalizeLlmDraftJson(parsed, input.exercise);
  const validated = aiDraftFeedbackSchema.safeParse(normalized);
  if (!validated.success) {
    return null;
  }

  return normalizeAndClampDraft(validated.data, input);
}

function getGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim();
}

async function tryGroqThenOpenAi(
  input: GradeSubmissionInput,
): Promise<{ draft: AiDraftFeedback; gradingSource: "groq" | "openai" } | null> {
  const groqKey = getGroqApiKey();
  if (groqKey) {
    const model =
      process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;
    const draft = await gradeWithOpenAiCompatibleChat(input, {
      baseUrl: GROQ_OPENAI_BASE,
      apiKey: groqKey,
      model,
    });
    if (draft) {
      return { draft, gradingSource: "groq" };
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const draft = await gradeWithOpenAiCompatibleChat(input, {
      baseUrl: OPENAI_BASE,
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    });
    if (draft) {
      return { draft, gradingSource: "openai" };
    }
  }

  return null;
}

export type GradeDraftOutcome =
  | { kind: "ok"; draft: AiDraftFeedback; gradingSource: "groq" | "openai" | "heuristic" }
  | { kind: "llm_unavailable"; reason: "missing_api_key" };

export function hasAiGradingApiKey(): boolean {
  return Boolean(getGroqApiKey() || process.env.OPENAI_API_KEY?.trim());
}

/** @deprecated Use hasAiGradingApiKey — Groq uses GROQ_API_KEY (server-only). */
export function hasOpenAiApiKey(): boolean {
  return hasAiGradingApiKey();
}

/**
 * @param options.allowHeuristic — If false and there is no LLM API key, returns
 * `llm_unavailable` instead of a local estimate. If a key is configured but
 * the call fails, still falls back to heuristic when allowed (always allowed when a key exists).
 */
export async function buildDraftGrade(
  input: GradeSubmissionInput,
  options: { allowHeuristic: boolean },
): Promise<GradeDraftOutcome> {
  if (hasAiGradingApiKey()) {
    const llmResult = await tryGroqThenOpenAi(input);
    if (llmResult) {
      return {
        kind: "ok",
        draft: aiDraftFeedbackSchema.parse(llmResult.draft),
        gradingSource: llmResult.gradingSource,
      };
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
