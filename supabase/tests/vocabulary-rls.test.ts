/**
 * Vocabulary persistence against a real local Supabase stack (`supabase start`): GoTrue-issued
 * JWTs through PostgREST, exactly as the browser calls it. Complements the PGlite suite
 * (`supabase/tests/pglite/vocabulary-rls.test.ts`) with what only the full stack can show:
 * Data API exposure of the new tables/functions, real sessions, and genuinely concurrent
 * submissions of the same review id from two connections.
 *
 * Run with `npm run test:db` after `npx supabase start` (CI `database` job).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, anonClient, ensureTutor, STUDENT_PASSWORD, TUTOR_PASSWORD, uniqueEmail, userClient } from './helpers.ts'

const admin = adminClient()
const created: string[] = []
let tutorClient: SupabaseClient
let a: { id: string; client: SupabaseClient }
let b: { id: string; client: SupabaseClient }

async function student(linkTo: string | null): Promise<{ id: string; client: SupabaseClient }> {
  const email = uniqueEmail('vocab')
  const res = await admin.auth.admin.createUser({ email, password: STUDENT_PASSWORD, email_confirm: true })
  if (res.error || !res.data.user) throw new Error(res.error?.message)
  created.push(res.data.user.id)
  if (linkTo) {
    const link = await admin.from('tutor_students').insert({ tutor_id: linkTo, student_id: res.data.user.id })
    if (link.error) throw new Error(link.error.message)
  }
  return { id: res.data.user.id, client: await userClient(email, STUDENT_PASSWORD) }
}

let n = 0
function review(overrides: Record<string, unknown> = {}) {
  n += 1
  return {
    id: `rev-stack-${Date.now().toString(36)}-${n}`,
    entry_id: 'v-hello',
    mode_id: 'active_recall',
    skill: 'recall',
    correct: true,
    hint_used: false,
    reviewed_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeAll(async () => {
  const tutor = await ensureTutor(admin)
  tutorClient = await userClient(tutor.email, TUTOR_PASSWORD)
  a = await student(tutor.id)
  b = await student(tutor.id)
}, 120_000)

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id)
})

describe('vocabulary over the Data API', () => {
  it('anon sees nothing and cannot call the functions', async () => {
    const anon = anonClient()
    for (const table of ['vocabulary_items', 'student_vocabulary', 'vocabulary_reviews', 'vocabulary_student_meta']) {
      const res = await anon.from(table).select('*').limit(1)
      expect(res.error !== null || (res.data ?? []).length === 0, `${table} leaked to anon`).toBe(true)
    }
    expect((await anon.rpc('record_vocabulary_reviews', { p_expected_student: a.id, p_reviews: [review()], p_source: 'live' })).error).not.toBeNull()
  })

  it('a student records a review and reads back the server-computed state', async () => {
    const res = await a.client.rpc('record_vocabulary_reviews', { p_expected_student: a.id, p_reviews: [review()], p_source: 'live' })
    expect(res.error).toBeNull()
    expect(res.data.results[0].status).toBe('applied')
    const states = await a.client.from('student_vocabulary').select('student_id, entry_id, stage, interval_days')
    expect(states.data).toEqual([{ student_id: a.id, entry_id: 'v-hello', stage: 'learning', interval_days: 1 }])
  })

  it('students never see each other’s rows; the tutor sees linked students', async () => {
    await b.client.rpc('record_vocabulary_reviews', { p_expected_student: b.id, p_reviews: [review({ entry_id: 'v-name' })], p_source: 'live' })
    const fromB = await b.client.from('student_vocabulary').select('student_id').eq('student_id', a.id)
    expect(fromB.data).toEqual([])
    const reviewsFromB = await b.client.from('vocabulary_reviews').select('student_id')
    expect(new Set((reviewsFromB.data ?? []).map((r) => r.student_id))).toEqual(new Set([b.id]))
    const tutorView = await tutorClient.from('student_vocabulary').select('student_id').in('student_id', [a.id, b.id])
    expect(new Set((tutorView.data ?? []).map((r) => r.student_id))).toEqual(new Set([a.id, b.id]))
  })

  it('direct writes are refused even on the student’s own rows', async () => {
    const upd = await a.client.from('student_vocabulary').update({ stage: 'mastered', interval_days: 90 }).eq('student_id', a.id)
    expect(upd.error).not.toBeNull()
    const ins = await a.client.from('vocabulary_reviews').insert({ id: 'rev-forged-stack', student_id: a.id })
    expect(ins.error).not.toBeNull()
    const after = await admin.from('student_vocabulary').select('stage').eq('student_id', a.id).eq('entry_id', 'v-hello').single()
    expect(after.data?.stage).toBe('learning')
  })

  it('a batch queued under another account is refused', async () => {
    const res = await a.client.rpc('record_vocabulary_reviews', { p_expected_student: b.id, p_reviews: [review({ entry_id: 'v-from' })], p_source: 'live' })
    expect(res.error).not.toBeNull()
    expect((await admin.from('vocabulary_reviews').select('id').eq('entry_id', 'v-from')).data).toEqual([])
  })

  it('the same review sent concurrently from two sessions is applied exactly once', async () => {
    const second = await userClient((await admin.auth.admin.getUserById(a.id)).data.user!.email!, STUDENT_PASSWORD)
    const r = review({ entry_id: 'v-student', mode_id: 'meaning_choice', skill: 'recognition' })
    const calls = await Promise.all(
      [a.client, second, a.client, second].map((c) => c.rpc('record_vocabulary_reviews', { p_expected_student: a.id, p_reviews: [r], p_source: 'live' })),
    )
    const statuses = calls.map((c) => (c.error ? 'error' : c.data.results[0].status))
    expect(statuses.filter((s) => s === 'applied')).toHaveLength(1)
    // A loser either sees "duplicate" or (rarely) a unique-violation error that a retry turns into "duplicate".
    expect(statuses.every((s) => s === 'applied' || s === 'duplicate' || s === 'error')).toBe(true)
    const state = await admin.from('student_vocabulary').select('review_count').eq('student_id', a.id).eq('entry_id', 'v-student').single()
    expect(state.data?.review_count).toBe(1)
    const retry = await a.client.rpc('record_vocabulary_reviews', { p_expected_student: a.id, p_reviews: [r], p_source: 'live' })
    expect(retry.data.results[0].status).toBe('duplicate')
  })

  it('the tutor cannot record vocabulary', async () => {
    const res = await tutorClient.rpc('record_vocabulary_reviews', { p_expected_student: a.id, p_reviews: [review()], p_source: 'live' })
    expect(res.error).not.toBeNull()
  })
})
