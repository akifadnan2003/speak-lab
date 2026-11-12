-- =============================================================================================
-- M6: tutor workspace. Assignments (homework), per-student submissions with feedback, and
-- private teacher notes. Additive only. Design: docs/superpowers/specs/2026-11-12-m6-tutor-workspace-design.md
--
-- Trust model
--   * The tutor owns assignments and notes; students own their submission text and nothing else.
--   * Every status transition and every timestamp is set by a trigger or by the
--     `complete_assignment` function, never taken from the client.
--   * Lesson and vocabulary homework can only be completed by `complete_assignment`, which
--     verifies the learner's own records (lesson_progress / assessment_attempts / vocabulary_reviews).
--   * Teacher notes have no student-facing policy at all.
-- =============================================================================================

create type public.assignment_kind as enum ('lesson', 'vocabulary', 'written');
create type public.assignment_status as enum ('draft', 'published', 'cancelled');
create type public.submission_status as enum ('assigned', 'in_progress', 'submitted', 'reviewed');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  kind public.assignment_kind not null,
  title text not null,
  instructions text not null default '',
  chapter_id text,
  lesson_id text,
  -- lesson kind only: the lesson is a chapter check and must be *passed*, not merely attempted.
  requires_pass boolean not null default false,
  review_target integer,
  due_at timestamptz,
  status public.assignment_status not null default 'draft',
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint assignments_instructions_length check (char_length(instructions) <= 4000),
  constraint assignments_chapter_id check (chapter_id is null or chapter_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint assignments_lesson_id check (lesson_id is null or lesson_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint assignments_lesson_target check (
    (kind = 'lesson' and chapter_id is not null and lesson_id is not null and review_target is null)
    or (kind = 'vocabulary' and chapter_id is null and lesson_id is null and review_target between 1 and 500)
    or (kind = 'written' and chapter_id is null and lesson_id is null and review_target is null and requires_pass = false)
  ),
  constraint assignments_published_state check ((status = 'draft') = (published_at is null)),
  constraint assignments_cancelled_state check ((status = 'cancelled') = (cancelled_at is not null))
);
comment on table public.assignments is 'Homework created by the tutor. Status and timestamps are trigger-managed.';
create index assignments_tutor_idx on public.assignments (tutor_id, created_at desc);
create trigger assignments_set_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

create table public.assignment_recipients (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.submission_status not null default 'assigned',
  draft_text text not null default '',
  submitted_text text,
  -- Server-computed completion evidence for lesson/vocabulary homework (never client-written).
  evidence jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  returned_at timestamptz,
  late boolean not null default false,
  feedback text,
  feedback_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id),
  constraint assignment_recipients_draft_length check (char_length(draft_text) <= 8000),
  constraint assignment_recipients_submitted_length check (submitted_text is null or char_length(submitted_text) <= 8000),
  constraint assignment_recipients_feedback_length check (feedback is null or char_length(feedback) <= 4000),
  constraint assignment_recipients_evidence_object check (evidence is null or jsonb_typeof(evidence) = 'object'),
  constraint assignment_recipients_submitted_state check (status not in ('submitted', 'reviewed') or submitted_at is not null),
  constraint assignment_recipients_reviewed_state check ((status = 'reviewed') = (reviewed_at is not null))
);
comment on table public.assignment_recipients is 'One row per assignment and student: the submission, its evidence and the tutor''s feedback.';
create index assignment_recipients_student_idx on public.assignment_recipients (student_id, status);
create index assignment_recipients_assignment_idx on public.assignment_recipients (assignment_id);
create trigger assignment_recipients_set_updated_at before update on public.assignment_recipients
  for each row execute function public.set_updated_at();

create table public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  topic text not null default 'general',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_notes_body_length check (char_length(btrim(body)) between 1 and 4000),
  constraint teacher_notes_topic check (
    topic in ('general', 'grammar', 'vocabulary', 'pronunciation', 'speaking', 'listening', 'reading', 'writing', 'behaviour', 'planning')
  ),
  constraint teacher_notes_priority check (priority in ('normal', 'high'))
);
comment on table public.teacher_notes is 'Private notes the tutor keeps about a linked student. No student-facing policy exists.';
create index teacher_notes_student_idx on public.teacher_notes (student_id, created_at desc);
create trigger teacher_notes_set_updated_at before update on public.teacher_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Audit events
-- ---------------------------------------------------------------------------------------------
alter table public.account_events drop constraint account_events_type;
alter table public.account_events add constraint account_events_type check (
  event_type in (
    'owner_bootstrapped',
    'invitation_sent',
    'invitation_resent',
    'invitation_revoked',
    'invitation_accepted',
    'account_created',
    'account_disabled',
    'account_reactivated',
    'onboarding_completed',
    'chapter_override_set',
    'chapter_override_cleared',
    'assessment_submitted',
    'assessment_reset',
    'assignment_published',
    'assignment_cancelled',
    'assignment_submitted',
    'assignment_returned',
    'assignment_reviewed'
  )
);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- True inside a request made with the service role (Edge Functions, tests). Clients cannot
-- forge this: PostgREST derives the claims from the verified JWT.
create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role';
$$;
revoke all on function public.is_service_role() from public, anon, authenticated;
grant execute on function public.is_service_role() to authenticated, service_role;

-- Cross-table checks used by the policies below. They run as the definer so a policy on one
-- table can look at the other without re-entering that table's policies (which would recurse).
create or replace function public.assignment_owner(p_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.tutor_id from public.assignments a where a.id = p_assignment_id;
$$;
revoke all on function public.assignment_owner(uuid) from public, anon, authenticated;
grant execute on function public.assignment_owner(uuid) to authenticated, service_role;

create or replace function public.is_assignment_recipient(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assignment_recipients r
    where r.assignment_id = p_assignment_id and r.student_id = (select auth.uid())
  );
$$;
revoke all on function public.is_assignment_recipient(uuid) from public, anon, authenticated;
grant execute on function public.is_assignment_recipient(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- assignments: ownership, transitions, immutability, server timestamps
-- ---------------------------------------------------------------------------------------------
create or replace function public.assignments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_submitted integer;
begin
  if public.is_service_role() then
    return new;
  end if;
  if not public.is_tutor() then
    raise exception 'only the tutor can manage assignments' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.tutor_id <> v_caller then
      raise exception 'assignments belong to the signed-in tutor' using errcode = '42501';
    end if;
    if new.status = 'cancelled' then
      raise exception 'a new assignment cannot start cancelled' using errcode = '22023';
    end if;
    new.published_at := case when new.status = 'published' then now() else null end;
    new.cancelled_at := null;
    return new;
  end if;

  -- UPDATE
  if old.tutor_id <> v_caller then
    raise exception 'not your assignment' using errcode = '42501';
  end if;
  if new.id <> old.id or new.tutor_id <> old.tutor_id or new.created_at <> old.created_at or new.kind <> old.kind then
    raise exception 'id, owner and kind cannot change' using errcode = '22023';
  end if;
  if old.status = 'cancelled' then
    raise exception 'a cancelled assignment cannot be changed' using errcode = '22023';
  end if;
  if old.status = 'published' and (
    new.chapter_id is distinct from old.chapter_id
    or new.lesson_id is distinct from old.lesson_id
    or new.requires_pass <> old.requires_pass
    or new.review_target is distinct from old.review_target
  ) then
    raise exception 'the target of a published assignment cannot change' using errcode = '22023';
  end if;
  select count(*) into v_submitted
  from public.assignment_recipients r
  where r.assignment_id = old.id and r.status in ('submitted', 'reviewed');
  if v_submitted > 0 and (new.title <> old.title or new.instructions <> old.instructions or new.due_at is distinct from old.due_at) then
    raise exception 'work has been submitted; cancel the assignment instead of editing it' using errcode = '22023';
  end if;

  if new.status <> old.status then
    if old.status = 'draft' and new.status = 'published' then
      new.published_at := now();
      new.cancelled_at := null;
    elsif new.status = 'cancelled' then
      new.published_at := old.published_at;
      new.cancelled_at := now();
    else
      raise exception 'invalid assignment transition % -> %', old.status, new.status using errcode = '22023';
    end if;
  else
    new.published_at := old.published_at;
    new.cancelled_at := old.cancelled_at;
  end if;
  return new;
end;
$$;
revoke all on function public.assignments_guard() from public, anon, authenticated;

create trigger assignments_guard before insert or update on public.assignments
  for each row execute function public.assignments_guard();

-- Audit: publish/cancel per recipient (the student is the subject, the tutor the actor).
create or replace function public.log_assignment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status in ('published', 'cancelled') then
    insert into public.account_events (user_id, actor_id, event_type, metadata)
    select r.student_id, auth.uid(), ('assignment_' || new.status::text), jsonb_build_object('assignment_id', new.id, 'kind', new.kind, 'title', new.title)
    from public.assignment_recipients r
    where r.assignment_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.log_assignment_status() from public, anon, authenticated;

create trigger assignments_log_status after update on public.assignments
  for each row execute function public.log_assignment_status();

-- ---------------------------------------------------------------------------------------------
-- assignment_recipients: who may change which columns, and the submission lifecycle
-- ---------------------------------------------------------------------------------------------
create or replace function public.assignment_recipients_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_tutor boolean := public.is_tutor();
  a public.assignments%rowtype;
  v_student boolean;
begin
  -- `complete_assignment` performs its own checks and then updates on the student's behalf.
  if public.is_service_role() or coalesce(current_setting('speaklab.complete_assignment', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  select * into a from public.assignments x where x.id = coalesce(new.assignment_id, old.assignment_id);
  if a.id is null then
    -- Cascade from a deleted draft assignment: the parent is already gone.
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  if tg_op = 'DELETE' then
    if not (v_tutor and a.tutor_id = v_caller) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if a.status <> 'draft' then
      raise exception 'recipients can be removed only from a draft; cancel the assignment instead' using errcode = '22023';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not (v_tutor and a.tutor_id = v_caller) then
      raise exception 'only the assignment''s tutor can add recipients' using errcode = '42501';
    end if;
    if a.status = 'cancelled' then
      raise exception 'the assignment is cancelled' using errcode = '22023';
    end if;
    if not exists (select 1 from public.tutor_students ts where ts.tutor_id = v_caller and ts.student_id = new.student_id) then
      raise exception 'the student is not linked to you' using errcode = '42501';
    end if;
    new.status := 'assigned';
    new.draft_text := '';
    new.submitted_text := null;
    new.evidence := null;
    new.started_at := null;
    new.submitted_at := null;
    new.reviewed_at := null;
    new.returned_at := null;
    new.late := false;
    new.feedback := null;
    new.feedback_updated_at := null;
    return new;
  end if;

  -- UPDATE
  if new.assignment_id <> old.assignment_id or new.student_id <> old.student_id or new.created_at <> old.created_at then
    raise exception 'keys cannot change' using errcode = '22023';
  end if;
  v_student := (v_caller = old.student_id) and public.is_active() and not v_tutor;

  if v_student then
    if a.status <> 'published' then
      raise exception 'this assignment is not open' using errcode = '22023';
    end if;
    if new.feedback is distinct from old.feedback
      or new.feedback_updated_at is distinct from old.feedback_updated_at
      or new.evidence is distinct from old.evidence
      or new.submitted_text is distinct from old.submitted_text
      or new.started_at is distinct from old.started_at
      or new.submitted_at is distinct from old.submitted_at
      or new.reviewed_at is distinct from old.reviewed_at
      or new.returned_at is distinct from old.returned_at
      or new.late <> old.late then
      raise exception 'students may change only their draft and submit it' using errcode = '42501';
    end if;
    if old.status in ('submitted', 'reviewed') then
      raise exception 'submitted work cannot be changed unless the tutor returns it' using errcode = '22023';
    end if;
    if new.status = old.status then
      if new.draft_text <> old.draft_text and old.status = 'assigned' then
        new.status := 'in_progress';
        new.started_at := now();
      end if;
    elsif old.status = 'assigned' and new.status = 'in_progress' then
      new.started_at := now();
    elsif new.status = 'submitted' then
      if a.kind <> 'written' then
        raise exception 'lesson and vocabulary homework is completed from your learning records' using errcode = '22023';
      end if;
      if char_length(btrim(new.draft_text)) = 0 then
        raise exception 'write your answer before submitting' using errcode = '22023';
      end if;
      new.submitted_text := new.draft_text;
      new.submitted_at := now();
      new.started_at := coalesce(old.started_at, now());
      new.late := a.due_at is not null and now() > a.due_at;
    else
      raise exception 'invalid submission transition % -> %', old.status, new.status using errcode = '22023';
    end if;
    return new;
  end if;

  if v_tutor and a.tutor_id = v_caller then
    if new.draft_text <> old.draft_text
      or new.submitted_text is distinct from old.submitted_text
      or new.evidence is distinct from old.evidence
      or new.started_at is distinct from old.started_at
      or new.submitted_at is distinct from old.submitted_at
      or new.late <> old.late then
      raise exception 'the tutor cannot change the student''s work' using errcode = '42501';
    end if;
    if new.feedback is distinct from old.feedback then
      new.feedback_updated_at := now();
    else
      new.feedback_updated_at := old.feedback_updated_at;
    end if;
    if new.status <> old.status then
      if old.status = 'submitted' and new.status = 'reviewed' then
        new.reviewed_at := now();
        new.returned_at := old.returned_at;
      elsif old.status in ('submitted', 'reviewed') and new.status = 'in_progress' then
        new.returned_at := now();
        new.reviewed_at := null;
        new.late := false;
      else
        raise exception 'invalid review transition % -> %', old.status, new.status using errcode = '22023';
      end if;
    else
      new.reviewed_at := old.reviewed_at;
      new.returned_at := old.returned_at;
    end if;
    return new;
  end if;

  raise exception 'not allowed' using errcode = '42501';
end;
$$;
revoke all on function public.assignment_recipients_guard() from public, anon, authenticated;

create trigger assignment_recipients_guard before insert or update or delete on public.assignment_recipients
  for each row execute function public.assignment_recipients_guard();

create or replace function public.log_submission_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if new.status = old.status then
    return new;
  end if;
  v_event := case
    when new.status = 'submitted' then 'assignment_submitted'
    when new.status = 'reviewed' then 'assignment_reviewed'
    when new.status = 'in_progress' and old.status in ('submitted', 'reviewed') then 'assignment_returned'
    else null
  end;
  if v_event is not null then
    insert into public.account_events (user_id, actor_id, event_type, metadata)
    values (new.student_id, auth.uid(), v_event, jsonb_build_object('assignment_id', new.assignment_id, 'late', new.late));
  end if;
  return new;
end;
$$;
revoke all on function public.log_submission_status() from public, anon, authenticated;

create trigger assignment_recipients_log_status after update on public.assignment_recipients
  for each row execute function public.log_submission_status();

-- ---------------------------------------------------------------------------------------------
-- complete_assignment: lesson and vocabulary homework is completed only against real records
-- ---------------------------------------------------------------------------------------------
create or replace function public.complete_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  a public.assignments%rowtype;
  r public.assignment_recipients%rowtype;
  v_evidence jsonb := null;
  v_progress jsonb := '{}'::jsonb;
  v_count integer;
  lp record;
  aa record;
begin
  if v_student is null or not public.is_active() or public.is_tutor() then
    raise exception 'only an active student can complete homework' using errcode = '42501';
  end if;
  select * into a from public.assignments x where x.id = p_assignment_id;
  select * into r from public.assignment_recipients x where x.assignment_id = p_assignment_id and x.student_id = v_student;
  if a.id is null or r.student_id is null then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;
  if r.status in ('submitted', 'reviewed') then
    return jsonb_build_object('completed', true, 'status', r.status, 'evidence', r.evidence, 'already', true);
  end if;
  if a.status <> 'published' then
    raise exception 'this assignment is not open' using errcode = '22023';
  end if;

  if a.kind = 'lesson' then
    if a.requires_pass then
      select x.score, x.pass_mark, x.submitted_at into aa
      from public.assessment_attempts x
      where x.student_id = v_student and x.chapter_id = a.chapter_id and x.lesson_id = a.lesson_id
        and x.status = 'submitted' and x.passed
      order by x.submitted_at desc limit 1;
      if aa.submitted_at is not null then
        v_evidence := jsonb_build_object('type', 'chapter_check_passed', 'score', aa.score, 'pass_mark', aa.pass_mark, 'at', aa.submitted_at);
      else
        select x.score, x.submitted_at into aa
        from public.assessment_attempts x
        where x.student_id = v_student and x.chapter_id = a.chapter_id and x.lesson_id = a.lesson_id and x.status = 'submitted'
        order by x.submitted_at desc limit 1;
        v_progress := jsonb_build_object('best_score', aa.score, 'attempted', aa.submitted_at is not null);
      end if;
    else
      select x.completed_at, x.best_score into lp
      from public.lesson_progress x
      where x.student_id = v_student and x.chapter_id = a.chapter_id and x.lesson_id = a.lesson_id and x.status = 'completed';
      if lp.completed_at is not null then
        v_evidence := jsonb_build_object('type', 'lesson_completed', 'best_score', lp.best_score, 'at', lp.completed_at);
      else
        select x.status into lp from public.lesson_progress x
        where x.student_id = v_student and x.chapter_id = a.chapter_id and x.lesson_id = a.lesson_id;
        v_progress := jsonb_build_object('lesson_status', coalesce(lp.status::text, 'not_started'));
      end if;
    end if;
  elsif a.kind = 'vocabulary' then
    select count(*) into v_count
    from public.vocabulary_reviews vr
    where vr.student_id = v_student and vr.voided_at is null and vr.reviewed_at >= a.published_at;
    if v_count >= a.review_target then
      v_evidence := jsonb_build_object('type', 'vocabulary_reviews', 'count', v_count, 'target', a.review_target, 'since', a.published_at);
    else
      v_progress := jsonb_build_object('count', v_count, 'target', a.review_target);
    end if;
  else
    raise exception 'written homework is submitted with your text' using errcode = '22023';
  end if;

  if v_evidence is null then
    return jsonb_build_object('completed', false, 'status', r.status, 'progress', v_progress);
  end if;

  perform set_config('speaklab.complete_assignment', 'on', true);
  update public.assignment_recipients x
  set status = 'submitted',
      evidence = v_evidence,
      submitted_at = now(),
      started_at = coalesce(x.started_at, now()),
      late = (a.due_at is not null and now() > a.due_at)
  where x.assignment_id = p_assignment_id and x.student_id = v_student;
  perform set_config('speaklab.complete_assignment', 'off', true);

  return jsonb_build_object('completed', true, 'status', 'submitted', 'evidence', v_evidence);
end;
$$;
revoke all on function public.complete_assignment(uuid) from public, anon;
grant execute on function public.complete_assignment(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------------------------
revoke all on public.assignments, public.assignment_recipients, public.teacher_notes from public, anon, authenticated;
grant select, insert, update, delete on public.assignments, public.assignment_recipients, public.teacher_notes to authenticated;
grant all on public.assignments, public.assignment_recipients, public.teacher_notes to service_role;

alter table public.assignments enable row level security;
alter table public.assignment_recipients enable row level security;
alter table public.teacher_notes enable row level security;

create policy "assignments: tutor reads own" on public.assignments
  for select to authenticated
  using (public.is_tutor() and tutor_id = (select auth.uid()));
create policy "assignments: tutor creates own" on public.assignments
  for insert to authenticated
  with check (public.is_tutor() and tutor_id = (select auth.uid()));
create policy "assignments: tutor updates own" on public.assignments
  for update to authenticated
  using (public.is_tutor() and tutor_id = (select auth.uid()))
  with check (public.is_tutor() and tutor_id = (select auth.uid()));
-- Only drafts can be deleted; anything published is cancelled instead so history survives.
create policy "assignments: tutor deletes own drafts" on public.assignments
  for delete to authenticated
  using (public.is_tutor() and tutor_id = (select auth.uid()) and status = 'draft');

create policy "assignments: student reads published ones addressed to them" on public.assignments
  for select to authenticated
  using (
    status <> 'draft'
    and public.is_active()
    and public.is_assignment_recipient(id)
  );

create policy "assignment_recipients: tutor manages own assignments" on public.assignment_recipients
  for all to authenticated
  using (public.is_tutor() and public.assignment_owner(assignment_id) = (select auth.uid()))
  with check (public.is_tutor() and public.assignment_owner(assignment_id) = (select auth.uid()));

create policy "assignment_recipients: student reads own row" on public.assignment_recipients
  for select to authenticated
  using (public.is_active() and student_id = (select auth.uid()));

create policy "assignment_recipients: student updates own row" on public.assignment_recipients
  for update to authenticated
  using (public.is_active() and student_id = (select auth.uid()))
  with check (public.is_active() and student_id = (select auth.uid()));

-- Private: only the tutor, only about linked students. No student-facing policy exists on purpose.
create policy "teacher_notes: tutor manages own notes about linked students" on public.teacher_notes
  for all to authenticated
  using (public.is_tutor() and tutor_id = (select auth.uid()) and public.tutor_of(student_id))
  with check (public.is_tutor() and tutor_id = (select auth.uid()) and public.tutor_of(student_id));
