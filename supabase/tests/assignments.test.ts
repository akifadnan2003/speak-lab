/**
 * M6 tutor workspace against the full local Supabase stack (`supabase start`): GoTrue sessions
 * through PostgREST, exactly as the browser calls it. The PGlite suite proves the policies and
 * triggers in depth; this one proves the real wire path, the Data API exposure of the new tables
 * and function, and that an unrelated student cannot reach another learner's work or notes.
 *
 * Run with `npm run test:db` after `npx supabase start` (CI `database` job).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, anonClient, ensureTutor, STUDENT_PASSWORD, TUTOR_PASSWORD, uniqueEmail, userClient } from './helpers.ts'

const admin = adminClient()
const created: string[] = []
let tutorId: string
let tutor: SupabaseClient
let a: { id: string; client: SupabaseClient }
let b: { id: string; client: SupabaseClient }

async function student(linkTo: string | null) {
  const email = uniqueEmail('hw')
  const res = await admin.auth.admin.createUser({ email, password: STUDENT_PASSWORD, email_confirm: true })
  if (res.error || !res.data.user) throw new Error(res.error?.message)
  created.push(res.data.user.id)
  if (linkTo) {
    const link = await admin.from('tutor_students').insert({ tutor_id: linkTo, student_id: res.data.user.id })
    if (link.error) throw new Error(link.error.message)
  }
  return { id: res.data.user.id, client: await userClient(email, STUDENT_PASSWORD) }
}

async function assign(kind: 'written' | 'vocabulary', studentIds: string[], extra: Record<string, unknown> = {}) {
  const inserted = await tutor
    .from('assignments')
    .insert({ tutor_id: tutorId, kind, title: `${kind} homework`, instructions: 'Do it', review_target: kind === 'vocabulary' ? 1 : null, ...extra })
    .select('id')
    .single()
  if (inserted.error) throw new Error(inserted.error.message)
  const id = inserted.data.id as string
  const recipients = await tutor.from('assignment_recipients').insert(studentIds.map((student_id) => ({ assignment_id: id, student_id })))
  if (recipients.error) throw new Error(recipients.error.message)
  const published = await tutor.from('assignments').update({ status: 'published' }).eq('id', id)
  if (published.error) throw new Error(published.error.message)
  return id
}

beforeAll(async () => {
  const t = await ensureTutor(admin)
  tutorId = t.id
  tutor = await userClient(t.email, TUTOR_PASSWORD)
  a = await student(tutorId)
  b = await student(tutorId)
}, 120_000)

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id)
})

describe('homework over the Data API', () => {
  it('anon sees nothing and cannot call complete_assignment', async () => {
    const anon = anonClient()
    for (const table of ['assignments', 'assignment_recipients', 'teacher_notes']) {
      const res = await anon.from(table).select('*').limit(1)
      expect(res.error !== null || (res.data ?? []).length === 0, `${table} leaked to anon`).toBe(true)
    }
    expect((await anon.rpc('complete_assignment', { p_assignment_id: '00000000-0000-4000-8000-000000000001' })).error).not.toBeNull()
  })

  it('the tutor assigns written homework; only the addressed student sees it, submits, and reads the feedback', async () => {
    const id = await assign('written', [a.id])
    expect((await a.client.from('assignments').select('id, status').eq('id', id)).data).toEqual([{ id, status: 'published' }])
    expect((await b.client.from('assignments').select('id').eq('id', id)).data).toEqual([])
    expect((await b.client.from('assignment_recipients').select('*').eq('assignment_id', id)).data).toEqual([])

    // Forged status and feedback are refused; a genuine submission goes through.
    const forged = await a.client.from('assignment_recipients').update({ status: 'reviewed', feedback: 'self-praise' }).eq('assignment_id', id).eq('student_id', a.id)
    expect(forged.error).not.toBeNull()
    const draft = await a.client.from('assignment_recipients').update({ draft_text: 'I went to Baku.' }).eq('assignment_id', id).eq('student_id', a.id).select('status').single()
    expect(draft.data?.status).toBe('in_progress')
    const submitted = await a.client.from('assignment_recipients').update({ draft_text: 'I went to Baku with my sister.', status: 'submitted' }).eq('assignment_id', id).eq('student_id', a.id).select('status, submitted_text, submitted_at').single()
    expect(submitted.data?.status).toBe('submitted')
    expect(submitted.data?.submitted_text).toBe('I went to Baku with my sister.')
    expect(submitted.data?.submitted_at).not.toBeNull()

    // B cannot update A's row even by guessing the keys.
    const cross = await b.client.from('assignment_recipients').update({ draft_text: 'x' }).eq('assignment_id', id).eq('student_id', a.id).select('*')
    expect(cross.data ?? []).toEqual([])

    const reviewed = await tutor.from('assignment_recipients').update({ feedback: 'Lovely. Next time add when you went.', status: 'reviewed' }).eq('assignment_id', id).eq('student_id', a.id).select('status, reviewed_at').single()
    expect(reviewed.data?.status).toBe('reviewed')
    expect(reviewed.data?.reviewed_at).not.toBeNull()
    const seen = await a.client.from('assignment_recipients').select('feedback, status').eq('assignment_id', id).single()
    expect(seen.data).toEqual({ feedback: 'Lovely. Next time add when you went.', status: 'reviewed' })
    const locked = await a.client.from('assignment_recipients').update({ draft_text: 'late edit' }).eq('assignment_id', id).eq('student_id', a.id)
    expect(locked.error).not.toBeNull()
  })

  it('vocabulary homework completes only from real reviews, through the function', async () => {
    const id = await assign('vocabulary', [a.id])
    const direct = await a.client.from('assignment_recipients').update({ status: 'submitted' }).eq('assignment_id', id).eq('student_id', a.id)
    expect(direct.error).not.toBeNull()
    const before = await a.client.rpc('complete_assignment', { p_assignment_id: id })
    expect(before.error).toBeNull()
    expect(before.data).toMatchObject({ completed: false })
    const review = await a.client.rpc('record_vocabulary_reviews', {
      p_expected_student: a.id,
      p_reviews: [{ id: `rev-hw-${Date.now().toString(36)}`, entry_id: 'v-hello', mode_id: 'meaning_choice', skill: 'recognition', correct: true, hint_used: false, reviewed_at: new Date().toISOString() }],
      p_source: 'live',
    })
    expect(review.error).toBeNull()
    const after = await a.client.rpc('complete_assignment', { p_assignment_id: id })
    expect(after.data).toMatchObject({ completed: true, evidence: { type: 'vocabulary_reviews', count: 1, target: 1 } })
    // Another student cannot complete it, and the tutor cannot either.
    expect((await b.client.rpc('complete_assignment', { p_assignment_id: id })).error).not.toBeNull()
    expect((await tutor.rpc('complete_assignment', { p_assignment_id: id })).error).not.toBeNull()
  })

  it('a student cannot create assignments or notes, and never receives teacher notes', async () => {
    expect((await a.client.from('assignments').insert({ tutor_id: tutorId, kind: 'written', title: 'forged' })).error).not.toBeNull()
    const note = await tutor.from('teacher_notes').insert({ tutor_id: tutorId, student_id: a.id, body: 'Needs more practice with present simple.', topic: 'grammar' }).select('id').single()
    expect(note.error).toBeNull()
    expect((await a.client.from('teacher_notes').select('*')).data).toEqual([])
    expect((await b.client.from('teacher_notes').select('*')).data).toEqual([])
    expect((await a.client.from('teacher_notes').insert({ tutor_id: tutorId, student_id: a.id, body: 'spoofed' })).error).not.toBeNull()
    const tampered = await a.client.from('teacher_notes').update({ body: 'x' }).eq('id', note.data!.id).select('*')
    expect(tampered.data ?? []).toEqual([])
    expect((await admin.from('teacher_notes').select('body').eq('id', note.data!.id).single()).data?.body).toContain('present simple')
  })

  it('a disabled student is cut off from homework immediately', async () => {
    const d = await student(tutorId)
    const id = await assign('written', [d.id])
    expect((await d.client.from('assignments').select('id').eq('id', id)).data).toEqual([{ id }])
    await admin.from('profiles').update({ status: 'disabled' }).eq('id', d.id)
    expect((await d.client.from('assignments').select('id').eq('id', id)).data).toEqual([])
    const write = await d.client.from('assignment_recipients').update({ draft_text: 'x' }).eq('assignment_id', id).eq('student_id', d.id).select('*')
    expect(write.data ?? []).toEqual([])
  })
})
