"use client";

import type { StudentAggregate, StudentExerciseRecord } from "@/types/domain";

type StudentDashboardProps = {
  records: StudentExerciseRecord[];
  aggregates: StudentAggregate[];
  isParsing: boolean;
  isGrading: boolean;
  onClearHistory: () => void;
};

function StatusBadge({ status }: { status: StudentExerciseRecord["status"] }) {
  const styles: Record<StudentExerciseRecord["status"], string> = {
    parsing: "bg-amber-100 text-amber-800 border-amber-200",
    grading: "surface-muted text-[var(--theme-primary)] border-[var(--theme-accent-soft)]",
    graded: "bg-emerald-100 text-emerald-800 border-emerald-200",
    error: "bg-red-100 text-red-800 border-red-200",
  };

  const labels: Record<StudentExerciseRecord["status"], string> = {
    parsing: "Reading files",
    grading: "Calculating",
    graded: "Graded",
    error: "Failed",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function StudentDashboard({
  records,
  aggregates,
  isParsing,
  isGrading,
  onClearHistory,
}: StudentDashboardProps) {
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const activeJobs = records.filter((r) => r.status === "parsing" || r.status === "grading").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-app app-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Students</p>
          <p className="mt-1 text-2xl font-semibold app-text">{aggregates.length}</p>
          <p className="mt-1 text-sm app-text-secondary">Unique names in history</p>
        </div>
        <div className="rounded-xl border border-app app-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide app-text-muted">In progress</p>
          <p
            className="mt-1 text-2xl font-semibold"
            style={{ color: "var(--theme-primary)" }}
          >
            {isParsing || isGrading ? "…" : activeJobs}
          </p>
          <p className="mt-1 text-sm app-text-secondary">
            {isParsing && "Reading files from upload"}
            {!isParsing && isGrading && "AI draft grading running"}
            {!isParsing && !isGrading && activeJobs === 0 && "Nothing running"}
            {!isParsing && !isGrading && activeJobs > 0 && `${activeJobs} job(s) in queue`}
          </p>
        </div>
        <div className="rounded-xl border border-app app-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Graded rows</p>
          <p className="mt-1 text-2xl font-semibold app-text">
            {records.filter((r) => r.status === "graded").length}
          </p>
          <p className="mt-1 text-sm app-text-secondary">Per upload / exercise</p>
        </div>
        <div className="rounded-xl border border-app app-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide app-text-muted">History</p>
          <p className="mt-1 text-2xl font-semibold app-text">{records.length}</p>
          <button
            type="button"
            onClick={onClearHistory}
            className="mt-2 text-sm font-medium hover:opacity-80"
            style={{ color: "var(--theme-primary)" }}
          >
            Clear history
          </button>
        </div>
      </div>

      {aggregates.length > 0 ? (
        <section className="rounded-xl border border-app app-surface shadow-sm">
          <div className="border-b border-app px-4 py-3">
            <h2 className="text-sm font-semibold app-text">Totals by student</h2>
            <p className="text-xs app-text-muted">Sum of draft scores across exercises in this session</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="app-bg-subtle text-xs font-medium uppercase app-text-muted">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Exercises</th>
                  <th className="px-4 py-2.5">Graded</th>
                  <th className="px-4 py-2.5">Total score</th>
                  <th className="px-4 py-2.5">Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {aggregates.map((agg) => (
                  <tr key={agg.studentRef} className="app-text">
                    <td className="px-4 py-3 font-medium">{agg.displayName}</td>
                    <td className="px-4 py-3">{agg.exerciseCount}</td>
                    <td className="px-4 py-3">{agg.gradedCount}</td>
                    <td className="px-4 py-3">
                      {agg.gradedCount > 0
                        ? `${agg.totalScore.toFixed(1)} / ${agg.maxPointsSum}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {agg.isActive ? (
                        <span style={{ color: "var(--theme-primary)" }}>Calculating…</span>
                      ) : (
                        <span className="app-text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-app app-surface shadow-sm">
        <div className="border-b border-app px-4 py-3">
          <h2 className="text-sm font-semibold app-text">Activity by exercise</h2>
          <p className="text-xs app-text-muted">Which exercise each submission was graded on</p>
        </div>
        {sortedRecords.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm app-text-muted">
            No submissions yet. Use <strong>Submissions</strong> to upload work — the student you
            enter there appears here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="app-bg-subtle text-xs font-medium uppercase app-text-muted">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Exercise</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Score</th>
                  <th className="px-4 py-2.5">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {sortedRecords.map((row) => (
                  <tr key={row.id} className="app-text">
                    <td className="px-4 py-3 font-medium">{row.displayName}</td>
                    <td className="px-4 py-3">{row.exerciseTitle}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "graded" && row.score != null && row.maxPoints != null
                        ? `${row.score.toFixed(1)} / ${row.maxPoints}`
                        : row.status === "error"
                          ? row.errorMessage ?? "Error"
                          : "—"}
                    </td>
                    <td className="px-4 py-3 app-text-muted">
                      {new Date(row.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
