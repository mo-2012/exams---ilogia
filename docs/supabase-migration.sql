-- ============================================================================
-- iLogia Exams — Supabase migration (PREPARED, NOT EXECUTED)
-- Target: the EXISTING iLogia Supabase project (zugwicbbfbefbbwugfxq).
--
-- Rules honoured here (from the master prompt):
--   * No new Supabase project — this runs in the existing one.
--   * No existing production table is modified — every exam table is
--     prefixed `exam_` to avoid collisions (note: a `subjects` table already
--     exists for videos, hence `exam_subjects`).
--   * RLS is ENABLED on every table and never disabled.
--   * No Service Role key is ever needed in the browser; grading and timing
--     stay server-side (see notes at the bottom).
--
-- Auth mapping: the live platform uses Kimi OAuth users; Supabase uses
-- auth.users (uuid). Exam rows reference auth.users(id) directly, matching
-- how `profiles` works in the existing project. Admin checks reuse the
-- existing `public.is_admin()` RPC.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reference data
-- ---------------------------------------------------------------------------

create table if not exists public.exam_subjects (
  id          bigint generated always as identity primary key,
  name_ar     text not null,
  name_en     text,
  icon        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.exam_topics (
  id          bigint generated always as identity primary key,
  subject_id  bigint not null references public.exam_subjects(id) on delete cascade,
  name_ar     text not null,
  name_en     text,
  sort_order  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- 2. Exams
-- ---------------------------------------------------------------------------

create table if not exists public.exam_exams (
  id                   bigint generated always as identity primary key,
  subject_id           bigint not null references public.exam_subjects(id),
  topic_id             bigint references public.exam_topics(id),
  title                text not null,
  description          text,
  instructions         text,
  difficulty           text not null default 'medium'
                       check (difficulty in ('easy','medium','hard')),
  duration_minutes     integer not null default 30 check (duration_minutes > 0),
  passing_score        integer check (passing_score between 0 and 100),
  max_attempts         integer not null default 1 check (max_attempts > 0),
  starts_at            timestamptz,           -- null = available once published
  ends_at              timestamptz,           -- null = no closing date
  status               text not null default 'draft'
                       check (status in ('draft','published','closed')),
  review_policy        text not null default 'immediate'
                       check (review_policy in ('immediate','after_close','never')),
  multi_select_scoring text not null default 'all_or_nothing'
                       check (multi_select_scoring in ('all_or_nothing','partial')),
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Questions & options
-- ---------------------------------------------------------------------------

create table if not exists public.exam_questions (
  id          bigint generated always as identity primary key,
  exam_id     bigint not null references public.exam_exams(id) on delete cascade,
  topic_id    bigint references public.exam_topics(id),
  type        text not null
              check (type in ('mcq_single','mcq_multi','true_false','text')),
  text        text not null,
  explanation text,
  image_url   text,
  marks       double precision not null default 1 check (marks > 0),
  difficulty  text not null default 'medium'
              check (difficulty in ('easy','medium','hard')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- NOTE: exam_options.is_correct is the answer key. Students must NEVER read
-- this table directly — they read the exam_options_public view below, which
-- omits is_correct. Direct SELECT on the table is admin-only (RLS, §6).
create table if not exists public.exam_options (
  id          bigint generated always as identity primary key,
  question_id bigint not null references public.exam_questions(id) on delete cascade,
  text        text not null,
  is_correct  boolean not null default false,
  sort_order  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- 4. Attempts & answers
-- ---------------------------------------------------------------------------

create table if not exists public.exam_attempts (
  id                    bigint generated always as identity primary key,
  exam_id               bigint not null references public.exam_exams(id),
  user_id               uuid not null references auth.users(id),
  status                text not null default 'in_progress'
                        check (status in ('in_progress','submitted','expired')),
  -- Server-authoritative timing: deadline_at is computed by the SERVER at
  -- start time (least of now + duration, exam.ends_at). The browser countdown
  -- is display-only; a changed device clock cannot extend the attempt.
  started_at            timestamptz not null default now(),
  deadline_at           timestamptz not null,
  submitted_at          timestamptz,
  -- Scores are written ONLY by the server-side grading step (security
  -- definer function / Edge Function). No client-supplied score is accepted.
  score                 double precision,
  max_score             double precision,
  percentage            double precision,
  passed                boolean,
  correct_count         integer,
  incorrect_count       integer,
  unanswered_count      integer,
  pending_grading_count integer not null default 0,
  time_used_seconds     integer
);

create table if not exists public.exam_answers (
  id                   bigint generated always as identity primary key,
  attempt_id           bigint not null references public.exam_attempts(id) on delete cascade,
  question_id          bigint not null references public.exam_questions(id),
  selected_option_ids  jsonb,               -- number[] of exam_options.id
  text_answer          text,
  is_correct           boolean,             -- null = pending manual grading
  marks_awarded        double precision not null default 0,
  graded_by            uuid references auth.users(id),
  unique (attempt_id, question_id)          -- no duplicate answers
);

create index if not exists exam_attempts_user_idx    on public.exam_attempts(user_id);
create index if not exists exam_attempts_exam_idx    on public.exam_attempts(exam_id);
create index if not exists exam_questions_exam_idx   on public.exam_questions(exam_id);
create index if not exists exam_answers_attempt_idx  on public.exam_answers(attempt_id);

-- ---------------------------------------------------------------------------
-- 5. Public option view (answer key stripped)
-- ---------------------------------------------------------------------------

create or replace view public.exam_options_public
with (security_invoker = true) as
  select id, question_id, text, sort_order
  from public.exam_options;

-- ---------------------------------------------------------------------------
-- 6. Row-Level Security (never disable)
-- ---------------------------------------------------------------------------

alter table public.exam_subjects  enable row level security;
alter table public.exam_topics    enable row level security;
alter table public.exam_exams     enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_options   enable row level security;
alter table public.exam_attempts  enable row level security;
alter table public.exam_answers   enable row level security;

-- Reference data: readable by every signed-in user, writable by admins only.
create policy exam_subjects_read  on public.exam_subjects
  for select to authenticated using (true);
create policy exam_subjects_admin on public.exam_subjects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy exam_topics_read  on public.exam_topics
  for select to authenticated using (true);
create policy exam_topics_admin on public.exam_topics
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Exams: students can only see published/closed exams; admins see everything.
create policy exam_exams_read on public.exam_exams
  for select to authenticated
  using (status in ('published','closed') or public.is_admin());
create policy exam_exams_admin on public.exam_exams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Questions: readable when the parent exam is visible; admin-managed.
-- (is_correct lives on exam_options, not here, so reading questions is safe.)
create policy exam_questions_read on public.exam_questions
  for select to authenticated
  using (exists (select 1 from public.exam_exams e
                 where e.id = exam_id
                   and (e.status in ('published','closed') or public.is_admin())));
create policy exam_questions_admin on public.exam_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Options WITH the answer key: admins only. Students use exam_options_public.
create policy exam_options_admin on public.exam_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Attempts: a student sees and creates only their own; admins see all.
-- UPDATE/DELETE by students is NOT granted — finalization (status, score)
-- happens exclusively inside the server-side grading function, which runs
-- as security definer and therefore bypasses RLS.
create policy exam_attempts_own_read on public.exam_attempts
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy exam_attempts_own_insert on public.exam_attempts
  for insert to authenticated with check (auth.uid() = user_id);

-- Answers: a student reads/upserts answers to their own IN-PROGRESS attempt
-- only; grading fields (is_correct, marks_awarded, graded_by) are written by
-- the server-side grading path or by admins in the grading UI.
create policy exam_answers_own_read on public.exam_answers
  for select to authenticated
  using (exists (select 1 from public.exam_attempts a
                 where a.id = attempt_id
                   and (a.user_id = auth.uid() or public.is_admin())));
create policy exam_answers_own_write on public.exam_answers
  for insert to authenticated
  with check (exists (select 1 from public.exam_attempts a
                      where a.id = attempt_id
                        and a.user_id = auth.uid()
                        and a.status = 'in_progress'));
create policy exam_answers_own_update on public.exam_answers
  for update to authenticated
  using (exists (select 1 from public.exam_attempts a
                 where a.id = attempt_id
                   and a.user_id = auth.uid()
                   and a.status = 'in_progress'))
  with check (exists (select 1 from public.exam_attempts a
                      where a.id = attempt_id
                        and a.user_id = auth.uid()
                        and a.status = 'in_progress'));
create policy exam_answers_admin on public.exam_answers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- 7. REMAINING WORK FOR THE MIGRATION PHASE (not part of this DDL)
--
--   a) Port api/lib/grading.ts (finalizeAttempt, mcq scoring, partial multi-
--      select scoring, SUBMIT_GRACE_MS, lazy expiry) to a Postgres function
--      `submit_exam_attempt(attempt_id bigint)` declared SECURITY DEFINER so
--      scoring and deadline enforcement stay server-side, or to an Edge
--      Function called with the user's JWT. The browser must continue to
--      send only answers — never scores.
--   b) Port `start` (deadline = least(now + duration, ends_at), max-attempts
--      and window checks) the same way, so deadline_at can never be set by
--      the client.
--   c) Reuse the existing Google sign-in (client 66022508435-...) — no new
--      auth mechanism, and no fake admin mechanism: admin = is_admin().
--   d) Review-policy gating (immediate / after_close / never) must be
--      enforced in the results query path before returning is_correct or
--      explanations to the browser.
-- ============================================================================
