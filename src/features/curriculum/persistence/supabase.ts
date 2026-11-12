import { FunctionsHttpError } from '@supabase/supabase-js'
import type { AppSupabaseClient } from '@/lib/supabase/client'
import type {
  AssessmentAttemptRow,
  ChapterAccessOverrideRow,
  ExerciseAttemptRow,
  LessonProgressRow,
} from '@/lib/supabase/database.types'
import { assessmentLessonIndex, mergeAssessmentResults } from '../assessment-rules'
import type {
  AssessmentAttemptSummary,
  AssessmentGateway,
  AssessmentResult,
  AssessmentStart,
  ChapterAccessOverride,
  ExerciseAttemptRecord,
  LessonProgressRecord,
  ProgressRepository,
} from '../ports'
import type { Answer, Chapter, ExerciseType } from '../schema'

/**
 * Supabase-backed persistence for real builds.
 *
 * Reads and practice writes go straight to Postgres under RLS (a student only ever touches
 * `student_id = auth.uid()` rows; the tutor reads linked students). Assessments go through the
 * `assessment` Edge Function, which grades on the server and is the only writer of
 * `assessment_attempts`. Nothing here caches across users: TanStack Query holds the state and is
 * cleared by the auth provider on sign-out and account switch.
 */

function fromProgressRow(row: LessonProgressRow): LessonProgressRecord {
  return {
    studentId: row.student_id,
    chapterId: row.chapter_id,
    lessonId: row.lesson_id,
    status: row.status,
    bestScore: row.best_score ?? undefined,
    lastScore: row.last_score ?? undefined,
    completedAt: row.completed_at ?? undefined,
    updatedAt: row.updated_at,
  }
}

function fromAttemptRow(row: ExerciseAttemptRow): ExerciseAttemptRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    chapterId: row.chapter_id,
    chapterVersion: row.chapter_version,
    lessonId: row.lesson_id,
    exerciseId: row.exercise_id,
    exerciseType: row.exercise_type as ExerciseType,
    attemptNumber: row.attempt_number,
    answer: row.answer as unknown as Answer,
    correct: row.correct,
    score: Number(row.score),
    hintUsed: row.hint_used,
    createdAt: row.created_at,
  }
}

function fromOverrideRow(row: ChapterAccessOverrideRow): ChapterAccessOverride {
  return { studentId: row.student_id, chapterId: row.chapter_id, kind: row.kind, createdAt: row.created_at }
}

export function fromAssessmentRow(row: AssessmentAttemptRow): AssessmentAttemptSummary {
  return {
    id: row.id,
    studentId: row.student_id,
    chapterId: row.chapter_id,
    chapterVersion: row.chapter_version,
    lessonId: row.lesson_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    passMark: row.pass_mark,
    score: row.score ?? undefined,
    passed: row.passed ?? undefined,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at ?? undefined,
  }
}

function fail(message: string): never {
  throw new Error(message)
}

/** PostgREST returns at most 1000 rows per request; list reads page through them. */
const PAGE = 1000

export function createSupabaseProgressRepository(client: AppSupabaseClient, chapters: readonly Chapter[]): ProgressRepository {
  const assessmentLessons = assessmentLessonIndex(chapters)
  return {
    async listLessonProgress(studentId) {
      const [rows, attempts] = await Promise.all([
        client.from('lesson_progress').select('*').eq('student_id', studentId),
        client.from('assessment_attempts').select('*').eq('student_id', studentId).eq('status', 'submitted'),
      ])
      if (rows.error) fail(rows.error.message)
      if (attempts.error) fail(attempts.error.message)
      return mergeAssessmentResults(
        (rows.data as LessonProgressRow[]).map(fromProgressRow),
        (attempts.data as AssessmentAttemptRow[]).map(fromAssessmentRow),
        assessmentLessons,
      )
    },
    async upsertLessonProgress(record) {
      if (assessmentLessons.has(`${record.chapterId}/${record.lessonId}`)) {
        fail('Assessment results are recorded by the server, not as lesson progress.')
      }
      const { error } = await client.from('lesson_progress').upsert(
        {
          student_id: record.studentId,
          chapter_id: record.chapterId,
          lesson_id: record.lessonId,
          status: record.status,
          best_score: record.bestScore ?? null,
          last_score: record.lastScore ?? null,
          completed_at: record.completedAt ?? null,
        },
        { onConflict: 'student_id,chapter_id,lesson_id' },
      )
      if (error) fail(error.message)
    },
    async recordAttempt(attempt) {
      const { error } = await client.from('exercise_attempts').upsert(
        {
          id: attempt.id,
          student_id: attempt.studentId,
          chapter_id: attempt.chapterId,
          chapter_version: attempt.chapterVersion,
          lesson_id: attempt.lessonId,
          exercise_id: attempt.exerciseId,
          exercise_type: attempt.exerciseType,
          attempt_number: attempt.attemptNumber,
          answer: attempt.answer,
          correct: attempt.correct,
          score: attempt.score,
          hint_used: attempt.hintUsed,
          created_at: attempt.createdAt,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (error) fail(error.message)
    },
    async listAttempts(studentId, filter) {
      // Paged past PostgREST's default 1000-row cap: the progress analytics read every attempt.
      const rows: ExerciseAttemptRow[] = []
      for (let from = 0; ; from += PAGE) {
        let query = client
          .from('exercise_attempts')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (filter?.lessonId) query = query.eq('lesson_id', filter.lessonId)
        const { data, error } = await query
        if (error) fail(error.message)
        const page = data as ExerciseAttemptRow[]
        rows.push(...page)
        if (page.length < PAGE) return rows.map(fromAttemptRow)
      }
    },
    async listChapterOverrides(studentId) {
      const { data, error } = await client.from('chapter_access_overrides').select('*').eq('student_id', studentId)
      if (error) fail(error.message)
      return (data as ChapterAccessOverrideRow[]).map(fromOverrideRow)
    },
    async setChapterOverride(override) {
      // Clients may insert and delete but never update an override row, so replace explicitly.
      const removed = await client
        .from('chapter_access_overrides')
        .delete()
        .eq('student_id', override.studentId)
        .eq('chapter_id', override.chapterId)
      if (removed.error) fail(removed.error.message)
      const { error } = await client.from('chapter_access_overrides').insert({
        student_id: override.studentId,
        chapter_id: override.chapterId,
        kind: override.kind,
        created_by: override.createdBy,
      })
      if (error) fail(error.message)
    },
    async clearChapterOverride(studentId, chapterId) {
      const { error } = await client.from('chapter_access_overrides').delete().eq('student_id', studentId).eq('chapter_id', chapterId)
      if (error) fail(error.message)
    },
  }
}

export class AssessmentError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AssessmentError'
    this.code = code
  }
}

async function invokeAssessment(client: AppSupabaseClient, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.functions.invoke('assessment', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
      throw new AssessmentError(payload?.error?.code ?? 'request_failed', payload?.error?.message ?? 'The request was rejected.')
    }
    throw new AssessmentError('network', 'Could not reach the server. Check your connection and try again.')
  }
  const envelope = data as { ok: boolean; data?: unknown; error?: { code: string; message: string } }
  if (!envelope?.ok) throw new AssessmentError(envelope?.error?.code ?? 'request_failed', envelope?.error?.message ?? 'Request failed.')
  return envelope.data
}

export function createSupabaseAssessmentGateway(client: AppSupabaseClient): AssessmentGateway {
  return {
    async start({ chapterId, lessonId }) {
      return (await invokeAssessment(client, { action: 'start', chapterId, lessonId })) as AssessmentStart
    },
    async submit({ attemptId, answers }) {
      return (await invokeAssessment(client, { action: 'submit', attemptId, answers })) as AssessmentResult
    },
    async listAttempts(studentId, filter) {
      const rows: AssessmentAttemptRow[] = []
      for (let from = 0; ; from += PAGE) {
        let query = client
          .from('assessment_attempts')
          .select('*')
          .eq('student_id', studentId)
          .order('started_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (filter?.chapterId) query = query.eq('chapter_id', filter.chapterId)
        if (filter?.lessonId) query = query.eq('lesson_id', filter.lessonId)
        const { data, error } = await query
        if (error) fail(error.message)
        const page = data as AssessmentAttemptRow[]
        rows.push(...page)
        if (page.length < PAGE) return rows.map(fromAssessmentRow)
      }
    },
    async reset({ studentId, chapterId, lessonId }) {
      await invokeAssessment(client, { action: 'reset', studentId, chapterId, lessonId })
    },
  }
}
