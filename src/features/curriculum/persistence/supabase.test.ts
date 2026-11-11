import { FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { AppSupabaseClient } from '@/lib/supabase/client'
import { CURRICULUM } from '../content'
import { AssessmentError, createSupabaseAssessmentGateway, createSupabaseProgressRepository, fromAssessmentRow } from './supabase'

/** A tiny chainable fake of the PostgREST builder: records the calls and resolves `rows`. */
function fakeTable(rows: unknown[] = [], error: { message: string } | null = null) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'order', 'insert', 'upsert', 'delete', 'update', 'maybeSingle', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve({ data: rows, error })
  return { builder, calls }
}

function fakeClient(tables: Record<string, ReturnType<typeof fakeTable>>, invoke?: (name: string, options: { body: unknown }) => Promise<unknown>) {
  return {
    from: (name: string) => {
      const t = tables[name]
      if (!t) throw new Error(`unexpected table ${name}`)
      return t.builder
    },
    functions: { invoke: invoke ?? vi.fn() },
  } as unknown as AppSupabaseClient
}

const attemptRow = {
  id: 'att-1',
  student_id: 's1',
  chapter_id: 'a0-01',
  chapter_version: 1,
  lesson_id: 'a0-01-l11',
  attempt_number: 1,
  status: 'submitted' as const,
  pass_mark: 80,
  answers: [],
  results: [],
  score: 90,
  passed: true,
  started_at: '2026-11-11T10:00:00.000Z',
  expires_at: '2026-11-11T12:00:00.000Z',
  submitted_at: '2026-11-11T10:30:00.000Z',
  voided_at: null,
}

describe('Supabase progress repository', () => {
  it('scopes every read to the student id and merges server-graded assessments', async () => {
    const progress = fakeTable([
      { student_id: 's1', chapter_id: 'a0-01', lesson_id: 'a0-01-l01', status: 'completed', best_score: 95, last_score: 95, completed_at: 'x', created_at: 'x', updated_at: 'x' },
      // A forged client row for the assessment lesson is ignored.
      { student_id: 's1', chapter_id: 'a0-01', lesson_id: 'a0-01-l11', status: 'completed', best_score: 100, last_score: 100, completed_at: 'x', created_at: 'x', updated_at: 'x' },
    ])
    const attempts = fakeTable([attemptRow])
    const repo = createSupabaseProgressRepository(fakeClient({ lesson_progress: progress, assessment_attempts: attempts }), CURRICULUM)
    const rows = await repo.listLessonProgress('s1')
    expect(progress.calls).toContainEqual({ method: 'eq', args: ['student_id', 's1'] })
    expect(attempts.calls).toContainEqual({ method: 'eq', args: ['student_id', 's1'] })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.lessonId === 'a0-01-l11')).toMatchObject({ status: 'completed', bestScore: 90 })
  })

  it('refuses to write assessment lessons as progress and uses the client id as the attempt key', async () => {
    const attempts = fakeTable([])
    const repo = createSupabaseProgressRepository(fakeClient({ exercise_attempts: attempts }), CURRICULUM)
    await expect(
      repo.upsertLessonProgress({ studentId: 's1', chapterId: 'a0-01', lessonId: 'a0-01-l11', status: 'completed', updatedAt: 'x' }),
    ).rejects.toThrow(/recorded by the server/)
    await repo.recordAttempt({
      id: 'idem-1',
      studentId: 's1',
      chapterId: 'a0-01',
      chapterVersion: 1,
      lessonId: 'a0-01-l01',
      exerciseId: 'a0-01-l01-e01',
      exerciseType: 'multiple_choice',
      attemptNumber: 1,
      answer: { type: 'multiple_choice', optionId: 'a' },
      correct: true,
      score: 1,
      hintUsed: false,
      createdAt: 'x',
    })
    const upsert = attempts.calls.find((c) => c.method === 'upsert')!
    expect(upsert.args[1]).toEqual({ onConflict: 'id', ignoreDuplicates: true })
    expect(upsert.args[0]).toMatchObject({ id: 'idem-1', student_id: 's1' })
  })

  it('surfaces database errors instead of returning empty data', async () => {
    const progress = fakeTable([], { message: 'permission denied for table lesson_progress' })
    const attempts = fakeTable([])
    const repo = createSupabaseProgressRepository(fakeClient({ lesson_progress: progress, assessment_attempts: attempts }), CURRICULUM)
    await expect(repo.listLessonProgress('s1')).rejects.toThrow(/permission denied/)
  })

  it('maps attempt rows to summaries', () => {
    expect(fromAssessmentRow(attemptRow)).toMatchObject({ id: 'att-1', status: 'submitted', score: 90, passed: true, submittedAt: attemptRow.submitted_at })
  })
})

describe('Supabase assessment gateway', () => {
  it('calls the assessment function and unwraps the envelope', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, data: { attempt: { id: 'a' }, attemptsUsed: 0, attemptsAllowed: 3 } }, error: null })
    const gateway = createSupabaseAssessmentGateway(fakeClient({}, invoke))
    const started = await gateway.start({ studentId: 's1', chapterId: 'a0-01', lessonId: 'a0-01-l11' })
    expect(invoke).toHaveBeenCalledWith('assessment', { body: { action: 'start', chapterId: 'a0-01', lessonId: 'a0-01-l11' } })
    expect(started.attempt.id).toBe('a')
  })

  it('turns function errors into AssessmentError with the server code', async () => {
    const response = new Response(JSON.stringify({ ok: false, error: { code: 'locked', message: 'Finish the chapter first.' } }), { status: 403 })
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new FunctionsHttpError(response) })
    const gateway = createSupabaseAssessmentGateway(fakeClient({}, invoke))
    await expect(gateway.start({ studentId: 's1', chapterId: 'a0-01', lessonId: 'a0-01-l11' })).rejects.toMatchObject({
      name: 'AssessmentError',
      code: 'locked',
      message: 'Finish the chapter first.',
    })
    await expect(gateway.submit({ studentId: 's1', attemptId: 'x', answers: [] })).rejects.toBeInstanceOf(AssessmentError)
  })
})
