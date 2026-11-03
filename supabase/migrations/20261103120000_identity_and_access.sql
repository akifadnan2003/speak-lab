-- SpeakLab · M2 · Identity, roles, invitations, account lifecycle, RLS.
--
-- Principles enforced here (see docs/SECURITY.md):
--   * There is exactly one tutor. A partial unique index makes a second tutor row impossible,
--     whoever is writing.
--   * Role, status and tutor links are never writable by clients. Column-level grants exclude
--     them, and a BEFORE UPDATE trigger rejects any such change coming from a client JWT.
--   * Students see only their own rows; the tutor sees only linked students.
--   * Disabled accounts fail every policy except reading their own profile row (so the UI can
--     say "account disabled").
--   * Owner bootstrap is a SECURITY DEFINER function that is NOT executable by anon or
--     authenticated. It is run once from the SQL editor (or service role) with a verified
--     auth.users id and is idempotent.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.user_role as enum ('tutor', 'student');
create type public.account_status as enum ('invited', 'active', 'disabled');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'student',
  status public.account_status not null default 'invited',
  preferred_language text not null default 'en',
  support_language text not null default 'az',
  preferences jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email)),
  constraint profiles_full_name_length check (char_length(full_name) <= 120),
  constraint profiles_preferred_language check (preferred_language in ('en')),
  constraint profiles_support_language check (support_language in ('az', 'none')),
  constraint profiles_preferences_object check (jsonb_typeof(preferences) = 'object')
);
comment on table public.profiles is 'One row per auth user. role/status/email are server-managed.';

-- Exactly one tutor, ever.
create unique index profiles_single_tutor_idx on public.profiles ((true)) where role = 'tutor';
create unique index profiles_email_idx on public.profiles (email);
create index profiles_role_status_idx on public.profiles (role, status);

create table public.tutor_students (
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tutor_id, student_id),
  constraint tutor_students_distinct check (tutor_id <> student_id)
);
-- A student belongs to exactly one tutor.
create unique index tutor_students_student_idx on public.tutor_students (student_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null default '',
  user_id uuid references auth.users (id) on delete set null,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status public.invitation_status not null default 'pending',
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resend_count integer not null default 0,
  accepted_at timestamptz,
  revoked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_lowercase check (email = lower(email)),
  constraint invitations_full_name_length check (char_length(full_name) <= 120)
);
-- Only one open invitation per email address.
create unique index invitations_pending_email_idx on public.invitations (email) where status = 'pending';
create index invitations_invited_by_idx on public.invitations (invited_by, status);
create index invitations_user_id_idx on public.invitations (user_id);

create table public.account_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  actor_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_events_type check (
    event_type in (
      'owner_bootstrapped',
      'invitation_sent',
      'invitation_resent',
      'invitation_revoked',
      'invitation_accepted',
      'account_created',
      'account_disabled',
      'account_reactivated',
      'onboarding_completed'
    )
  ),
  constraint account_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index account_events_user_idx on public.account_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Generic updated_at
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, read-only, locked search_path)
-- ---------------------------------------------------------------------------------------------
create or replace function public.current_account_status()
returns public.account_status
language sql
stable
security definer
set search_path = ''
as $$
  select p.status from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_tutor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'tutor' and p.status = 'active' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- True when the current request is authenticated with a user JWT (not service role / postgres).
create or replace function public.request_is_client()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('anon', 'authenticated');
$$;

revoke all on function public.current_account_status() from public, anon;
revoke all on function public.is_active() from public, anon;
revoke all on function public.is_tutor() from public, anon;
revoke all on function public.request_is_client() from public, anon;
grant execute on function public.current_account_status() to authenticated, service_role;
grant execute on function public.is_active() to authenticated, service_role;
grant execute on function public.is_tutor() to authenticated, service_role;
grant execute on function public.request_is_client() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Privileged-column protection
-- ---------------------------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.request_is_client() then
    if new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.email is distinct from old.email then
      raise exception 'profiles: role, status, email and id are managed by the server'
        using errcode = '42501';
    end if;
    if new.onboarding_completed_at is distinct from old.onboarding_completed_at
      and new.onboarding_completed_at is null then
      raise exception 'profiles: onboarding_completed_at cannot be cleared' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------------------------
-- auth.users lifecycle → profiles / invitations / tutor_students / account_events
-- ---------------------------------------------------------------------------------------------
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_support text := coalesce(new.raw_user_meta_data ->> 'support_language', 'az');
  v_invite record;
begin
  if v_support not in ('az', 'none') then
    v_support := 'az';
  end if;

  insert into public.profiles (id, email, full_name, role, status, support_language)
  values (
    new.id,
    lower(new.email),
    left(v_full_name, 120),
    'student',
    case when new.email_confirmed_at is not null then 'active' else 'invited' end,
    v_support
  )
  on conflict (id) do nothing;

  -- Attach the auth user to its pending invitation (if the Edge Function created one first).
  select * into v_invite from public.invitations i
    where i.email = lower(new.email) and i.status = 'pending'
    limit 1;
  if found then
    update public.invitations set user_id = new.id where id = v_invite.id;
    if v_full_name = '' and v_invite.full_name <> '' then
      update public.profiles set full_name = v_invite.full_name where id = new.id;
    end if;
  end if;

  insert into public.account_events (user_id, actor_id, event_type, metadata)
  values (new.id, null, 'account_created', jsonb_build_object('confirmed', new.email_confirmed_at is not null));

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_auth_user_created();

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  -- Keep the profile email in sync with auth (email change flow).
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;

  -- Invitation accepted: first confirmation of the email address.
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles set status = 'active' where id = new.id and status = 'invited';

    select * into v_invite from public.invitations i
      where (i.user_id = new.id or i.email = lower(new.email)) and i.status = 'pending'
      order by i.sent_at desc
      limit 1;

    if found then
      update public.invitations
        set status = 'accepted', accepted_at = now(), user_id = new.id
        where id = v_invite.id;

      insert into public.tutor_students (tutor_id, student_id)
      values (v_invite.invited_by, new.id)
      on conflict do nothing;

      insert into public.account_events (user_id, actor_id, event_type, metadata)
      values (new.id, new.id, 'invitation_accepted', jsonb_build_object('invitation_id', v_invite.id));
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_updated after update on auth.users
  for each row execute function public.handle_auth_user_updated();

-- ---------------------------------------------------------------------------------------------
-- Owner bootstrap (run once by the owner from a trusted admin environment)
-- ---------------------------------------------------------------------------------------------
create or replace function public.bootstrap_owner(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_existing_tutor uuid;
begin
  if public.request_is_client() then
    raise exception 'bootstrap_owner cannot be called by clients' using errcode = '42501';
  end if;

  select * into v_user from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'bootstrap_owner: auth user % does not exist', p_user_id;
  end if;
  if v_user.email_confirmed_at is null then
    raise exception 'bootstrap_owner: auth user % has not confirmed their email', p_user_id;
  end if;

  select p.id into v_existing_tutor from public.profiles p where p.role = 'tutor';
  if found and v_existing_tutor = p_user_id then
    return 'already-owner';
  elsif found then
    raise exception 'bootstrap_owner: a tutor already exists (%); refusing to create a second one', v_existing_tutor;
  end if;

  insert into public.profiles as p (id, email, full_name, role, status, onboarding_completed_at)
  values (
    p_user_id,
    lower(v_user.email),
    coalesce(v_user.raw_user_meta_data ->> 'full_name', ''),
    'tutor',
    'active',
    now()
  )
  on conflict (id) do update
    set role = 'tutor', status = 'active', onboarding_completed_at = coalesce(p.onboarding_completed_at, now());

  insert into public.account_events (user_id, actor_id, event_type, metadata)
  values (p_user_id, null, 'owner_bootstrapped', jsonb_build_object('email', lower(v_user.email)));

  return 'bootstrapped';
end;
$$;

revoke all on function public.bootstrap_owner(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Student self-service helper: mark onboarding complete (sets the timestamp exactly once).
-- ---------------------------------------------------------------------------------------------
create or replace function public.complete_onboarding()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles
    set onboarding_completed_at = coalesce(onboarding_completed_at, now())
    where id = auth.uid();
$$;
revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Grants (explicit; do not rely on auto-exposure defaults)
-- ---------------------------------------------------------------------------------------------
revoke all on public.profiles, public.tutor_students, public.invitations, public.account_events from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, preferred_language, support_language, preferences, onboarding_completed_at)
  on public.profiles to authenticated;
grant select on public.tutor_students to authenticated;
grant select on public.invitations to authenticated;
grant select on public.account_events to authenticated;

grant all on public.profiles, public.tutor_students, public.invitations, public.account_events to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tutor_students enable row level security;
alter table public.invitations enable row level security;
alter table public.account_events enable row level security;

-- profiles
create policy "profiles: read own row (any status)" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: tutor reads linked students" on public.profiles
  for select to authenticated
  using (
    public.is_tutor()
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = (select auth.uid()) and ts.student_id = profiles.id
    )
  );

create policy "profiles: active user updates own row" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and public.is_active())
  with check (id = (select auth.uid()) and public.is_active());

-- tutor_students
create policy "tutor_students: participants read" on public.tutor_students
  for select to authenticated
  using (
    public.is_active()
    and (tutor_id = (select auth.uid()) or student_id = (select auth.uid()))
  );

-- invitations (tutor only)
create policy "invitations: tutor reads own invitations" on public.invitations
  for select to authenticated
  using (public.is_tutor() and invited_by = (select auth.uid()));

-- account_events
create policy "account_events: tutor reads students' events" on public.account_events
  for select to authenticated
  using (
    public.is_tutor()
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.tutor_students ts
        where ts.tutor_id = (select auth.uid()) and ts.student_id = account_events.user_id
      )
      or exists (
        select 1 from public.invitations i
        where i.invited_by = (select auth.uid()) and i.user_id = account_events.user_id
      )
    )
  );

create policy "account_events: active user reads own events" on public.account_events
  for select to authenticated
  using (public.is_active() and user_id = (select auth.uid()));
