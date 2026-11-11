-- SpeakLab · M4 · Vocabulary persistence, server-owned spaced repetition, RLS.
--
-- Design: docs/VOCABULARY_PERSISTENCE.md. Principles enforced here:
--   * Additive only. Nothing in the M2 identity migration is altered; its helpers
--     (`is_active()`, `is_tutor()`, `set_updated_at()`) are reused as they are.
--   * The server owns the schedule. Clients have SELECT only on every vocabulary table. The
--     single write path is `record_vocabulary_reviews()`, which derives the student from the
--     verified JWT (`auth.uid()`), validates each review, recomputes quality from the mode and
--     answer flags, and runs the SM-2-style transition in SQL. Client-computed quality, interval,
--     stage or mastery values are ignored.
--   * Reviews are idempotent: the client-generated review id is the primary key. A replayed id
--     returns `duplicate`; an id owned by another student is rejected without revealing anything.
--   * Ordering is monotonic per word: a review at or before the word's `last_reviewed_at`, or
--     at or before the student's last reset, is stored as history (`applied = false`) and never
--     rewinds or replays the schedule. That rule covers offline queues, a second device and the
--     local-to-cloud import alike.
--   * Students read only their own rows; the tutor reads linked students' rows; disabled
--     accounts read nothing. Anonymous visitors have no grants at all.
--   * `correct` is still asserted by the client (vocabulary practice is graded in the browser).
--     This is formative practice data, not an official assessment; see the design doc.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.vocabulary_stage as enum ('new', 'learning', 'review', 'mastered');
create type public.vocabulary_skill as enum ('recognition', 'recall', 'spoken');

-- ---------------------------------------------------------------------------------------------
-- Bank (versioned content mirror; rows come from generated `*_vocabulary_bank_v<N>.sql`)
-- ---------------------------------------------------------------------------------------------
create table public.vocabulary_items (
  entry_id text primary key,
  term text not null,
  level text not null,
  topics text[] not null default '{}',
  -- Curriculum chapter ids that teach this word (e.g. 'a0-01'). Deliberately not a foreign key:
  -- curriculum tables belong to the M3 integration; see the design doc, "Follow-up".
  chapter_ids text[] not null default '{}',
  bank_version integer not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_items_entry_id_format check (entry_id ~ '^v-[a-z0-9]+(-[a-z0-9]+)*$' and char_length(entry_id) <= 80),
  constraint vocabulary_items_term_length check (char_length(term) between 1 and 120),
  constraint vocabulary_items_level check (level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1')),
  constraint vocabulary_items_bank_version check (bank_version >= 1)
);
comment on table public.vocabulary_items is 'Server mirror of the bundled vocabulary bank (ids, level, chapters). Content text stays in the app bundle.';
create index vocabulary_items_chapter_ids_idx on public.vocabulary_items using gin (chapter_ids);

-- ---------------------------------------------------------------------------------------------
-- Per-student word state (one row per student × word, written only by the review function)
-- ---------------------------------------------------------------------------------------------
create table public.student_vocabulary (
  student_id uuid not null references public.profiles (id) on delete cascade,
  entry_id text not null references public.vocabulary_items (entry_id) on delete restrict,
  stage public.vocabulary_stage not null default 'new',
  ease numeric(4, 2) not null default 2.50,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  recall_streak integer not null default 0,
  lapses integer not null default 0,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  first_learned_at timestamptz,
  last_result_correct boolean,
  recognition_correct integer not null default 0,
  recognition_incorrect integer not null default 0,
  recall_correct integer not null default 0,
  recall_incorrect integer not null default 0,
  spoken_count integer not null default 0,
  review_count integer not null default 0,
  last_review_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, entry_id),
  constraint student_vocabulary_ease_range check (ease between 1.30 and 3.00),
  constraint student_vocabulary_non_negative check (
    interval_days >= 0 and repetitions >= 0 and recall_streak >= 0 and lapses >= 0
    and recognition_correct >= 0 and recognition_incorrect >= 0 and recall_correct >= 0
    and recall_incorrect >= 0 and spoken_count >= 0 and review_count >= 0
  )
);
comment on table public.student_vocabulary is 'Spaced-repetition state per student and word. Server-computed; clients have SELECT only.';
create index student_vocabulary_due_idx on public.student_vocabulary (student_id, due_at);

create trigger student_vocabulary_set_updated_at before update on public.student_vocabulary
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Review history (append-only for clients; voided, never deleted, by a reset)
-- ---------------------------------------------------------------------------------------------
create table public.vocabulary_reviews (
  -- Client-generated idempotency key (crypto.randomUUID(), or the app's `rev-…` fallback).
  id text primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  entry_id text not null references public.vocabulary_items (entry_id) on delete restrict,
  mode_id text not null,
  skill public.vocabulary_skill not null,
  correct boolean not null,
  -- Server-derived SM-2 quality (0–5); the client's own value is ignored.
  quality smallint not null,
  hint_used boolean not null default false,
  self_grade text,
  answer text,
  -- When the learner answered (client clock, validated and clamped to the server clock).
  reviewed_at timestamptz not null,
  -- When the server accepted it.
  received_at timestamptz not null default now(),
  source text not null default 'live',
  -- Whether this review moved the schedule (false: older than the word's latest review or reset).
  applied boolean not null,
  stage_after public.vocabulary_stage not null,
  interval_days_after integer not null,
  due_at_after timestamptz,
  voided_at timestamptz,
  constraint vocabulary_reviews_id_format check (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  constraint vocabulary_reviews_quality check (quality between 0 and 5),
  constraint vocabulary_reviews_self_grade check (self_grade is null or self_grade in ('again', 'hard', 'good', 'easy')),
  constraint vocabulary_reviews_answer_length check (answer is null or char_length(answer) <= 200),
  constraint vocabulary_reviews_source check (source in ('live', 'import'))
);
comment on table public.vocabulary_reviews is 'Every vocabulary answer, keyed by a client idempotency id. Written only by record_vocabulary_reviews().';
create index vocabulary_reviews_student_time_idx on public.vocabulary_reviews (student_id, reviewed_at desc);
create index vocabulary_reviews_student_entry_idx on public.vocabulary_reviews (student_id, entry_id, reviewed_at desc);

-- Per-student vocabulary metadata: the reset watermark.
create table public.vocabulary_student_meta (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  reset_at timestamptz,
  reset_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger vocabulary_student_meta_set_updated_at before update on public.vocabulary_student_meta
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Pure helpers (internal: not executable by clients)
-- ---------------------------------------------------------------------------------------------

-- Practice mode → the skill it exercises. Mirrors `src/features/vocabulary/modes/index.ts`.
-- The server, not the client, decides which modes count as active recall (which drives mastery).
create or replace function public.vocabulary_mode_skill(p_mode text)
returns public.vocabulary_skill
language sql
immutable
set search_path = ''
as $$
  select case p_mode
    when 'flashcards' then 'recognition'
    when 'meaning_choice' then 'recognition'
    when 'matching' then 'recognition'
    when 'sentence_completion' then 'recognition'
    when 'listening' then 'recognition'
    when 'missing_word' then 'recall'
    when 'active_recall' then 'recall'
    when 'speaking' then 'spoken'
    else null
  end::public.vocabulary_skill;
$$;

-- SM-2 quality, identical to `qualityFor()` in src/features/vocabulary/srs/scheduler.ts.
create or replace function public.vocabulary_review_quality(
  p_skill public.vocabulary_skill,
  p_correct boolean,
  p_hint_used boolean,
  p_self_grade text
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_self_grade = 'again' then 1
    when p_self_grade = 'hard' then 3
    when p_self_grade = 'good' then 4
    when p_self_grade = 'easy' then 5
    when not p_correct then 1
    when p_skill in ('recall', 'spoken') then (case when p_hint_used then 4 else 5 end)
    else 4
  end;
$$;

-- `Math.round(x * 100) / 100` clamped to [1.3, 3.0], in IEEE double precision exactly like the
-- browser (floor(x + 0.5) is JavaScript's Math.round for positive numbers).
create or replace function public.vocabulary_clamp_ease(p_ease double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select least(3.0::double precision, greatest(1.3::double precision, floor(p_ease * 100 + 0.5) / 100));
$$;

-- Lenient ISO-8601 parse: null instead of an error, so one bad review cannot abort a batch.
create or replace function public.vocabulary_parse_instant(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}T' then
    return null;
  end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

-- The SM-2-style transition. A line-for-line port of `schedule()` in
-- src/features/vocabulary/srs/scheduler.ts; `scheduler.sql-parity.test.ts` replays the same
-- review sequences through both and requires identical results.
-- Days are 24-hour multiples (`interval '24 hours'`), never calendar days, so the due instant
-- does not depend on the session time zone or daylight-saving transitions.
create or replace function public.vocabulary_schedule(
  p_state public.student_vocabulary,
  p_skill public.vocabulary_skill,
  p_quality integer,
  p_at timestamptz
)
returns public.student_vocabulary
language plpgsql
immutable
set search_path = ''
as $$
declare
  s public.student_vocabulary := p_state;
  v_correct boolean := p_quality >= 3;
  v_q double precision := 5 - p_quality;
  v_prev_interval integer := p_state.interval_days;
  v_ease double precision;
  v_reps integer;
  v_interval integer;
  v_streak integer;
begin
  if p_skill = 'recognition' then
    if v_correct then s.recognition_correct := s.recognition_correct + 1;
    else s.recognition_incorrect := s.recognition_incorrect + 1; end if;
  elsif p_skill = 'recall' then
    if v_correct then s.recall_correct := s.recall_correct + 1;
    else s.recall_incorrect := s.recall_incorrect + 1; end if;
  else
    s.spoken_count := s.spoken_count + 1;
  end if;
  s.review_count := s.review_count + 1;
  s.last_reviewed_at := p_at;
  s.first_learned_at := coalesce(s.first_learned_at, p_at);

  if not v_correct then
    if s.stage in ('review', 'mastered') then
      s.lapses := s.lapses + 1;
    end if;
    s.stage := 'learning';
    s.ease := public.vocabulary_clamp_ease(s.ease::double precision - 0.2);
    s.interval_days := 1;
    s.repetitions := 0;
    s.recall_streak := 0;
    s.due_at := p_at + interval '24 hours';
    s.last_result_correct := false;
    return s;
  end if;

  v_reps := s.repetitions + 1;
  v_ease := public.vocabulary_clamp_ease(s.ease::double precision + 0.1 - v_q * (0.08 + v_q * 0.02));
  v_interval := case v_reps
    when 1 then 1
    when 2 then 3
    when 3 then 6
    else greatest(7, floor(v_prev_interval::double precision * v_ease + 0.5)::integer)
  end;
  -- "Hard" keeps the item close: never more than a 1.2× stretch.
  if p_quality = 3 and v_reps > 1 then
    v_interval := greatest(1, least(v_interval, floor(v_prev_interval::double precision * 1.2 + 0.5)::integer));
  end if;
  v_streak := case when p_skill = 'recognition' then s.recall_streak else s.recall_streak + 1 end;

  if v_interval >= 21 and v_streak >= 3 then
    s.stage := 'mastered';
  elsif s.stage = 'mastered' then
    s.stage := 'mastered';
  elsif v_reps >= 3 then
    s.stage := 'review';
  else
    s.stage := 'learning';
  end if;

  s.ease := v_ease;
  s.interval_days := v_interval;
  s.repetitions := v_reps;
  s.recall_streak := v_streak;
  s.due_at := p_at + v_interval * interval '24 hours';
  s.last_result_correct := true;
  return s;
end;
$$;

revoke all on function public.vocabulary_mode_skill(text) from public, anon, authenticated;
revoke all on function public.vocabulary_review_quality(public.vocabulary_skill, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.vocabulary_clamp_ease(double precision) from public, anon, authenticated;
revoke all on function public.vocabulary_parse_instant(text) from public, anon, authenticated;
revoke all on function public.vocabulary_schedule(public.student_vocabulary, public.vocabulary_skill, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.vocabulary_mode_skill(text) to service_role;
grant execute on function public.vocabulary_review_quality(public.vocabulary_skill, boolean, boolean, text) to service_role;
grant execute on function public.vocabulary_clamp_ease(double precision) to service_role;
grant execute on function public.vocabulary_parse_instant(text) to service_role;
grant execute on function public.vocabulary_schedule(public.student_vocabulary, public.vocabulary_skill, integer, timestamptz) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Write path: record a batch of reviews for the signed-in student
-- ---------------------------------------------------------------------------------------------
--
-- p_expected_student: the account the client queued these reviews under. It is never used to
--   authorize anything (the student is always auth.uid()); it can only make the call fail, which
--   stops a queue written under account A from being flushed into account B after a switch.
-- p_reviews: JSON array (1–500) of
--   { id, entry_id, mode_id, skill?, correct, hint_used?, self_grade?, answer?, reviewed_at }.
-- p_source: 'live' (practice sessions and their offline queue) or 'import' (consented upload of
--   device-local history). Both follow exactly the same rules.
--
-- Returns { results: [{ id, status, reason? }], states: [student_vocabulary rows touched],
--           reset_at }. status ∈ applied | recorded | duplicate | rejected.
create or replace function public.record_vocabulary_reviews(
  p_expected_student uuid,
  p_reviews jsonb,
  p_source text default 'live'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_status public.account_status;
  v_created_at timestamptz;
  v_reset_at timestamptz;
  v_now timestamptz := now();
  v_item jsonb;
  v_results jsonb := '[]'::jsonb;
  v_touched text[] := '{}';
  v_reason text;
  v_id text;
  v_entry text;
  v_mode text;
  v_skill public.vocabulary_skill;
  v_correct boolean;
  v_hint boolean;
  v_self text;
  v_answer text;
  v_at timestamptz;
  v_quality integer;
  v_state public.student_vocabulary;
  v_next public.student_vocabulary;
  v_created boolean;
  v_owner uuid;
  v_applied boolean;
  v_voided timestamptz;
  v_states jsonb;
begin
  if v_uid is null then
    raise exception 'vocabulary: not authenticated' using errcode = '42501';
  end if;
  if p_expected_student is distinct from v_uid then
    raise exception 'vocabulary: these reviews were recorded under a different account' using errcode = '42501';
  end if;

  select p.role, p.status, p.created_at into v_role, v_status, v_created_at
    from public.profiles p where p.id = v_uid;
  if not found or v_role <> 'student' or v_status <> 'active' then
    raise exception 'vocabulary: only active students can record vocabulary reviews' using errcode = '42501';
  end if;

  if p_source is null or p_source not in ('live', 'import') then
    raise exception 'vocabulary: unknown source' using errcode = '22023';
  end if;
  if p_reviews is null or jsonb_typeof(p_reviews) <> 'array'
    or jsonb_array_length(p_reviews) = 0 or jsonb_array_length(p_reviews) > 500 then
    raise exception 'vocabulary: expected an array of 1 to 500 reviews' using errcode = '22023';
  end if;

  select m.reset_at into v_reset_at from public.vocabulary_student_meta m where m.student_id = v_uid;

  -- Chronological order, so a batch replays exactly as the learner answered.
  for v_item in
    select e.value
    from jsonb_array_elements(p_reviews) as e(value)
    order by public.vocabulary_parse_instant(e.value ->> 'reviewed_at') nulls first, e.value ->> 'id'
  loop
    v_reason := null;
    v_id := case when jsonb_typeof(v_item) = 'object' then v_item ->> 'id' end;
    v_entry := v_item ->> 'entry_id';
    v_mode := v_item ->> 'mode_id';
    v_skill := public.vocabulary_mode_skill(v_mode);
    v_self := v_item ->> 'self_grade';
    v_answer := left(v_item ->> 'answer', 200);
    v_at := public.vocabulary_parse_instant(v_item ->> 'reviewed_at');

    if v_id is null or v_id !~ '^[A-Za-z0-9_-]{8,64}$' then
      v_reason := 'invalid_id';
    elsif v_entry is null or not exists (select 1 from public.vocabulary_items i where i.entry_id = v_entry) then
      v_reason := 'unknown_entry';
    elsif v_skill is null then
      v_reason := 'unknown_mode';
    elsif v_item ? 'skill' and (v_item ->> 'skill') is distinct from v_skill::text then
      v_reason := 'skill_mismatch';
    elsif jsonb_typeof(v_item -> 'correct') is distinct from 'boolean' then
      v_reason := 'invalid_correct';
    elsif v_item ? 'hint_used' and jsonb_typeof(v_item -> 'hint_used') not in ('boolean', 'null') then
      v_reason := 'invalid_hint_used';
    elsif v_self is not null and (v_mode <> 'flashcards' or v_self not in ('again', 'hard', 'good', 'easy')) then
      v_reason := 'invalid_self_grade';
    elsif v_at is null then
      v_reason := 'invalid_reviewed_at';
    elsif v_at > v_now + interval '5 minutes' then
      v_reason := 'reviewed_in_future';
    elsif v_at < v_created_at - interval '5 minutes' then
      v_reason := 'reviewed_before_account';
    end if;

    if v_reason is null then
      v_correct := (v_item ->> 'correct')::boolean;
      v_hint := coalesce((v_item ->> 'hint_used')::boolean, false);
      v_quality := public.vocabulary_review_quality(v_skill, v_correct, v_hint, v_self);
      if (v_quality >= 3) is distinct from v_correct then
        v_reason := 'inconsistent_grade';
      end if;
    end if;

    if v_reason is not null then
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'rejected', 'reason', v_reason));
      continue;
    end if;

    v_at := least(v_at, v_now);

    -- Serialize everything about this word: create the row if needed, then lock it.
    insert into public.student_vocabulary (student_id, entry_id) values (v_uid, v_entry)
      on conflict (student_id, entry_id) do nothing;
    v_created := found;
    select * into v_state from public.student_vocabulary sv
      where sv.student_id = v_uid and sv.entry_id = v_entry
      for update;

    -- Idempotency, checked under the lock so concurrent replays of one id cannot both apply.
    select r.student_id into v_owner from public.vocabulary_reviews r where r.id = v_id;
    if found then
      if v_created then
        delete from public.student_vocabulary sv where sv.student_id = v_uid and sv.entry_id = v_entry;
      end if;
      if v_owner = v_uid then
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'duplicate'));
        v_touched := array_append(v_touched, v_entry);
      else
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'rejected', 'reason', 'id_conflict'));
      end if;
      continue;
    end if;

    v_voided := case when v_reset_at is not null and v_at <= v_reset_at then v_now end;
    v_applied := v_voided is null
      and (v_state.last_reviewed_at is null or v_at > v_state.last_reviewed_at);

    if v_applied then
      v_next := public.vocabulary_schedule(v_state, v_skill, v_quality, v_at);
      update public.student_vocabulary sv set
        stage = v_next.stage,
        ease = v_next.ease,
        interval_days = v_next.interval_days,
        repetitions = v_next.repetitions,
        recall_streak = v_next.recall_streak,
        lapses = v_next.lapses,
        due_at = v_next.due_at,
        last_reviewed_at = v_next.last_reviewed_at,
        first_learned_at = v_next.first_learned_at,
        last_result_correct = v_next.last_result_correct,
        recognition_correct = v_next.recognition_correct,
        recognition_incorrect = v_next.recognition_incorrect,
        recall_correct = v_next.recall_correct,
        recall_incorrect = v_next.recall_incorrect,
        spoken_count = v_next.spoken_count,
        review_count = v_next.review_count,
        last_review_id = v_id
      where sv.student_id = v_uid and sv.entry_id = v_entry;
    else
      v_next := v_state;
      if v_created then
        -- Nothing applied to a word the student had no state for: leave no empty row behind.
        delete from public.student_vocabulary sv where sv.student_id = v_uid and sv.entry_id = v_entry;
      end if;
    end if;

    insert into public.vocabulary_reviews (
      id, student_id, entry_id, mode_id, skill, correct, quality, hint_used, self_grade, answer,
      reviewed_at, source, applied, stage_after, interval_days_after, due_at_after, voided_at
    ) values (
      v_id, v_uid, v_entry, v_mode, v_skill, v_correct, v_quality, v_hint, v_self, v_answer,
      v_at, p_source, v_applied, v_next.stage, v_next.interval_days, v_next.due_at, v_voided
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'status', case when v_applied then 'applied' else 'recorded' end,
      'reason', case when v_voided is not null then 'before_reset' when not v_applied then 'older_than_state' end
    ));
    v_touched := array_append(v_touched, v_entry);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(sv) order by sv.entry_id), '[]'::jsonb) into v_states
    from public.student_vocabulary sv
    where sv.student_id = v_uid and sv.entry_id = any (v_touched);

  return jsonb_build_object('results', v_results, 'states', v_states, 'reset_at', v_reset_at);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Write path: the student resets their own vocabulary progress
-- ---------------------------------------------------------------------------------------------
-- Deletes the schedule, voids (keeps) the review history for the tutor, and moves the reset
-- watermark so stale offline queues from other devices cannot resurrect the old progress.
create or replace function public.reset_vocabulary_progress(p_expected_student uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'vocabulary: not authenticated' using errcode = '42501';
  end if;
  if p_expected_student is distinct from v_uid then
    raise exception 'vocabulary: reset requested for a different account' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'student' and p.status = 'active'
  ) then
    raise exception 'vocabulary: only active students can reset vocabulary progress' using errcode = '42501';
  end if;

  insert into public.vocabulary_student_meta as m (student_id, reset_at, reset_count)
    values (v_uid, v_now, 1)
    on conflict (student_id) do update set reset_at = v_now, reset_count = m.reset_count + 1;
  delete from public.student_vocabulary sv where sv.student_id = v_uid;
  update public.vocabulary_reviews r set voided_at = v_now where r.student_id = v_uid and r.voided_at is null;
  return v_now;
end;
$$;

revoke all on function public.record_vocabulary_reviews(uuid, jsonb, text) from public, anon;
revoke all on function public.reset_vocabulary_progress(uuid) from public, anon;
grant execute on function public.record_vocabulary_reviews(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.reset_vocabulary_progress(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Grants (explicit; never rely on Data API auto-exposure or default privileges)
-- ---------------------------------------------------------------------------------------------
revoke all on public.vocabulary_items, public.student_vocabulary, public.vocabulary_reviews,
  public.vocabulary_student_meta from public, anon, authenticated;

grant select on public.vocabulary_items, public.student_vocabulary, public.vocabulary_reviews,
  public.vocabulary_student_meta to authenticated;

grant all on public.vocabulary_items, public.student_vocabulary, public.vocabulary_reviews,
  public.vocabulary_student_meta to service_role;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.vocabulary_items enable row level security;
alter table public.student_vocabulary enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.vocabulary_student_meta enable row level security;

create policy "vocabulary_items: active users read the bank" on public.vocabulary_items
  for select to authenticated
  using (public.is_active());

create policy "student_vocabulary: active student reads own rows" on public.student_vocabulary
  for select to authenticated
  using (public.is_active() and student_id = (select auth.uid()));

create policy "student_vocabulary: tutor reads linked students" on public.student_vocabulary
  for select to authenticated
  using (
    public.is_tutor()
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = (select auth.uid()) and ts.student_id = student_vocabulary.student_id
    )
  );

create policy "vocabulary_reviews: active student reads own rows" on public.vocabulary_reviews
  for select to authenticated
  using (public.is_active() and student_id = (select auth.uid()));

create policy "vocabulary_reviews: tutor reads linked students" on public.vocabulary_reviews
  for select to authenticated
  using (
    public.is_tutor()
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = (select auth.uid()) and ts.student_id = vocabulary_reviews.student_id
    )
  );

create policy "vocabulary_student_meta: active student reads own row" on public.vocabulary_student_meta
  for select to authenticated
  using (public.is_active() and student_id = (select auth.uid()));

create policy "vocabulary_student_meta: tutor reads linked students" on public.vocabulary_student_meta
  for select to authenticated
  using (
    public.is_tutor()
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = (select auth.uid()) and ts.student_id = vocabulary_student_meta.student_id
    )
  );
