import type { ExerciseInput } from "@/types/domain";

export function rubricCriteriaPointsSum(exercise: ExerciseInput): number {
  return exercise.rubric.criteria.reduce(
    (sum, c) => sum + (Number.isFinite(c.maxPoints) ? c.maxPoints : 0),
    0,
  );
}

export function rubricMatchesAssignmentMax(exercise: ExerciseInput): boolean {
  return exercise.maxPoints > 0 && rubricCriteriaPointsSum(exercise) === exercise.maxPoints;
}
