import { NextResponse } from "next/server";
import { rubricMatchesAssignmentMax } from "@/server/lib/exerciseValidation";
import { runWithConcurrency } from "@/server/lib/promisePool";
import { buildDraftGrade, hasOpenAiApiKey } from "@/server/services/llmGradingService";
import type { GradeDraftRequest, GradeDraftResponse } from "@/types/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GradeDraftRequest;
    if (!payload.exercise || payload.submissions.length === 0) {
      return NextResponse.json(
        { error: "Exercise and at least one submission are required." },
        { status: 400 },
      );
    }

    if (!rubricMatchesAssignmentMax(payload.exercise)) {
      return NextResponse.json(
        {
          error:
            "Rubric criteria points must sum to the assignment max points. Adjust the rubric in the teacher UI and try again.",
        },
        { status: 400 },
      );
    }

    const useLocalHeuristic = Boolean(payload.useLocalHeuristic);
    const allowHeuristic = hasOpenAiApiKey() || useLocalHeuristic;

    if (!allowHeuristic) {
      const response: GradeDraftResponse = {
        status: "llm_unavailable",
        reason: "missing_api_key",
        message:
          "AI grading is not available: OPENAI_API_KEY is not set on the server. Configure it for full AI scoring, or use a local heuristic estimate below.",
      };
      return NextResponse.json(response);
    }

    const drafts = await runWithConcurrency(payload.submissions, 5, async (submission) => {
      const outcome = await buildDraftGrade(
        {
          exercise: payload.exercise,
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
