import type { GradeDraftRequest, GradeDraftResponse } from "@/types/domain";

export async function requestDraftGrades(
  request: GradeDraftRequest,
): Promise<GradeDraftResponse> {
  const response = await fetch("/api/grade", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to grade submissions.");
  }

  return (await response.json()) as GradeDraftResponse;
}
