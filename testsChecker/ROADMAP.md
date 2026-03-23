# AutoGrade Classroom - 3 Sprint Roadmap

## Sprint 1 (MVP, Build Now): Core Infrastructure

### Objectives
- Establish project foundation with strict TypeScript, modular architecture, and Tailwind UI shell.
- Create core data model for exercises, submissions, and AI draft grading results.
- Deliver a functional vertical slice for teacher workflow:
  1) Upload rubric
  2) Upload code files (bulk)
  3) View AI draft results

### Deliverables
- Project scaffolding and coding standards baseline.
- Database schema initialization (Supabase/PostgreSQL SQL file).
- Bulk upload handler for multi-student code submissions.
- AI grading orchestration service that accepts code + rubric and returns structured JSON.
- Guided "Teacher Upload" page implementing the linear UX flow.

### Exit Criteria
- Teacher can define an exercise and rubric, upload multiple student submissions, trigger grading, and view draft results in one flow.
- AI draft output is strongly typed and validated before rendering.
- Codebase structure follows `/components`, `/hooks`, `/services`, `/types`, `/lib`.

---

## Sprint 2: Reviewer Dashboard

### Objectives
- Build high-throughput review experience for manual verification and overrides.

### Deliverables
- Split-screen reviewer UI (code + rubric/feedback panel).
- Line-level AI feedback visualization.
- Manual criterion and total score override workflow.
- State synchronization rules when switching students/exercises.

### Exit Criteria
- Reviewer can quickly inspect AI reasoning and override scores with deterministic persistence behavior.

---

## Sprint 3: Optimization and Scale Features

### Objectives
- Improve grading efficiency and quality at higher volume.

### Deliverables
- Batch/cluster grading (group similar submissions).
- Plagiarism signal integration.
- Export pipeline to CSV / Google Sheets-compatible format.

### Exit Criteria
- Teacher can process larger cohorts with measurable reduction in review time and export final grades reliably.
