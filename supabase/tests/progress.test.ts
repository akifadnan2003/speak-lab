/**
 * M3 learning records against a real local Supabase stack: RLS on lesson_progress,
 * exercise_attempts, chapter_access_overrides and assessment_attempts, plus the `assessment`
 * Edge Function (server-side grading, retakes, disclosure, tutor reset). No mocks.
 *
 * Run with `npm run test:db` after `npx supabase start`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accessTokenOf, adminClient, ensureTutor, localStack, STUDENT_PASSWORD, TUTOR_PASSWORD, uniqueEmail, userClient } from './helpers.ts'

/* The full curriculum (with answer keys) and the grading helpers are loaded from `src/` at run
 * time (vitest alias) to build answer keys. The path is a variable so the node tsconfig does not
 * pull the app sources in. */
interface Exercise {
  id: string
  type: string
}
interface Lesson {
  id: string
  kind: string
  exercises: Exercise[]
}
interface Chapter {
  id: string
  version: number
  status: string
  completion: { passMark: number }
  lessons: Lesson[]
}
let CURRICULUM: Chapter[]
let correctAnswerFor: (exercise: Exercise) => unknown

const admin = adminClient()
const CHAPTER = 'a0-01'
const ASSESSMENT = 'a0-01-l11'
let tutor: { id: string; email: string }
let tutorClient: SupabaseClient
let tutorToken: string
let a: { client: SupabaseClient; id: string; token: string }
let b: { client: SupabaseClient; id: string; token: string }
let unlinked: { client: SupabaseClient; id: string }
const createdUserIds: string[] = []

async function createStudent(prefix: string, link: boolean) {
  const email = uniqueEmail(prefix)
  const created = await admin.auth.admin.createUser({ email, password: STUDENT_PASSWORD, email_confirm: true, user_metadata: { full_name: prefix } })
  if (created.error || !created.data.user) throw new Error(created.error?.message)
  createdUserIds.push(created.data.user.id)
  if (link) {
    const linked = await admin.from('tutor_students').insert({ tutor_id: tutor.id, student_id: created.data.user.id })
    if (linked.error) throw new Error(linked.error.message)
  }
  const client = await userClient(email, STUDENT_PASSWORD)
  return { client, id: created.data.user.id, token: await accessTokenOf(client) }
}

async function callAssessment(body: unknown, token: string | null) {
  const { url, anonKey } = localStack()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anonKey }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${url}/functions/v1/assessment`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { status: res.status, json: (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } } }
}

function practiceLessons(): Lesson[] {
  return CURRICULUM.find((c) => c.id === CHAPTER)!.lessons.filter((l) => l.kind !== 'assessment')
}

function answerKey(lessonId = ASSESSMENT) {
  const lesson = CURRICULUM.find((c) => c.id === CHAPTER)!.lessons.find((l) => l.id === lessonId)!
  return lesson.exercises.map((exercise) => ({ exerciseId: exercise.id, answer: correctAnswerFor(exercise) }))
}

/** Marks every practice lesson of A0-01 complete for a student, as their own client would. */
async function completePractice(client: SupabaseClient, studentId: string) {
  const rows = practiceLessons().map((l) => ({
    student_id: studentId,
    chapter_id: CHAPTER,
    lesson_id: l.id,
    status: 'completed',
    best_score: 100,
    last_score: 100,
    completed_at: new Date().toISOString(),
  }))
  const { error } = await client.from('lesson_progress').upsert(rows, { onConflict: 'student_id,chapter_id,lesson_id' })
  if (error) throw new Error(error.message)
}

beforeAll(async () => {
  const contentPath = '../../src/features/curriculum/content/curriculum-map.ts'
  const answersPath = '../../src/features/exercises/engine/test-answers.ts'
  CURRICULUM = ((await import(contentPath)) as { CURRICULUM: Chapter[] }).CURRICULUM
  correctAnswerFor = ((await import(answersPath)) as { correctAnswerFor: typeof correctAnswerFor }).correctAnswerFor

  tutor = await ensureTutor(admin)
  tutorClient = await userClient(tutor.email, TUTOR_PASSWORD)
  tutorToken = await accessTokenOf(tutorClient)
  a = await createStudent('progress-a', true)
  b = await createStudent('progress-b', true)
  unlinked = await createStudent('progress-unlinked', false)
}, 120_000)

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id)
})

describe('student-specific progress isolation', () => {
  it('a student reads and writes only their own progress and attempts', async () => {
    const insert = await a.client.from('lesson_progress').insert({ student_id: a.id, chapter_id: CHAPTER, lesson_id: 'a0-01-l01', status: 'in_progress' })
    expect(insert.error).toBeNull()
    const attempt = await a.client.from('exercise_attempts').insert({
      id: '11111111-1111-4111-8111-000000000001',
      student_id: a.id,
      chapter_id: CHAPTER,
      chapter_version: 1,
      lesson_id: 'a0-01-l01',
      exercise_id: 'a0-01-l01-e01',
      exercise_type: 'multiple_choice',
      attempt_number: 1,
      answer: { type: 'multiple_choice', optionId: 'a' },
      correct: true,
      score: 1,
      hint_used: false,
    })
    expect(attempt.error).toBeNull()

    // Student B sees nothing of A and cannot write rows in A's name.
    expect((await b.client.from('lesson_progress').select('*')).data).toEqual([])
    expect((await b.client.from('exercise_attempts').select('*')).data).toEqual([])
    expect((await b.client.from('assessment_attempts').select('*')).data).toEqual([])
    const forged = await b.client.from('lesson_progress').insert({ student_id: a.id, chapter_id: CHAPTER, lesson_id: 'a0-01-l02', status: 'completed', completed_at: new Date().toISOString() })
    expect(forged.error?.code).toBe('42501')
    const forgedAttempt = await b.client.from('exercise_attempts').insert({
      id: '11111111-1111-4111-8111-000000000002',
      student_id: a.id,
      chapter_id: CHAPTER,
      chapter_version: 1,
      lesson_id: 'a0-01-l01',
      exercise_id: 'a0-01-l01-e01',
      exercise_type: 'multiple_choice',
      attempt_number: 1,
      answer: { type: 'multiple_choice', optionId: 'a' },
      correct: true,
      score: 1,
    })
    expect(forgedAttempt.error?.code).toBe('42501')
    // Filtering by A's id explicitly still returns nothing for B.
    expect((await b.client.from('lesson_progress').select('*').eq('student_id', a.id)).data).toEqual([])
  })

  it('progress written on one device is visible from another device of the same student', async () => {
    const { data: userRow } = await admin.from('profiles').select('email').eq('id', a.id).single()
    const secondDevice = await userClient(userRow!.email as string, STUDENT_PASSWORD)
    const seen = await secondDevice.from('lesson_progress').select('lesson_id, status').eq('student_id', a.id)
    expect(seen.data).toEqual([{ lesson_id: 'a0-01-l01', status: 'in_progress' }])
    // Retrying the same attempt id from the other device is a no-op (idempotency key).
    const retry = await secondDevice.from('exercise_attempts').upsert(
      {
        id: '11111111-1111-4111-8111-000000000001',
        student_id: a.id,
        chapter_id: CHAPTER,
        chapter_version: 1,
        lesson_id: 'a0-01-l01',
        exercise_id: 'a0-01-l01-e01',
        exercise_type: 'multiple_choice',
        attempt_number: 1,
        answer: { type: 'multiple_choice', optionId: 'b' },
        correct: false,
        score: 0,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    expect(retry.error).toBeNull()
    const attempts = await secondDevice.from('exercise_attempts').select('id, correct').eq('student_id', a.id)
    expect(attempts.data).toEqual([{ id: '11111111-1111-4111-8111-000000000001', correct: true }])
  })
})

describe('tutor visibility', () => {
  it('the tutor reads linked students but not unlinked ones, and cannot write progress for them', async () => {
    const seen = await tutorClient.from('lesson_progress').select('student_id, lesson_id').eq('student_id', a.id)
    expect(seen.data).toEqual([{ student_id: a.id, lesson_id: 'a0-01-l01' }])
    await admin.from('lesson_progress').insert({ student_id: unlinked.id, chapter_id: CHAPTER, lesson_id: 'a0-01-l01', status: 'in_progress' })
    expect((await tutorClient.from('lesson_progress').select('*').eq('student_id', unlinked.id)).data).toEqual([])
    const write = await tutorClient.from('lesson_progress').insert({ student_id: a.id, chapter_id: CHAPTER, lesson_id: 'a0-01-l03', status: 'completed', completed_at: new Date().toISOString() })
    expect(write.error?.code).toBe('42501')
  })

  it('only the tutor can set overrides, only for linked students, and the audit trail records it', async () => {
    const own = await b.client.from('chapter_access_overrides').insert({ student_id: b.id, chapter_id: 'a2-07', kind: 'unlock', created_by: b.id })
    expect(own.error?.code).toBe('42501')
    const forUnlinked = await tutorClient.from('chapter_access_overrides').insert({ student_id: unlinked.id, chapter_id: 'a2-07', kind: 'unlock', created_by: tutor.id })
    expect(forUnlinked.error?.code).toBe('42501')
    const ok = await tutorClient.from('chapter_access_overrides').insert({ student_id: b.id, chapter_id: 'a2-07', kind: 'unlock', created_by: tutor.id })
    expect(ok.error).toBeNull()
    // The student sees the override (read-only) and A does not.
    expect((await b.client.from('chapter_access_overrides').select('chapter_id, kind')).data).toEqual([{ chapter_id: 'a2-07', kind: 'unlock' }])
    expect((await a.client.from('chapter_access_overrides').select('*')).data).toEqual([])
    const cleared = await tutorClient.from('chapter_access_overrides').delete().eq('student_id', b.id).eq('chapter_id', 'a2-07')
    expect(cleared.error).toBeNull()
    const events = await tutorClient.from('account_events').select('event_type, metadata').eq('user_id', b.id).in('event_type', ['chapter_override_set', 'chapter_override_cleared'])
    expect(events.data?.map((e) => e.event_type)).toEqual(['chapter_override_set', 'chapter_override_cleared'])
  })
})

describe('assessment integrity (server-graded chapter check)', () => {
  let attemptId: string

  it('refuses unauthenticated callers, locked lessons and non-assessment lessons', async () => {
    expect((await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, null)).status).toBe(401)
    const locked = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect(locked.status).toBe(403)
    expect(locked.json.error?.code).toBe('locked')
    const notAssessment = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: 'a0-01-l01' }, a.token)
    expect(notAssessment.json.error?.code).toBe('not_an_assessment')
    const planned = await callAssessment({ action: 'start', chapterId: 'a0-02', lessonId: 'a0-02-l01' }, a.token)
    expect(planned.status).toBe(404)
    const tutorStart = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, tutorToken)
    expect(tutorStart.status).toBe(403)
  })

  it('students cannot write assessment results directly, and a forged progress row is ignored', async () => {
    const direct = await a.client.from('assessment_attempts').insert({
      student_id: a.id,
      chapter_id: CHAPTER,
      chapter_version: 1,
      lesson_id: ASSESSMENT,
      attempt_number: 1,
      status: 'submitted',
      pass_mark: 80,
      score: 100,
      passed: true,
      expires_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    expect(direct.error?.code).toBe('42501')
    // A "completed" lesson_progress row for the assessment lesson does not unlock the chapter: the
    // function computes the gate from assessment_attempts, so the next chapter stays locked.
    const forged = await a.client.from('lesson_progress').insert({ student_id: a.id, chapter_id: CHAPTER, lesson_id: ASSESSMENT, status: 'completed', best_score: 100, completed_at: new Date().toISOString() })
    expect(forged.error).toBeNull()
    await completePractice(a.client, a.id)
    const started = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect(started.status).toBe(200)
    expect(started.json.data).toMatchObject({ attemptsUsed: 0, attemptsAllowed: 3 })
    attemptId = (started.json.data!.attempt as { id: string }).id
  })

  it('grades on the server, withholds answers after a fail, is idempotent and audited', async () => {
    const again = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect((again.json.data!.attempt as { id: string }).id).toBe(attemptId)

    const failed = await callAssessment({ action: 'submit', attemptId, answers: [] }, a.token)
    expect(failed.status).toBe(200)
    expect(failed.json.data).toMatchObject({ revealAnswers: false, attemptsUsed: 1 })
    expect(failed.json.data!.attempt).toMatchObject({ status: 'submitted', score: 0, passed: false })
    const results = failed.json.data!.results as { correct: boolean; correctAnswer?: string }[]
    expect(results.length).toBeGreaterThan(5)
    expect(results.every((r) => !r.correct && r.correctAnswer === undefined)).toBe(true)

    // Resubmitting with perfect answers changes nothing: the stored attempt is final.
    const resubmit = await callAssessment({ action: 'submit', attemptId, answers: answerKey() }, a.token)
    expect(resubmit.json.data!.attempt).toMatchObject({ score: 0 })

    // Student B cannot submit A's attempt; the score column is read-only for everyone but the server.
    expect((await callAssessment({ action: 'submit', attemptId, answers: answerKey() }, b.token)).status).toBe(404)
    const tamper = await a.client.from('assessment_attempts').update({ score: 100, passed: true }).eq('id', attemptId)
    expect(tamper.error?.code).toBe('42501')
    const row = await a.client.from('assessment_attempts').select('score, passed, results').eq('id', attemptId).single()
    expect(row.data).toMatchObject({ score: 0, passed: false })
    expect(JSON.stringify(row.data!.results)).not.toContain('correctAnswer')

    const events = await a.client.from('account_events').select('event_type, metadata').eq('user_id', a.id).eq('event_type', 'assessment_submitted')
    expect(events.data).toHaveLength(1)
    expect(events.data![0]!.metadata).toMatchObject({ lesson_id: ASSESSMENT, attempt_number: 1, passed: false })
  })

  it('a pass reveals the answers and completes the chapter; the tutor sees the attempt', async () => {
    const started = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect(started.json.data).toMatchObject({ attemptsUsed: 1 })
    const id = (started.json.data!.attempt as { id: string }).id
    const passed = await callAssessment({ action: 'submit', attemptId: id, answers: answerKey() }, a.token)
    expect(passed.json.data).toMatchObject({ revealAnswers: true, attemptsUsed: 2 })
    expect(passed.json.data!.attempt).toMatchObject({ score: 100, passed: true, attemptNumber: 2 })
    const results = passed.json.data!.results as { correct: boolean; correctAnswer?: string }[]
    expect(results.every((r) => r.correct && typeof r.correctAnswer === 'string')).toBe(true)

    const tutorView = await tutorClient.from('assessment_attempts').select('attempt_number, score, passed').eq('student_id', a.id).order('attempt_number')
    expect(tutorView.data).toEqual([
      { attempt_number: 1, score: 0, passed: false },
      { attempt_number: 2, score: 100, passed: true },
    ])
    expect((await b.client.from('assessment_attempts').select('*').eq('student_id', a.id)).data).toEqual([])
  })

  it('enforces the retake limit, lets the tutor (and only the tutor) reset it, and never a stranger', async () => {
    const third = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect(third.json.data).toMatchObject({ attemptsUsed: 2 })
    const submitted = await callAssessment({ action: 'submit', attemptId: (third.json.data!.attempt as { id: string }).id, answers: [] }, a.token)
    expect(submitted.json.data).toMatchObject({ attemptsUsed: 3, revealAnswers: true })
    const exhausted = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect(exhausted.status).toBe(409)
    expect(exhausted.json.error?.code).toBe('retakes_exhausted')

    expect((await callAssessment({ action: 'reset', studentId: a.id, chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)).status).toBe(403)
    expect((await callAssessment({ action: 'reset', studentId: unlinked.id, chapterId: CHAPTER, lessonId: ASSESSMENT }, tutorToken)).status).toBe(403)
    const reset = await callAssessment({ action: 'reset', studentId: a.id, chapterId: CHAPTER, lessonId: ASSESSMENT }, tutorToken)
    expect(reset.status).toBe(200)
    expect(reset.json.data).toEqual({ voided: 3 })
    const fresh = await callAssessment({ action: 'start', chapterId: CHAPTER, lessonId: ASSESSMENT }, a.token)
    expect(fresh.json.data).toMatchObject({ attemptsUsed: 0 })
    expect(fresh.json.data!.attempt).toMatchObject({ attemptNumber: 1 })
    const resetEvents = await tutorClient.from('account_events').select('event_type').eq('user_id', a.id).eq('event_type', 'assessment_reset')
    expect(resetEvents.data).toHaveLength(1)
  })

  it('rejects malformed submissions', async () => {
    const bad = await callAssessment({ action: 'submit', attemptId: 'not-a-uuid', answers: [] }, a.token)
    expect(bad.status).toBe(400)
    const badAnswer = await callAssessment({ action: 'submit', attemptId: '11111111-1111-4111-8111-000000000009', answers: [{ exerciseId: 'x', answer: { type: 'nope' } }] }, a.token)
    expect(badAnswer.status).toBe(400)
  })
})
