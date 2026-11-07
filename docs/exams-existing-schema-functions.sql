-- Secure RPCs for the existing exams_* tables.
-- No tables are created or altered. Run in Supabase SQL Editor.

create or replace function public.exams_start_attempt(p_exam uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.exams_exams e
    where e.id = p_exam
      and e.is_published
  ) then
    raise exception 'exam unavailable';
  end if;

  insert into public.exams_attempts (user_id, exam_id, answers, started_at)
  values (v_user_id, p_exam, '{}'::jsonb, now())
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

create or replace function public.exams_save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_choice integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.exams_attempts%rowtype;
  v_duration integer;
  v_options jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select a.*
    into v_attempt
  from public.exams_attempts a
  where a.id = p_attempt_id
    and a.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'attempt not found';
  end if;
  if v_attempt.finished_at is not null then
    raise exception 'attempt already submitted';
  end if;

  select e.duration_minutes, q.options
    into v_duration, v_options
  from public.exams_questions q
  join public.exams_exams e on e.id = q.exam_id
  where q.id = p_question_id
    and q.exam_id = v_attempt.exam_id;

  if not found then
    raise exception 'question not found for this exam';
  end if;
  if v_attempt.started_at + make_interval(mins => coalesce(v_duration, 15)) + interval '90 seconds' < now() then
    raise exception 'exam time expired';
  end if;
  if jsonb_typeof(v_options) is distinct from 'array' then
    raise exception 'question options must be a JSON array';
  end if;
  if p_choice is null
     or p_choice < 0
     or p_choice >= jsonb_array_length(v_options) then
    raise exception 'invalid answer choice';
  end if;

  update public.exams_attempts
  set answers = coalesce(answers, '{}'::jsonb)
               || jsonb_build_object(p_question_id::text, p_choice)
  where id = p_attempt_id;
end;
$$;

create or replace function public.exams_submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.exams_attempts%rowtype;
  v_total integer;
  v_score integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select a.*
    into v_attempt
  from public.exams_attempts a
  where a.id = p_attempt_id
    and a.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'attempt not found';
  end if;

  if v_attempt.finished_at is null then
    select count(*)::integer,
           count(*) filter (
             where case
               when coalesce(v_attempt.answers ->> q.id::text, '') ~ '^[0-9]+$'
               then (v_attempt.answers ->> q.id::text)::integer = k.correct_index
               else false
             end
           )::integer
      into v_total, v_score
    from public.exams_questions q
    left join public.exams_answer_keys k on k.question_id = q.id
    where q.exam_id = v_attempt.exam_id;

    update public.exams_attempts
    set score = coalesce(v_score, 0),
        finished_at = now()
    where id = p_attempt_id
    returning * into v_attempt;
  end if;

  select count(*)::integer
    into v_total
  from public.exams_questions q
  where q.exam_id = v_attempt.exam_id;

  return jsonb_build_object(
    'score', coalesce(v_attempt.score, 0),
    'max', v_total
  );
end;
$$;

create or replace function public.exams_get_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.exams_attempts%rowtype;
  v_exam public.exams_exams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select a.*
    into v_attempt
  from public.exams_attempts a
  where a.id = p_attempt_id
    and a.user_id = auth.uid();

  if not found then
    raise exception 'attempt not found';
  end if;

  select e.*
    into v_exam
  from public.exams_exams e
  where e.id = v_attempt.exam_id;

  if v_attempt.finished_at is null
     and v_exam.duration_minutes is not null
     and v_attempt.started_at + make_interval(mins => v_exam.duration_minutes) + interval '90 seconds' < now() then
    perform public.exams_submit_attempt(p_attempt_id);
    select a.* into v_attempt
    from public.exams_attempts a
    where a.id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'status', case when v_attempt.finished_at is null then 'in_progress' else 'submitted' end,
    'title', v_exam.title,
    'subject', v_exam.subject,
    'grade', v_exam.grade,
    'deadline', extract(epoch from (
      v_attempt.started_at + make_interval(mins => coalesce(v_exam.duration_minutes, 15))
    )) * 1000,
    'now', extract(epoch from now()) * 1000,
    'answers', coalesce(v_attempt.answers, '{}'::jsonb),
    'questions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'text', q.body,
            'options', q.options
          ) order by q.position, q.id
        ),
        '[]'::jsonb
      )
      from public.exams_questions q
      where q.exam_id = v_attempt.exam_id
    )
  );
end;
$$;

create or replace function public.exams_get_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.exams_attempts%rowtype;
  v_exam public.exams_exams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select a.*
    into v_attempt
  from public.exams_attempts a
  where a.id = p_attempt_id
    and a.user_id = auth.uid();

  if not found then
    raise exception 'attempt not found';
  end if;
  if v_attempt.finished_at is null then
    raise exception 'attempt not submitted';
  end if;

  select e.*
    into v_exam
  from public.exams_exams e
  where e.id = v_attempt.exam_id;

  return jsonb_build_object(
    'title', v_exam.title,
    'score', coalesce(v_attempt.score, 0),
    'max', (
      select count(*)::integer
      from public.exams_questions q
      where q.exam_id = v_attempt.exam_id
    ),
    'questions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'text', q.body,
            'options', q.options,
            'correct', k.correct_index,
            'answer', case
              when (v_attempt.answers ->> q.id::text) ~ '^[0-9]+$'
              then (v_attempt.answers ->> q.id::text)::integer
              else null
            end,
            'explanation', k.explanation
          ) order by q.position, q.id
        ),
        '[]'::jsonb
      )
      from public.exams_questions q
      left join public.exams_answer_keys k on k.question_id = q.id
      where q.exam_id = v_attempt.exam_id
    )
  );
end;
$$;

revoke all on function public.exams_start_attempt(uuid) from public, anon;
revoke all on function public.exams_save_answer(uuid, uuid, integer) from public, anon;
revoke all on function public.exams_submit_attempt(uuid) from public, anon;
revoke all on function public.exams_get_attempt(uuid) from public, anon;
revoke all on function public.exams_get_result(uuid) from public, anon;

grant execute on function public.exams_start_attempt(uuid) to authenticated;
grant execute on function public.exams_save_answer(uuid, uuid, integer) to authenticated;
grant execute on function public.exams_submit_attempt(uuid) to authenticated;
grant execute on function public.exams_get_attempt(uuid) to authenticated;
grant execute on function public.exams_get_result(uuid) to authenticated;
