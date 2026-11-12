/**
 * Vocabulary authorization on real Postgres (PGlite): grants, RLS and the review/reset functions.
 *
 * Runs the repository's actual migrations (M2 identity + M4 vocabulary + bank seed) and acts as
 * each database identity exactly as PostgREST would (`set role` + `request.jwt.claims`).
 * Run with `npm run test:db:pglite` (no Docker needed); it also runs inside `npm run test:db`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createStudent, createTestDatabase, createTutor, SU, type Identity, type TestDatabase } from './database.ts'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations')
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8') }))

const VOCAB_TABLES = ['vocabulary_items', 'student_vocabulary', 'vocabulary_reviews', 'vocabulary_student_meta'] as const

interface RpcResult {
  results: { id: string | null; status: 'applied' | 'recorded' | 'duplicate' | 'rejected'; reason?: string | null }[]
  states: Record<string, unknown>[]
  reset_at: string | null
}

let t: TestDatabase
let tutor: string
let studentA: string
let studentB: string
let unlinked: string
let disabled: string
const A = (): Identity => ({ kind: 'user', id: studentA })
const B = (): Identity => ({ kind: 'user', id: studentB })
const TUTOR = (): Identity => ({ kind: 'user', id: tutor })

let seq = 0
function review(overrides: Record<string, unknown> = {}) {
  seq += 1
  return {
    id: `rev-test-${seq.toString().padStart(6, '0')}`,
    entry_id: 'v-hello',
    mode_id: 'meaning_choice',
    skill: 'recognition',
    correct: true,
    hint_used: false,
    reviewed_at: new Date(Date.now() - 60_000 + seq).toISOString(),
    ...overrides,
  }
}

async function record(identity: Identity, expected: string | null, reviews: unknown[], source = 'live'): Promise<RpcResult> {
  const rows = await t.query<{ r: RpcResult }>(identity, `select public.record_vocabulary_reviews($1, $2::jsonb, $3) as r`, [
    expected,
    JSON.stringify(reviews),
    source,
  ])
  return rows[0]!.r
}

async function expectDenied(promise: Promise<unknown>, pattern: RegExp = /permission denied|42501|different account|only active students|not authenticated/i) {
  await expect(promise).rejects.toThrow(pattern)
}

beforeAll(async () => {
  t = await createTestDatabase(migrations)
  tutor = await createTutor(t, 'tutor@example.test')
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  studentA = await createStudent(t, 'a@example.test', { tutorId: tutor, createdAt: weekAgo })
  studentB = await createStudent(t, 'b@example.test', { tutorId: tutor, createdAt: weekAgo })
  // A student who exists but is not linked to the tutor (e.g. a future second tutor's student).
  unlinked = await createStudent(t, 'c@example.test')
  disabled = await createStudent(t, 'd@example.test', { tutorId: tutor })
  await record({ kind: 'user', id: unlinked }, unlinked, [review({ entry_id: 'v-name' })])
  await record({ kind: 'user', id: disabled }, disabled, [review({ entry_id: 'v-name' })])
  await t.query(SU, `update public.profiles set status = 'disabled' where id = $1`, [disabled])
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('bank seed', () => {
  it('loads every bundled entry with its chapter links', async () => {
    const [count] = await t.query<{ n: number }>(SU, `select count(*)::int as n from public.vocabulary_items where retired_at is null`)
    expect(count!.n).toBe(180)
    const [hello] = await t.query<{ chapter_ids: string[]; level: string }>(SU, `select chapter_ids, level from public.vocabulary_items where entry_id = 'v-hello'`)
    expect(hello).toEqual({ chapter_ids: ['a0-01'], level: 'A0' })
  })

  it('is readable by active users and nobody else', async () => {
    expect((await t.query(A(), `select entry_id from public.vocabulary_items`)).length).toBe(180)
    expect((await t.query({ kind: 'user', id: disabled }, `select entry_id from public.vocabulary_items`)).length).toBe(0)
    await expectDenied(t.query({ kind: 'anon' }, `select * from public.vocabulary_items`))
  })
})

describe('anonymous visitors', () => {
  it('have no access to any vocabulary table', async () => {
    for (const table of VOCAB_TABLES) await expectDenied(t.query({ kind: 'anon' }, `select * from public.${table}`))
  })

  it('cannot call the review or reset functions (refused by EXECUTE grants, not only by the body)', async () => {
    const noExecute = /permission denied for function/i
    await expectDenied(t.query({ kind: 'anon' }, `select public.record_vocabulary_reviews(null, '[]'::jsonb, 'live')`), noExecute)
    await expectDenied(t.query({ kind: 'anon' }, `select public.reset_vocabulary_progress(null)`), noExecute)
  })
})

describe('recording reviews (student A)', () => {
  it('applies a review with server-computed quality and schedule, ignoring client-sent values', async () => {
    const r = await record(A(), studentA, [
      review({ entry_id: 'v-teacher', mode_id: 'active_recall', skill: 'recall', quality: 0, stage: 'mastered', interval_days: 999, student_id: studentB }),
    ])
    expect(r.results).toEqual([expect.objectContaining({ status: 'applied' })])
    expect(r.states).toHaveLength(1)
    expect(r.states[0]).toMatchObject({ student_id: studentA, entry_id: 'v-teacher', stage: 'learning', interval_days: 1, repetitions: 1, recall_streak: 1, recall_correct: 1 })
    const [stored] = await t.query<{ quality: number; student_id: string; applied: boolean }>(SU, `select quality, student_id, applied from public.vocabulary_reviews where entry_id = 'v-teacher' and student_id = $1`, [studentA])
    expect(stored).toEqual({ quality: 5, student_id: studentA, applied: true })
    const forged = await t.query(SU, `select 1 from public.student_vocabulary where student_id = $1 and entry_id = 'v-teacher'`, [studentB])
    expect(forged).toHaveLength(0)
  })

  it('is idempotent: replaying the same review id changes nothing', async () => {
    const r1 = review({ entry_id: 'v-student' })
    const first = await record(A(), studentA, [r1])
    expect(first.results[0]!.status).toBe('applied')
    const before = await t.query(SU, `select * from public.student_vocabulary where student_id = $1 and entry_id = 'v-student'`, [studentA])
    const again = await record(A(), studentA, [r1, r1])
    expect(again.results.map((x) => x.status)).toEqual(['duplicate', 'duplicate'])
    const after = await t.query(SU, `select * from public.student_vocabulary where student_id = $1 and entry_id = 'v-student'`, [studentA])
    expect(after).toEqual(before)
    const [n] = await t.query<{ n: number }>(SU, `select count(*)::int as n from public.vocabulary_reviews where id = $1`, [r1.id])
    expect(n!.n).toBe(1)
  })

  it('records an older review as history without rewinding the schedule', async () => {
    const newer = review({ entry_id: 'v-from', reviewed_at: new Date(Date.now() - 1_000).toISOString() })
    const older = review({ entry_id: 'v-from', correct: false, reviewed_at: new Date(Date.now() - 3_600_000).toISOString() })
    await record(A(), studentA, [newer])
    const before = await t.query(SU, `select * from public.student_vocabulary where student_id = $1 and entry_id = 'v-from'`, [studentA])
    const r = await record(A(), studentA, [older])
    expect(r.results[0]).toMatchObject({ status: 'recorded', reason: 'older_than_state' })
    const after = await t.query(SU, `select * from public.student_vocabulary where student_id = $1 and entry_id = 'v-from'`, [studentA])
    expect(after).toEqual(before)
  })

  it('replays a batch in answer order regardless of array order', async () => {
    const t0 = Date.now() - 120_000
    const r = await record(A(), studentA, [
      review({ entry_id: 'v-name', reviewed_at: new Date(t0 + 2_000).toISOString() }),
      review({ entry_id: 'v-name', correct: false, reviewed_at: new Date(t0).toISOString() }),
    ])
    expect(r.results.map((x) => x.status)).toEqual(['applied', 'applied'])
    expect(r.states[0]).toMatchObject({ last_result_correct: true, recognition_correct: 1, recognition_incorrect: 1 })
  })

  it('rejects invalid reviews individually and keeps the valid ones', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const r = await record(A(), studentA, [
      review({ entry_id: 'v-does-not-exist' }),
      review({ mode_id: 'made_up' }),
      review({ mode_id: 'meaning_choice', skill: 'recall' }),
      review({ mode_id: 'meaning_choice', self_grade: 'easy' }),
      review({ reviewed_at: future }),
      review({ reviewed_at: '2001-01-01T00:00:00Z' }),
      review({ reviewed_at: 'yesterday' }),
      review({ mode_id: 'flashcards', self_grade: 'again', correct: true }),
      review({ correct: 'yes' }),
      review({ id: 'x' }),
      review({ entry_id: 'v-teacher', reviewed_at: new Date().toISOString() }),
    ])
    expect(r.results.map((x) => x.reason ?? x.status)).toEqual([
      'invalid_reviewed_at',
      'reviewed_before_account',
      'unknown_entry',
      'unknown_mode',
      'skill_mismatch',
      'invalid_self_grade',
      'inconsistent_grade',
      'invalid_correct',
      'invalid_id',
      'applied',
      'reviewed_in_future',
    ])
  })

  it('refuses a batch queued under a different account', async () => {
    await expectDenied(record(A(), studentB, [review({ entry_id: 'v-hello' })]))
    await expectDenied(record(A(), null, [review({ entry_id: 'v-hello' })]))
    const rows = await t.query(SU, `select 1 from public.vocabulary_reviews where entry_id = 'v-hello'`)
    expect(rows).toHaveLength(0)
  })

  it('refuses empty, oversized and malformed batches', async () => {
    await expect(record(A(), studentA, [])).rejects.toThrow(/1 to 500/)
    await expect(record(A(), studentA, Array.from({ length: 501 }, () => review()))).rejects.toThrow(/1 to 500/)
    await expect(record(A(), studentA, [review()], 'other')).rejects.toThrow(/unknown source/)
  })
})

describe('student isolation', () => {
  it('B sees none of A’s vocabulary rows, even when asking for them by id', async () => {
    await record(B(), studentB, [review({ entry_id: 'v-hello' })])
    for (const table of ['student_vocabulary', 'vocabulary_reviews'] as const) {
      const all = await t.query<{ student_id: string }>(B(), `select student_id from public.${table}`)
      expect(new Set(all.map((r) => r.student_id))).toEqual(new Set([studentB]))
      expect(await t.query(B(), `select * from public.${table} where student_id = $1`, [studentA])).toEqual([])
    }
  })

  it('A cannot take over B’s review id', async () => {
    const [bReview] = await t.query<{ id: string }>(SU, `select id from public.vocabulary_reviews where student_id = $1 limit 1`, [studentB])
    const r = await record(A(), studentA, [review({ id: bReview!.id, entry_id: 'v-hello' })])
    expect(r.results[0]).toMatchObject({ status: 'rejected', reason: 'id_conflict' })
    expect(r.states).toEqual([])
    const [owner] = await t.query<{ student_id: string }>(SU, `select student_id from public.vocabulary_reviews where id = $1`, [bReview!.id])
    expect(owner!.student_id).toBe(studentB)
    expect(await t.query(SU, `select 1 from public.student_vocabulary where student_id = $1 and entry_id = 'v-hello'`, [studentA])).toEqual([])
  })
})

describe('unauthorized writes', () => {
  it('students cannot insert, update or delete any vocabulary table directly, not even their own rows', async () => {
    const attempts = [
      `insert into public.student_vocabulary (student_id, entry_id, stage, interval_days) values ('${studentA}', 'v-name', 'mastered', 60)`,
      `update public.student_vocabulary set stage = 'mastered', interval_days = 60 where student_id = '${studentA}'`,
      `delete from public.student_vocabulary where student_id = '${studentA}'`,
      `insert into public.vocabulary_reviews (id, student_id, entry_id, mode_id, skill, correct, quality, reviewed_at, applied, stage_after, interval_days_after) values ('rev-forged-0001', '${studentA}', 'v-name', 'active_recall', 'recall', true, 5, now(), true, 'mastered', 60)`,
      `update public.vocabulary_reviews set correct = true where student_id = '${studentA}'`,
      `delete from public.vocabulary_reviews where student_id = '${studentA}'`,
      `insert into public.vocabulary_items (entry_id, term, level, bank_version) values ('v-forged', 'x', 'A0', 1)`,
      `update public.vocabulary_items set term = 'x'`,
      `insert into public.vocabulary_student_meta (student_id, reset_at) values ('${studentA}', now())`,
    ]
    for (const sql of attempts) await expectDenied(t.query(A(), sql))
    await expectDenied(t.query(TUTOR(), attempts[1]!))
  })

  it('internal scheduling helpers are not callable by clients', async () => {
    const schedule = /permission denied for function vocabulary_schedule/i
    await expectDenied(t.query(A(), `select public.vocabulary_mode_skill('active_recall')`), /permission denied for function/i)
    await expectDenied(t.query(A(), `select public.vocabulary_clamp_ease(2.5)`), /permission denied for function/i)
    await expectDenied(t.query(A(), `select public.vocabulary_review_quality('recall', true, false, null)`), /permission denied for function/i)
    await expectDenied(t.query(A(), `select public.vocabulary_parse_instant('2026-01-01T00:00:00Z')`), /permission denied for function/i)
    await expectDenied(
      t.query(A(), `select public.vocabulary_schedule(s, 'recall', 5, now()) from public.student_vocabulary s limit 1`),
      schedule,
    )
  })

  it('the tutor cannot record or reset vocabulary for anyone', async () => {
    await expectDenied(record(TUTOR(), tutor, [review({ entry_id: 'v-hello' })]))
    await expectDenied(record(TUTOR(), studentA, [review({ entry_id: 'v-hello' })]))
    await expectDenied(t.query(TUTOR(), `select public.reset_vocabulary_progress($1)`, [tutor]))
  })

  it('a disabled student can neither read their history nor record new reviews', async () => {
    const D: Identity = { kind: 'user', id: disabled }
    expect(await t.query(D, `select * from public.student_vocabulary`)).toEqual([])
    expect(await t.query(D, `select * from public.vocabulary_reviews`)).toEqual([])
    await expectDenied(record(D, disabled, [review({ entry_id: 'v-name' })]))
  })
})

describe('tutor read access', () => {
  it('reads linked students’ states and reviews, including disabled ones', async () => {
    const states = await t.query<{ student_id: string }>(TUTOR(), `select distinct student_id from public.student_vocabulary`)
    expect(new Set(states.map((s) => s.student_id))).toEqual(new Set([studentA, studentB, disabled]))
    const reviews = await t.query<{ student_id: string }>(TUTOR(), `select distinct student_id from public.vocabulary_reviews`)
    expect(new Set(reviews.map((s) => s.student_id))).toEqual(new Set([studentA, studentB, disabled]))
  })

  it('cannot read a student who is not linked to them', async () => {
    expect(await t.query(TUTOR(), `select * from public.student_vocabulary where student_id = $1`, [unlinked])).toEqual([])
    expect(await t.query(TUTOR(), `select * from public.vocabulary_reviews where student_id = $1`, [unlinked])).toEqual([])
    expect((await t.query(SU, `select * from public.vocabulary_reviews where student_id = $1`, [unlinked])).length).toBe(1)
  })

  it('loses access when their own account is disabled', async () => {
    await t.query(SU, `update public.profiles set status = 'disabled' where id = $1`, [tutor])
    try {
      expect(await t.query(TUTOR(), `select * from public.student_vocabulary`)).toEqual([])
    } finally {
      await t.query(SU, `update public.profiles set status = 'active' where id = $1`, [tutor])
    }
  })
})

describe('reset', () => {
  it('clears the schedule, voids history and stops stale queues from resurrecting progress', async () => {
    const stale = review({ entry_id: 'v-teacher', reviewed_at: new Date(Date.now() - 5_000).toISOString() })
    const resetAt = await t.query<{ r: string }>(A(), `select public.reset_vocabulary_progress($1) as r`, [studentA])
    expect(resetAt[0]!.r).toBeTruthy()
    expect(await t.query(A(), `select * from public.student_vocabulary`)).toEqual([])
    expect(await t.query(A(), `select * from public.vocabulary_reviews where voided_at is null`)).toEqual([])
    expect((await t.query(TUTOR(), `select * from public.vocabulary_reviews where student_id = $1`, [studentA])).length).toBeGreaterThan(0)

    const late = await record(A(), studentA, [stale])
    expect(late.results[0]).toMatchObject({ status: 'recorded', reason: 'before_reset' })
    expect(await t.query(A(), `select * from public.student_vocabulary`)).toEqual([])

    const fresh = await record(A(), studentA, [review({ entry_id: 'v-teacher', reviewed_at: new Date().toISOString() })])
    expect(fresh.results[0]!.status).toBe('applied')
    expect(fresh.states[0]).toMatchObject({ repetitions: 1, review_count: 1 })
    expect(fresh.reset_at).toBeTruthy()
    // B is untouched by A's reset.
    expect((await t.query(B(), `select * from public.student_vocabulary`)).length).toBe(1)
  })

  it('cannot be requested for another account', async () => {
    await expectDenied(t.query(A(), `select public.reset_vocabulary_progress($1)`, [studentB]))
    expect((await t.query(B(), `select * from public.student_vocabulary`)).length).toBe(1)
  })
})
