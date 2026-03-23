create extension if not exists "pgcrypto";

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  language text not null,
  max_points integer not null check (max_points > 0),
  rubric_title text not null,
  rubric_json jsonb not null,
  conventions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  student_ref text not null,
  source_type text not null check (source_type in ('zip', 'git', 'files')),
  snapshot_ref text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'graded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, student_ref, snapshot_ref)
);

create table if not exists ai_drafts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  model_name text not null,
  rubric_snapshot jsonb not null,
  feedback_json jsonb not null,
  total_score numeric(8,2) not null check (total_score >= 0),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_submissions_exercise_id on submissions(exercise_id);
create index if not exists idx_submissions_student_ref on submissions(student_ref);
create index if not exists idx_ai_drafts_submission_id on ai_drafts(submission_id);
