import { NextResponse } from "next/server";
import { rubricMatchesAssignmentMax } from "@/server/lib/exerciseValidation";
import { clientKeyFromRequest, rateLimitGradeRequest } from "@/server/lib/gradeRateLimit";
import { runWithConcurrency } from "@/server/lib/promisePool";
import { buildDraftGrade, hasAiGradingApiKey } from "@/server/services/llmGradingService";
import type { GradeDraftRequest, GradeDraftResponse } from "@/types/domain";

export const runtime = "nodejs";

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST with a JSON body." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function GET() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export async function POST(request: Request) {
  try {
    const limit = rateLimitGradeRequest(clientKeyFromRequest(request));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many grading requests. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        },
      );
    }

    const text = await request.text();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Request body is required and cannot be empty." }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
    }

    const body = payload as Partial<GradeDraftRequest>;
    if (!body.exercise || typeof body.exercise !== "object" || Array.isArray(body.exercise)) {
      return NextResponse.json({ error: "Field 'exercise' must be an object." }, { status: 400 });
    }

    if (!Array.isArray(body.submissions) || body.submissions.length === 0) {
      return NextResponse.json(
        { error: "Field 'submissions' must be a non-empty array." },
        { status: 400 },
      );
    }

    const gradeRequest = body as GradeDraftRequest;

    if (!rubricMatchesAssignmentMax(gradeRequest.exercise)) {
      return NextResponse.json(
        {
          error:
            "Rubric criteria points must sum to the assignment max points. Adjust the rubric in the teacher UI and try again.",
        },
        { status: 400 },
      );
    }

    const useLocalHeuristic = Boolean(gradeRequest.useLocalHeuristic);
    const allowHeuristic = hasAiGradingApiKey() || useLocalHeuristic;

    if (!allowHeuristic) {
      const response: GradeDraftResponse = {
        status: "llm_unavailable",
        reason: "missing_api_key",
        message:
          "AI grading is not available: set GROQ_API_KEY or OPENAI_API_KEY in the server environment (e.g. Vercel project settings), or use a local heuristic estimate below.",
      };
      return NextResponse.json(response);
    }

    const drafts = await runWithConcurrency(gradeRequest.submissions, 5, async (submission) => {
      const outcome = await buildDraftGrade(
        {
          exercise: gradeRequest.exercise,
          submission,
        },
        { allowHeuristic },
      );

      if (outcome.kind === "llm_unavailable") {
        throw new Error("Unexpected llm_unavailable after allowHeuristic check.");
      }

      return {
        studentRef: submission.studentRef,
        displayName: submission.displayName ?? submission.studentRef,
        draft: outcome.draft,
        gradingSource: outcome.gradingSource,
      };
    });

    const response: GradeDraftResponse = { status: "graded", drafts };
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected failure while grading submissions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
