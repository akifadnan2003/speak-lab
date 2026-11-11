/**
 * PGlite harness: the project's real migrations on real Postgres 17 (compiled to WebAssembly),
 * with Supabase's roles and a minimal stand-in for the `auth` schema.
 *
 * What this proves: grants, row level security, triggers and SECURITY DEFINER functions behave
 * as written, for the `anon`, `authenticated` and `service_role` database roles, with the same
 * `request.jwt.claims` setting PostgREST uses. What it does not prove: GoTrue (sign-in, JWT
 * signing), PostgREST itself or Edge Functions. Those are covered by `supabase/tests/*.test.ts`
 * against `supabase start` in the CI `database` job.
 *
 * Free of Node APIs on purpose so `src/` tests can import it too; callers pass the SQL text.
 */
import { PGlite } from '@electric-sql/pglite'

/**
 * Supabase-like platform objects. Default privileges reproduce Supabase's most permissive
 * behaviour (every new table and function granted to anon/authenticated) so a migration that
 * forgot to revoke would fail these tests rather than pass by accident.
 */
const PLATFORM_SQL = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export type Identity =
  | { readonly kind: 'superuser' }
  | { readonly kind: 'anon' }
  | { readonly kind: 'service' }
  | { readonly kind: 'user'; readonly id: string }

export interface TestDatabase {
  readonly db: PGlite
  /** Switches the single PGlite session to the given database identity. */
  as(identity: Identity): Promise<void>
  /** Runs a query as `identity` and returns to superuser afterwards (also on error). */
  query<T = Record<string, unknown>>(identity: Identity, sql: string, params?: unknown[]): Promise<T[]>
  close(): Promise<void>
}

export async function createTestDatabase(migrations: readonly { name: string; sql: string }[]): Promise<TestDatabase> {
  const db = new PGlite()
  await db.exec(PLATFORM_SQL)
  for (const m of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      await db.exec(m.sql)
    } catch (error) {
      throw new Error(`migration ${m.name} failed: ${(error as Error).message}`, { cause: error })
    }
  }

  async function as(identity: Identity) {
    await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`)
    switch (identity.kind) {
      case 'superuser':
        return
      case 'anon':
        await db.exec(`select set_config('request.jwt.claims', '{"role":"anon"}', false); set role anon;`)
        return
      case 'service':
        await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false); set role service_role;`)
        return
      case 'user': {
        const claims = JSON.stringify({ sub: identity.id, role: 'authenticated' })
        await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
        await db.exec(`set role authenticated;`)
        return
      }
    }
  }

  async function query<T>(identity: Identity, sql: string, params: unknown[] = []): Promise<T[]> {
    await as(identity)
    try {
      return (await db.query<T>(sql, params)).rows
    } finally {
      await as({ kind: 'superuser' })
    }
  }

  return { db, as, query, close: () => db.close() }
}

export const SU: Identity = { kind: 'superuser' }

let counter = 0
export function uuid(): string {
  counter += 1
  const hex = counter.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

/** Creates a confirmed auth user; M2's trigger turns it into an active student profile. */
export async function createStudent(t: TestDatabase, email: string, opts: { tutorId?: string; createdAt?: string } = {}) {
  const id = uuid()
  await t.query(SU, `insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, email])
  if (opts.createdAt) await t.query(SU, `update public.profiles set created_at = $2 where id = $1`, [id, opts.createdAt])
  if (opts.tutorId) await t.query(SU, `insert into public.tutor_students (tutor_id, student_id) values ($1, $2)`, [opts.tutorId, id])
  return id
}

/** Creates the single tutor through M2's documented bootstrap function. */
export async function createTutor(t: TestDatabase, email: string) {
  const id = uuid()
  await t.query(SU, `insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, email])
  await t.query(SU, `select public.bootstrap_owner($1)`, [id])
  return id
}
