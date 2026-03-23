import { z } from "zod";

export const aiCriterionFeedbackSchema = z.object({
  criterionId: z.string().min(1),
  points: z.number().min(0),
  confidence: z.number().min(0).max(1),
  comment: z.string().min(1),
  evidence: z.array(z.string()),
});

export const aiDraftFeedbackSchema = z.object({
  totalScore: z.number().min(0),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  criteria: z.array(aiCriterionFeedbackSchema),
  warnings: z.array(z.string()),
});
