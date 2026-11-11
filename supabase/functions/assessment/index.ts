/**
 * SpeakLab · Edge Function `assessment`
 *
 * Server-side chapter checks. The browser never grades an assessment or writes a score: it starts
 * an attempt, collects raw answers and submits them here. This function verifies the caller with
 * the Auth server, checks the chapter gate from the database, grades every answer with the same
 * engine and content the app ships (generated copy under `../_shared`, see
 * scripts/sync-function-shared.mjs), and is the only writer of `assessment_attempts`.
 *
 * Actions (JSON body `{ action, ... }`):
 *   start   { chapterId, lessonId }                  → opens (or returns) the student's attempt
 *   submit  { attemptId, answers: [{ exerciseId, answer }] } → grades, stores, returns results
 *   reset   { studentId, chapterId, lessonId }       → tutor only: voids attempts for a retake
 *
 * Rules (shared with the client in `assessment-rules.ts`): MAX_ASSESSMENT_ATTEMPTS submitted
 * attempts per chapter version, an open attempt expires after ASSESSMENT_ATTEMPT_TTL_MS, and the
 * correct answers are disclosed only after a pass or once the last attempt is used.
 *
 * Every response is `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { z } from 'npm:zod@4.6.7'
import {
  ASSESSMENT_ATTEMPT_TTL_MS,
  assessmentLessonIndex,
  countUsedAttempts,
  MAX_ASSESSMENT_ATTEMPTS,
  mergeAssessmentResults,
  revealAnswersAfter,
} from '../_shared/features/curriculum/assessment-rules.ts'
import { CURRICULUM } from '../_shared/features/curriculum/content/index.ts'
import type {
  AssessmentAttemptSummary,
  AssessmentExerciseResult,
  ChapterAccessOverride,
  LessonProgressRecord,
} from '../_shared/features/curriculum/ports.ts'
import { computeProgression, scoreLesson } from '../_shared/features/curriculum/progression.ts'
import { AnswerSchema, type Answer, type Chapter, type Lesson } from '../_shared/features/curriculum/schema/index.ts'
import { emptyAnswer, grade } from '../_shared/features/exercises/engine/grade.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SECRET_KEY = readSecretKey()

function readSecretKey(): string {
  const json = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>
      const first = parsed['default'] ?? Object.values(parsed)[0]
      if (first) return first
    } catch {
      /* fall through */
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const contentId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), chapterId: contentId, lessonId: contentId }),
  z.object({
    action: z.literal('submit'),
    attemptId: z.uuid(),
    answers: z.array(z.object({ exerciseId: contentId, answer: AnswerSchema })).max(300),
  }),
  z.object({ action: z.literal('reset'), studentId: z.uuid(), chapterId: contentId, lessonId: contentId }),
])
type Body = z.infer<typeof bodySchema>

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function fail(status: number, code: string, message: string): Response {
  return json(status, { ok: false, error: { code, message } })
}

interface Caller {
  readonly id: string
  readonly role: 'tutor' | 'student'
}

async function authenticate(req: Request, admin: SupabaseClient): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')
  const asCaller = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await asCaller.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'unauthenticated', 'Your session is not valid. Sign in again.')
  const profile = await admin.from('profiles').select('id, role, status').eq('id', data.user.id).maybeSingle()
  if (profile.error) throw new HttpError(500, 'profile_lookup_failed', profile.error.message)
  if (!profile.data || profile.data.status !== 'active') {
    throw new HttpError(403, 'forbidden', 'This account is not active.')
  }
  return { id: data.user.id as string, role: profile.data.role as Caller['role'] }
}

/* ------------------------------------------------------------------ rows */

interface AttemptRow {
  id: string
  student_id: string
  chapter_id: string
  chapter_version: number
  lesson_id: string
  attempt_number: number
  status: 'in_progress' | 'submitted' | 'voided'
  pass_mark: number
  answers: unknown[]
  results: unknown[]
  score: number | null
  passed: boolean | null
  started_at: string
  expires_at: string
  submitted_at: string | null
}

function toSummary(row: AttemptRow): AssessmentAttemptSummary {
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

function findAssessment(chapterId: string, lessonId: string): { chapter: Chapter; lesson: Lesson } {
  const chapter = CURRICULUM.find((c) => c.id === chapterId)
  const lesson = chapter?.lessons.find((l) => l.id === lessonId)
  if (!chapter || !lesson || chapter.status !== 'authored') throw new HttpError(404, 'not_found', 'This chapter check does not exist.')
  if (lesson.kind !== 'assessment') throw new HttpError(400, 'not_an_assessment', 'Only chapter checks are graded here.')
  return { chapter, lesson }
}

async function listAttempts(admin: SupabaseClient, studentId: string, chapterId: string, lessonId: string): Promise<AttemptRow[]> {
  const { data, error } = await admin
    .from('assessment_attempts')
    .select('*')
    .eq('student_id', studentId)
    .eq('chapter_id', chapterId)
    .eq('lesson_id', lessonId)
    .order('started_at', { ascending: true })
  if (error) throw new HttpError(500, 'db_error', error.message)
  return data as AttemptRow[]
}

/** The chapter gate, computed from the database exactly as the Learn screen computes it. */
async function assertLessonOpen(admin: SupabaseClient, studentId: string, chapterId: string, lessonId: string) {
  const [progress, overrides, attempts] = await Promise.all([
    admin.from('lesson_progress').select('*').eq('student_id', studentId),
    admin.from('chapter_access_overrides').select('*').eq('student_id', studentId),
    admin.from('assessment_attempts').select('*').eq('student_id', studentId).eq('status', 'submitted'),
  ])
  if (progress.error) throw new HttpError(500, 'db_error', progress.error.message)
  if (overrides.error) throw new HttpError(500, 'db_error', overrides.error.message)
  if (attempts.error) throw new HttpError(500, 'db_error', attempts.error.message)
  const rows: LessonProgressRecord[] = (progress.data as Record<string, unknown>[]).map((r) => ({
    studentId: r.student_id as string,
    chapterId: r.chapter_id as string,
    lessonId: r.lesson_id as string,
    status: r.status as LessonProgressRecord['status'],
    bestScore: (r.best_score as number | null) ?? undefined,
    lastScore: (r.last_score as number | null) ?? undefined,
    completedAt: (r.completed_at as string | null) ?? undefined,
    updatedAt: r.updated_at as string,
  }))
  const overrideRecords: ChapterAccessOverride[] = (overrides.data as Record<string, unknown>[]).map((r) => ({
    studentId: r.student_id as string,
    chapterId: r.chapter_id as string,
    kind: r.kind as ChapterAccessOverride['kind'],
    createdAt: r.created_at as string,
  }))
  const merged = mergeAssessmentResults(rows, (attempts.data as AttemptRow[]).map(toSummary), assessmentLessonIndex(CURRICULUM))
  const states = computeProgression({ chapters: CURRICULUM, lessonProgress: merged, overrides: overrideRecords })
  const lessonState = states.get(chapterId)?.lessons.find((l) => l.lesson.id === lessonId)
  if (!lessonState || lessonState.status === 'locked') {
    throw new HttpError(403, 'locked', 'Finish every other lesson in the chapter (and the previous chapters) before the chapter check.')
  }
}

async function logEvent(admin: SupabaseClient, event: { user_id: string; actor_id: string; event_type: string; metadata: Record<string, unknown> }) {
  const { error } = await admin.from('account_events').insert(event)
  if (error) console.error('account_events insert failed', error.message)
}

/* --------------------------------------------------------------- actions */

async function start(caller: Caller, body: Extract<Body, { action: 'start' }>, admin: SupabaseClient) {
  if (caller.role !== 'student') throw new HttpError(403, 'forbidden', 'Only students take chapter checks.')
  const { chapter } = findAssessment(body.chapterId, body.lessonId)
  await assertLessonOpen(admin, caller.id, body.chapterId, body.lessonId)

  const attempts = await listAttempts(admin, caller.id, body.chapterId, body.lessonId)
  const attemptsUsed = countUsedAttempts(attempts.map(toSummary), chapter.version)
  const now = Date.now()
  const open = attempts.find((a) => a.status === 'in_progress')
  if (open && new Date(open.expires_at).getTime() > now) {
    return { attempt: toSummary(open), attemptsUsed, attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS }
  }
  if (open) {
    const voided = await admin
      .from('assessment_attempts')
      .update({ status: 'voided', voided_at: new Date(now).toISOString() })
      .eq('id', open.id)
    if (voided.error) throw new HttpError(500, 'db_error', voided.error.message)
  }
  if (attemptsUsed >= MAX_ASSESSMENT_ATTEMPTS) {
    throw new HttpError(409, 'retakes_exhausted', 'No attempts left for this chapter check. Ask your tutor to allow a retake.')
  }
  const inserted = await admin
    .from('assessment_attempts')
    .insert({
      student_id: caller.id,
      chapter_id: chapter.id,
      chapter_version: chapter.version,
      lesson_id: body.lessonId,
      attempt_number: attemptsUsed + 1,
      status: 'in_progress',
      pass_mark: chapter.completion.passMark,
      started_at: new Date(now).toISOString(),
      expires_at: new Date(now + ASSESSMENT_ATTEMPT_TTL_MS).toISOString(),
    })
    .select('*')
    .single()
  if (inserted.error) throw new HttpError(500, 'db_error', inserted.error.message)
  return { attempt: toSummary(inserted.data as AttemptRow), attemptsUsed, attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS }
}

async function submit(caller: Caller, body: Extract<Body, { action: 'submit' }>, admin: SupabaseClient) {
  if (caller.role !== 'student') throw new HttpError(403, 'forbidden', 'Only students take chapter checks.')
  const found = await admin.from('assessment_attempts').select('*').eq('id', body.attemptId).eq('student_id', caller.id).maybeSingle()
  if (found.error) throw new HttpError(500, 'db_error', found.error.message)
  const attempt = found.data as AttemptRow | null
  if (!attempt) throw new HttpError(404, 'not_found', 'Unknown attempt.')
  if (attempt.status === 'voided') throw new HttpError(409, 'attempt_voided', 'This attempt was cancelled. Start a new one.')
  const { chapter, lesson } = findAssessment(attempt.chapter_id, attempt.lesson_id)
  if (attempt.chapter_version !== chapter.version) {
    throw new HttpError(409, 'content_changed', 'This chapter was updated while you were working. Start a new attempt.')
  }

  // Grade from the stored answers when already submitted (idempotent), otherwise from the body.
  const source: readonly { exerciseId: string; answer: Answer }[] =
    attempt.status === 'submitted' ? (attempt.answers as { exerciseId: string; answer: Answer }[]) : body.answers
  const byId = new Map(source.map((a) => [a.exerciseId, a.answer]))
  const graded = lesson.exercises.map((exercise) => {
    const given = byId.get(exercise.id)
    const answer = given && given.type === exercise.type ? given : emptyAnswer(exercise)
    return { exercise, result: grade(exercise, answer) }
  })

  let stored = attempt
  if (attempt.status === 'in_progress') {
    if (new Date(attempt.expires_at).getTime() < Date.now()) {
      await admin.from('assessment_attempts').update({ status: 'voided', voided_at: new Date().toISOString() }).eq('id', attempt.id)
      throw new HttpError(409, 'attempt_expired', 'This attempt expired. Start a new one.')
    }
    const score = scoreLesson(graded.map((g) => g.result.score))
    const passed = score >= chapter.completion.passMark
    const updated = await admin
      .from('assessment_attempts')
      .update({
        status: 'submitted',
        answers: body.answers,
        results: graded.map((g) => ({ exerciseId: g.exercise.id, correct: g.result.correct, score: g.result.score })),
        score,
        passed,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', attempt.id)
      .eq('status', 'in_progress')
      .select('*')
      .maybeSingle()
    if (updated.error) throw new HttpError(500, 'db_error', updated.error.message)
    if (!updated.data) throw new HttpError(409, 'conflict', 'This attempt was submitted elsewhere. Reload to see the result.')
    stored = updated.data as AttemptRow
    await logEvent(admin, {
      user_id: caller.id,
      actor_id: caller.id,
      event_type: 'assessment_submitted',
      metadata: { chapter_id: chapter.id, lesson_id: lesson.id, attempt_number: stored.attempt_number, score, passed },
    })
  }

  const all = await listAttempts(admin, caller.id, attempt.chapter_id, attempt.lesson_id)
  const attemptsUsed = countUsedAttempts(all.map(toSummary), chapter.version)
  const revealAnswers = revealAnswersAfter(stored.passed === true, attemptsUsed)
  const results: AssessmentExerciseResult[] = graded.map(({ exercise, result }) => ({
    exerciseId: exercise.id,
    correct: result.correct,
    score: result.score,
    ...(revealAnswers ? { correctAnswer: result.correctAnswer, parts: result.parts } : {}),
  }))
  return { attempt: toSummary(stored), results, revealAnswers, attemptsUsed, attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS }
}

async function reset(caller: Caller, body: Extract<Body, { action: 'reset' }>, admin: SupabaseClient) {
  if (caller.role !== 'tutor') throw new HttpError(403, 'forbidden', 'Only the tutor can reset a chapter check.')
  const link = await admin.from('tutor_students').select('student_id').eq('tutor_id', caller.id).eq('student_id', body.studentId).maybeSingle()
  if (link.error) throw new HttpError(500, 'db_error', link.error.message)
  if (!link.data) throw new HttpError(403, 'forbidden', 'This learner is not assigned to you.')
  findAssessment(body.chapterId, body.lessonId)
  const voided = await admin
    .from('assessment_attempts')
    .update({ status: 'voided', voided_at: new Date().toISOString() })
    .eq('student_id', body.studentId)
    .eq('chapter_id', body.chapterId)
    .eq('lesson_id', body.lessonId)
    .neq('status', 'voided')
    .select('id')
  if (voided.error) throw new HttpError(500, 'db_error', voided.error.message)
  await logEvent(admin, {
    user_id: body.studentId,
    actor_id: caller.id,
    event_type: 'assessment_reset',
    metadata: { chapter_id: body.chapterId, lesson_id: body.lessonId, voided: (voided.data ?? []).length },
  })
  return { voided: (voided.data ?? []).length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')
  if (!SUPABASE_URL || !PUBLIC_KEY || !SECRET_KEY) return fail(500, 'misconfigured', 'Function secrets are not configured.')

  const admin = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  try {
    const caller = await authenticate(req, admin)
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      throw new HttpError(400, 'invalid_json', 'Request body must be JSON.')
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', parsed.error.issues[0]?.message ?? 'Invalid request.')
    const body = parsed.data
    const data =
      body.action === 'start' ? await start(caller, body, admin) : body.action === 'submit' ? await submit(caller, body, admin) : await reset(caller, body, admin)
    return json(200, { ok: true, data })
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.code, error.message)
    console.error('assessment unexpected error', error)
    return fail(500, 'internal', 'Something went wrong. Try again.')
  }
})
