/**
 * M6 tutor workspace against real Postgres (PGlite): grants, RLS, lifecycle triggers, the
 * `complete_assignment` evidence check, note privacy, forged states and disabled accounts.
 * Run with `npm run test:db:pglite` (no Docker needed) and in the CI `database` job.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createStudent, createTestDatabase, createTutor, SU, type Identity, type TestDatabase } from './database.ts'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations')
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8') }))

let t: TestDatabase
let tutor: string
let studentA: string
let studentB: string
let unlinked: string
let disabled: string
const TUTOR = (): Identity => ({ kind: 'user', id: tutor })
const A = (): Identity => ({ kind: 'user', id: studentA })
const B = (): Identity => ({ kind: 'user', id: studentB })

const DENIED = /permission denied|row-level security|42501|not allowed|only the tutor|not your|not linked|only an active/i

async function denied(promise: Promise<unknown>, pattern: RegExp = DENIED) {
  await expect(promise).rejects.toThrow(pattern)
}

interface AssignmentRow {
  id: string
  status: string
  published_at: string | null
  cancelled_at: string | null
  title: string
  due_at: string | null
}
interface RecipientRow {
  status: string
  draft_text: string
  submitted_text: string | null
  evidence: Record<string, unknown> | null
  submitted_at: string | null
  reviewed_at: string | null
  returned_at: string | null
  late: boolean
  feedback: string | null
  feedback_updated_at: string | null
}

async function createAssignment(input: {
  kind: 'lesson' | 'vocabulary' | 'written'
  title?: string
  status?: 'draft' | 'published'
  chapterId?: string
  lessonId?: string
  requiresPass?: boolean
  reviewTarget?: number
  dueAt?: string | null
  students?: string[]
}): Promise<string> {
  const [row] = await t.query<{ id: string }>(
    TUTOR(),
    `insert into public.assignments (tutor_id, kind, title, instructions, chapter_id, lesson_id, requires_pass, review_target, due_at, status)
     values ($1, $2::public.assignment_kind, $3, 'Please do this', $4, $5, $6, $7, $8, $9::public.assignment_status) returning id`,
    [
      tutor,
      input.kind,
      input.title ?? `${input.kind} homework`,
      input.chapterId ?? null,
      input.lessonId ?? null,
      input.requiresPass ?? false,
      input.reviewTarget ?? null,
      input.dueAt ?? null,
      input.status ?? 'published',
    ],
  )
  for (const studentId of input.students ?? [studentA]) {
    await t.query(TUTOR(), `insert into public.assignment_recipients (assignment_id, student_id) values ($1, $2)`, [row!.id, studentId])
  }
  return row!.id
}

async function recipient(assignmentId: string, studentId = studentA): Promise<RecipientRow> {
  const [row] = await t.query<RecipientRow>(SU, `select * from public.assignment_recipients where assignment_id = $1 and student_id = $2`, [assignmentId, studentId])
  return row!
}

async function assignment(id: string): Promise<AssignmentRow> {
  const [row] = await t.query<AssignmentRow>(SU, `select * from public.assignments where id = $1`, [id])
  return row!
}

async function complete(identity: Identity, assignmentId: string) {
  const [row] = await t.query<{ r: { completed: boolean; status: string; evidence?: Record<string, unknown>; progress?: Record<string, unknown>; already?: boolean } }>(
    identity,
    `select public.complete_assignment($1) as r`,
    [assignmentId],
  )
  return row!.r
}

beforeAll(async () => {
  t = await createTestDatabase(migrations)
  tutor = await createTutor(t, 'tutor@example.test')
  studentA = await createStudent(t, 'a@example.test', { tutorId: tutor })
  studentB = await createStudent(t, 'b@example.test', { tutorId: tutor })
  unlinked = await createStudent(t, 'c@example.test')
  disabled = await createStudent(t, 'd@example.test', { tutorId: tutor })
  await t.query(SU, `update public.profiles set status = 'disabled' where id = $1`, [disabled])
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('grants', () => {
  it('anonymous visitors have no access to any workspace table or the completion function', async () => {
    for (const table of ['assignments', 'assignment_recipients', 'teacher_notes']) {
      await denied(t.query({ kind: 'anon' }, `select * from public.${table}`))
    }
    await denied(t.query({ kind: 'anon' }, `select public.complete_assignment('00000000-0000-4000-8000-000000000001')`), /permission denied for function/i)
  })
})

describe('assignment ownership and lifecycle (tutor)', () => {
  it('a student cannot create an assignment, even naming the tutor as owner', async () => {
    await denied(
      t.query(A(), `insert into public.assignments (tutor_id, kind, title) values ($1, 'written', 'forged')`, [tutor]),
    )
    await denied(
      t.query(A(), `insert into public.assignments (tutor_id, kind, title) values ($1, 'written', 'forged')`, [studentA]),
    )
  })

  it('publishing sets the server timestamp; client timestamps are ignored', async () => {
    const id = await createAssignment({ kind: 'written', status: 'draft' })
    expect(await assignment(id)).toMatchObject({ status: 'draft', published_at: null })
    await t.query(TUTOR(), `update public.assignments set status = 'published', published_at = '2001-01-01T00:00:00Z' where id = $1`, [id])
    const published = await assignment(id)
    expect(published.status).toBe('published')
    expect(new Date(published.published_at!).getFullYear()).toBeGreaterThan(2020)
  })

  it('refuses invalid transitions, kind changes and target changes after publishing', async () => {
    const id = await createAssignment({ kind: 'vocabulary', reviewTarget: 10 })
    await denied(t.query(TUTOR(), `update public.assignments set status = 'draft' where id = $1`, [id]), /invalid assignment transition/i)
    await denied(t.query(TUTOR(), `update public.assignments set kind = 'written', review_target = null where id = $1`, [id]), /kind cannot change/i)
    await denied(t.query(TUTOR(), `update public.assignments set review_target = 50 where id = $1`, [id]), /target of a published assignment/i)
    await t.query(TUTOR(), `update public.assignments set title = 'Renamed' where id = $1`, [id])
    expect((await assignment(id)).title).toBe('Renamed')
  })

  it('cancelling freezes the assignment and logs an event per recipient', async () => {
    const id = await createAssignment({ kind: 'written', students: [studentA, studentB] })
    await t.query(TUTOR(), `update public.assignments set status = 'cancelled' where id = $1`, [id])
    expect((await assignment(id)).cancelled_at).not.toBeNull()
    await denied(t.query(TUTOR(), `update public.assignments set title = 'x' where id = $1`, [id]), /cancelled assignment cannot be changed/i)
    const events = await t.query<{ user_id: string }>(SU, `select user_id from public.account_events where event_type = 'assignment_cancelled' and metadata ->> 'assignment_id' = $1`, [id])
    expect(events.map((e) => e.user_id).sort()).toEqual([studentA, studentB].sort())
  })

  it('only drafts can be deleted', async () => {
    const draft = await createAssignment({ kind: 'written', status: 'draft' })
    const live = await createAssignment({ kind: 'written' })
    await t.query(TUTOR(), `delete from public.assignments where id = $1`, [draft])
    await t.query(TUTOR(), `delete from public.assignments where id = $1`, [live])
    expect((await t.query(SU, `select id from public.assignments where id = $1`, [draft])).length).toBe(0)
    expect((await t.query(SU, `select id from public.assignments where id = $1`, [live])).length).toBe(1)
  })

  it('recipients must be linked students; rows start clean whatever the tutor sends', async () => {
    const id = await createAssignment({ kind: 'written', students: [] })
    await denied(t.query(TUTOR(), `insert into public.assignment_recipients (assignment_id, student_id) values ($1, $2)`, [id, unlinked]), /not linked/i)
    await t.query(TUTOR(), `insert into public.assignment_recipients (assignment_id, student_id, status, feedback) values ($1, $2, 'reviewed', 'preloaded')`, [id, studentA])
    expect(await recipient(id)).toMatchObject({ status: 'assigned', feedback: null, submitted_at: null })
  })
})

describe('what students can see and do', () => {
  it('a student sees only published assignments addressed to them, never drafts or other students’ work', async () => {
    const mine = await createAssignment({ kind: 'written', title: 'For A' })
    const theirs = await createAssignment({ kind: 'written', title: 'For B', students: [studentB] })
    const draft = await createAssignment({ kind: 'written', title: 'Draft for A', status: 'draft' })
    const seen = await t.query<{ id: string }>(A(), `select id from public.assignments`)
    const ids = seen.map((r) => r.id)
    expect(ids).toContain(mine)
    expect(ids).not.toContain(theirs)
    expect(ids).not.toContain(draft)
    expect((await t.query(A(), `select * from public.assignment_recipients where assignment_id = $1`, [theirs])).length).toBe(0)
    expect((await t.query(B(), `select * from public.assignment_recipients where assignment_id = $1`, [mine])).length).toBe(0)
  })

  it('saving a draft starts the work; submitting freezes the text and stamps the time', async () => {
    const id = await createAssignment({ kind: 'written' })
    await t.query(A(), `update public.assignment_recipients set draft_text = 'My first words' where assignment_id = $1 and student_id = $2`, [id, studentA])
    let row = await recipient(id)
    expect(row.status).toBe('in_progress')
    expect(row.draft_text).toBe('My first words')
    await t.query(A(), `update public.assignment_recipients set draft_text = 'My final words', status = 'submitted', submitted_at = '2001-01-01T00:00:00Z', late = true where assignment_id = $1 and student_id = $2`, [id, studentA]).catch(() => undefined)
    // The attempt above sent server-owned columns; it must be refused, and nothing changed.
    expect((await recipient(id)).status).toBe('in_progress')
    await t.query(A(), `update public.assignment_recipients set draft_text = 'My final words', status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA])
    row = await recipient(id)
    expect(row.status).toBe('submitted')
    expect(row.submitted_text).toBe('My final words')
    expect(row.submitted_at).not.toBeNull()
    expect(row.late).toBe(false)
    const events = await t.query(SU, `select 1 from public.account_events where event_type = 'assignment_submitted' and user_id = $1 and metadata ->> 'assignment_id' = $2`, [studentA, id])
    expect(events.length).toBe(1)
  })

  it('refuses an empty submission and any edit after submitting', async () => {
    const id = await createAssignment({ kind: 'written' })
    await denied(t.query(A(), `update public.assignment_recipients set status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA]), /write your answer/i)
    await t.query(A(), `update public.assignment_recipients set draft_text = 'done', status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA])
    await denied(t.query(A(), `update public.assignment_recipients set draft_text = 'changed' where assignment_id = $1 and student_id = $2`, [id, studentA]), /submitted work cannot be changed/i)
  })

  it('students cannot write feedback, evidence, or mark themselves reviewed', async () => {
    const id = await createAssignment({ kind: 'written' })
    await denied(t.query(A(), `update public.assignment_recipients set feedback = 'great job (by me)' where assignment_id = $1 and student_id = $2`, [id, studentA]), /only their draft/i)
    await denied(t.query(A(), `update public.assignment_recipients set evidence = '{"type":"forged"}' where assignment_id = $1 and student_id = $2`, [id, studentA]), /only their draft/i)
    await denied(t.query(A(), `update public.assignment_recipients set status = 'reviewed' where assignment_id = $1 and student_id = $2`, [id, studentA]), /invalid submission transition/i)
    expect(await recipient(id)).toMatchObject({ status: 'assigned', feedback: null, evidence: null })
  })

  it('late submissions are accepted and flagged', async () => {
    const id = await createAssignment({ kind: 'written', dueAt: '2026-01-01T00:00:00Z' })
    await t.query(A(), `update public.assignment_recipients set draft_text = 'late but done', status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA])
    expect((await recipient(id)).late).toBe(true)
  })

  it('a cancelled or draft assignment cannot be worked on', async () => {
    const id = await createAssignment({ kind: 'written' })
    await t.query(TUTOR(), `update public.assignments set status = 'cancelled' where id = $1`, [id])
    await denied(t.query(A(), `update public.assignment_recipients set draft_text = 'x' where assignment_id = $1 and student_id = $2`, [id, studentA]), /not open/i)
  })

  it('a disabled student sees nothing and cannot complete homework', async () => {
    const id = await createAssignment({ kind: 'written', students: [disabled] })
    expect((await t.query({ kind: 'user', id: disabled }, `select * from public.assignments`)).length).toBe(0)
    expect((await t.query({ kind: 'user', id: disabled }, `select * from public.assignment_recipients`)).length).toBe(0)
    await denied(t.query({ kind: 'user', id: disabled }, `select public.complete_assignment($1)`, [id]), /only an active student/i)
  })
})

describe('review workflow (tutor)', () => {
  it('reviews a submission with feedback, can return it, and the student can resubmit', async () => {
    const id = await createAssignment({ kind: 'written' })
    await t.query(A(), `update public.assignment_recipients set draft_text = 'v1', status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA])
    await denied(t.query(TUTOR(), `update public.assignment_recipients set draft_text = 'edited by tutor' where assignment_id = $1 and student_id = $2`, [id, studentA]), /cannot change the student/i)
    await t.query(TUTOR(), `update public.assignment_recipients set feedback = 'Good start. Add one more example.', status = 'reviewed' where assignment_id = $1 and student_id = $2`, [id, studentA])
    let row = await recipient(id)
    expect(row).toMatchObject({ status: 'reviewed', feedback: 'Good start. Add one more example.' })
    expect(row.reviewed_at).not.toBeNull()
    expect(row.feedback_updated_at).not.toBeNull()
    // The student reads the feedback but cannot touch it.
    const [seen] = await t.query<RecipientRow>(A(), `select feedback, status from public.assignment_recipients where assignment_id = $1`, [id])
    expect(seen).toMatchObject({ status: 'reviewed', feedback: 'Good start. Add one more example.' })
    await denied(t.query(A(), `update public.assignment_recipients set feedback = null where assignment_id = $1 and student_id = $2`, [id, studentA]), /only their draft/i)
    // Returned for changes: the student may edit and resubmit; the last submission stays visible.
    await t.query(TUTOR(), `update public.assignment_recipients set status = 'in_progress' where assignment_id = $1 and student_id = $2`, [id, studentA])
    row = await recipient(id)
    expect(row).toMatchObject({ status: 'in_progress', submitted_text: 'v1', reviewed_at: null })
    expect(row.returned_at).not.toBeNull()
    await t.query(A(), `update public.assignment_recipients set draft_text = 'v2', status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA])
    expect((await recipient(id)).submitted_text).toBe('v2')
    const kinds = await t.query<{ event_type: string }>(SU, `select event_type from public.account_events where user_id = $1 and metadata ->> 'assignment_id' = $2 order by id`, [studentA, id])
    expect(kinds.map((k) => k.event_type)).toEqual(['assignment_submitted', 'assignment_reviewed', 'assignment_returned', 'assignment_submitted'])
  })

  it('cannot review before submission, and cannot edit an assignment once something was submitted', async () => {
    const id = await createAssignment({ kind: 'written' })
    await denied(t.query(TUTOR(), `update public.assignment_recipients set status = 'reviewed' where assignment_id = $1 and student_id = $2`, [id, studentA]), /invalid review transition/i)
    await t.query(A(), `update public.assignment_recipients set draft_text = 'done', status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA])
    await denied(t.query(TUTOR(), `update public.assignments set title = 'changed' where id = $1`, [id]), /cancel the assignment instead/i)
    await t.query(TUTOR(), `update public.assignments set status = 'cancelled' where id = $1`, [id])
  })
})

describe('complete_assignment: evidence, not flags', () => {
  it('a lesson assignment completes only once the lesson is really completed', async () => {
    const id = await createAssignment({ kind: 'lesson', chapterId: 'a0-01', lessonId: 'a0-01-l01' })
    await denied(t.query(A(), `update public.assignment_recipients set status = 'submitted' where assignment_id = $1 and student_id = $2`, [id, studentA]), /completed from your learning records/i)
    let result = await complete(A(), id)
    expect(result).toMatchObject({ completed: false, progress: { lesson_status: 'not_started' } })
    await t.query(A(), `insert into public.lesson_progress (student_id, chapter_id, lesson_id, status) values ($1, 'a0-01', 'a0-01-l01', 'in_progress')`, [studentA])
    result = await complete(A(), id)
    expect(result).toMatchObject({ completed: false, progress: { lesson_status: 'in_progress' } })
    await t.query(A(), `update public.lesson_progress set status = 'completed', best_score = 90, completed_at = now() where student_id = $1 and lesson_id = 'a0-01-l01'`, [studentA])
    result = await complete(A(), id)
    expect(result).toMatchObject({ completed: true, status: 'submitted', evidence: { type: 'lesson_completed', best_score: 90 } })
    expect((await recipient(id)).status).toBe('submitted')
    // Idempotent, and B cannot complete A's homework.
    expect(await complete(A(), id)).toMatchObject({ completed: true, already: true })
    await expect(complete(B(), id)).rejects.toThrow(/not found/i)
  })

  it('a chapter-check assignment ignores forged lesson progress and needs a passed server-graded attempt', async () => {
    const id = await createAssignment({ kind: 'lesson', chapterId: 'a0-01', lessonId: 'a0-01-l11', requiresPass: true })
    await t.query(A(), `insert into public.lesson_progress (student_id, chapter_id, lesson_id, status, best_score, completed_at) values ($1, 'a0-01', 'a0-01-l11', 'completed', 100, now())`, [studentA])
    expect(await complete(A(), id)).toMatchObject({ completed: false, progress: { attempted: false } })
    // A failed attempt (service role writes attempts, as the Edge Function does).
    await t.query(
      { kind: 'service' },
      `insert into public.assessment_attempts (student_id, chapter_id, chapter_version, lesson_id, attempt_number, status, pass_mark, score, passed, expires_at, submitted_at)
       values ($1, 'a0-01', 1, 'a0-01-l11', 1, 'submitted', 80, 60, false, now() + interval '1 hour', now())`,
      [studentA],
    )
    expect(await complete(A(), id)).toMatchObject({ completed: false, progress: { attempted: true, best_score: 60 } })
    await t.query(
      { kind: 'service' },
      `insert into public.assessment_attempts (student_id, chapter_id, chapter_version, lesson_id, attempt_number, status, pass_mark, score, passed, expires_at, submitted_at)
       values ($1, 'a0-01', 1, 'a0-01-l11', 2, 'submitted', 80, 90, true, now() + interval '1 hour', now())`,
      [studentA],
    )
    expect(await complete(A(), id)).toMatchObject({ completed: true, evidence: { type: 'chapter_check_passed', score: 90 } })
  })

  it('a vocabulary assignment counts only reviews recorded after it was published', async () => {
    const before = new Date(Date.now() - 60_000).toISOString()
    await t.query(A(), `select public.record_vocabulary_reviews($1, $2::jsonb, 'live')`, [
      studentA,
      JSON.stringify([{ id: 'rev-m6-before-0001', entry_id: 'v-hello', mode_id: 'meaning_choice', skill: 'recognition', correct: true, hint_used: false, reviewed_at: before }]),
    ])
    const id = await createAssignment({ kind: 'vocabulary', reviewTarget: 2 })
    expect(await complete(A(), id)).toMatchObject({ completed: false, progress: { count: 0, target: 2 } })
    const now = new Date().toISOString()
    await t.query(A(), `select public.record_vocabulary_reviews($1, $2::jsonb, 'live')`, [
      studentA,
      JSON.stringify([
        { id: 'rev-m6-after-00001', entry_id: 'v-name', mode_id: 'meaning_choice', skill: 'recognition', correct: true, hint_used: false, reviewed_at: now },
        { id: 'rev-m6-after-00002', entry_id: 'v-from', mode_id: 'meaning_choice', skill: 'recognition', correct: false, hint_used: false, reviewed_at: now },
      ]),
    ])
    expect(await complete(A(), id)).toMatchObject({ completed: true, evidence: { type: 'vocabulary_reviews', count: 2, target: 2 } })
  })

  it('the tutor cannot complete homework on a student’s behalf', async () => {
    const id = await createAssignment({ kind: 'vocabulary', reviewTarget: 1 })
    await denied(t.query(TUTOR(), `select public.complete_assignment($1)`, [id]), /only an active student/i)
  })
})

describe('teacher notes are private', () => {
  it('the tutor creates, edits and deletes notes about linked students only', async () => {
    const [note] = await t.query<{ id: string }>(TUTOR(), `insert into public.teacher_notes (tutor_id, student_id, body, topic, priority) values ($1, $2, 'Confuses subject pronouns', 'grammar', 'high') returning id`, [tutor, studentA])
    await t.query(TUTOR(), `update public.teacher_notes set body = 'Confuses subject pronouns; improving' where id = $1`, [note!.id])
    expect((await t.query<{ body: string }>(TUTOR(), `select body from public.teacher_notes where id = $1`, [note!.id]))[0]!.body).toContain('improving')
    await denied(t.query(TUTOR(), `insert into public.teacher_notes (tutor_id, student_id, body) values ($1, $2, 'about an unlinked student')`, [tutor, unlinked]))
    await denied(t.query(TUTOR(), `insert into public.teacher_notes (tutor_id, student_id, body) values ($1, $2, '')`, [tutor, studentA]), /violates check constraint/i)
  })

  it('students get nothing back and cannot write notes, not even about themselves', async () => {
    expect((await t.query(A(), `select * from public.teacher_notes`)).length).toBe(0)
    await denied(t.query(A(), `insert into public.teacher_notes (tutor_id, student_id, body) values ($1, $2, 'self note')`, [studentA, studentA]))
    await denied(t.query(A(), `insert into public.teacher_notes (tutor_id, student_id, body) values ($1, $2, 'spoofed')`, [tutor, studentA]))
    await t.query(A(), `update public.teacher_notes set body = 'hacked'`)
    expect((await t.query<{ body: string }>(SU, `select body from public.teacher_notes`)).every((n) => n.body !== 'hacked')).toBe(true)
    await t.query(TUTOR(), `delete from public.teacher_notes where student_id = $1`, [studentA])
    expect((await t.query(SU, `select 1 from public.teacher_notes where student_id = $1`, [studentA])).length).toBe(0)
  })
})
