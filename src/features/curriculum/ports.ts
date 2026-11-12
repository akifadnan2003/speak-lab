import type { Answer, Chapter, ExerciseType } from './schema'

/**
 * Persistence ports for the curriculum.
 *
 * The exercise engine and the Learn screens depend only on these interfaces.
 * M3 ships an in-memory and a localStorage implementation (see
 * `./persistence/`). The Supabase implementation will map one-to-one onto the
 * planned `exercise_attempts`, `lesson_progress` and `chapter_access` tables
 * (docs/ARCHITECTURE.md §4) without changing any caller.
 *
 * All records carry `studentId` explicitly so the same shapes can be reused
 * by the tutor dashboard, where the tutor reads another student's records.
 */

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped'
export type ChapterStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped'

/** Statuses a student can actually be in (locked/available are derived, never stored). */
export type StoredLessonStatus = Extract<LessonStatus, 'in_progress' | 'completed' | 'skipped'>

export interface ExerciseAttemptRecord {
  /** Client-generated id; doubles as the idempotency key when syncing. */
  readonly id: string
  readonly studentId: string
  readonly chapterId: string
  readonly chapterVersion: number
  readonly lessonId: string
  readonly exerciseId: string
  readonly exerciseType: ExerciseType
  /** 1-based attempt counter within one lesson run. */
  readonly attemptNumber: number
  readonly answer: Answer
  readonly correct: boolean
  /** 0..1 partial credit for multi-part exercises. */
  readonly score: number
  readonly hintUsed: boolean
  /** ISO timestamp. */
  readonly createdAt: string
}

export interface LessonProgressRecord {
  readonly studentId: string
  readonly chapterId: string
  readonly lessonId: string
  readonly status: StoredLessonStatus
  /** Best lesson score in percent, when the lesson is scored. */
  readonly bestScore?: number
  readonly lastScore?: number
  readonly completedAt?: string
  readonly updatedAt: string
}

/** Tutor overrides (M6 UI). Modelled now so unlock logic is final. */
export interface ChapterAccessOverride {
  readonly studentId: string
  readonly chapterId: string
  readonly kind: 'unlock' | 'skip'
  readonly createdAt: string
}

export interface ProgressRepository {
  /**
   * Practice progress plus one synthesised record per assessment lesson with a submitted
   * attempt (see `assessment-rules.ts`). Rows a client wrote for an assessment lesson are ignored.
   */
  listLessonProgress(studentId: string): Promise<readonly LessonProgressRecord[]>
  /** Practice lessons only; assessment results come from `AssessmentGateway.submit`. */
  upsertLessonProgress(record: LessonProgressRecord): Promise<void>
  recordAttempt(attempt: ExerciseAttemptRecord): Promise<void>
  listAttempts(studentId: string, filter?: { lessonId?: string }): Promise<readonly ExerciseAttemptRecord[]>
  listChapterOverrides(studentId: string): Promise<readonly ChapterAccessOverride[]>
  /** Tutor only (enforced server-side): unlock or skip a chapter for a linked student. */
  setChapterOverride(override: ChapterAccessOverride & { readonly createdBy: string }): Promise<void>
  clearChapterOverride(studentId: string, chapterId: string): Promise<void>
}

/* ---------------------------------------------------------------------------
 * Assessments ("chapter checks") are graded by the server. The client never
 * computes or submits a score: it starts an attempt, collects raw answers and
 * submits them; the gateway returns the graded result and what may be shown.
 * ------------------------------------------------------------------------- */

export type AssessmentAttemptStatus = 'in_progress' | 'submitted' | 'voided'

export interface AssessmentAttemptSummary {
  readonly id: string
  readonly studentId: string
  readonly chapterId: string
  readonly chapterVersion: number
  readonly lessonId: string
  readonly attemptNumber: number
  readonly status: AssessmentAttemptStatus
  readonly passMark: number
  readonly score?: number
  readonly passed?: boolean
  readonly startedAt: string
  readonly expiresAt: string
  readonly submittedAt?: string
}

export interface AssessmentExerciseResult {
  readonly exerciseId: string
  readonly correct: boolean
  /** 0..1 */
  readonly score: number
  /** Present only when the server allows disclosure (see `revealAnswers`). */
  readonly correctAnswer?: string
  readonly parts?: readonly { readonly key: string; readonly correct: boolean; readonly expected?: string }[]
}

export interface AssessmentAnswer {
  readonly exerciseId: string
  readonly answer: Answer
}

export interface AssessmentStart {
  readonly attempt: AssessmentAttemptSummary
  /** Submitted attempts so far (the open one is not counted). */
  readonly attemptsUsed: number
  readonly attemptsAllowed: number
}

export interface AssessmentResult {
  readonly attempt: AssessmentAttemptSummary
  readonly results: readonly AssessmentExerciseResult[]
  /** Correct answers are disclosed only after a pass or once the last attempt is used. */
  readonly revealAnswers: boolean
  readonly attemptsUsed: number
  readonly attemptsAllowed: number
}

export interface AssessmentGateway {
  start(input: { studentId: string; chapterId: string; lessonId: string }): Promise<AssessmentStart>
  submit(input: { studentId: string; attemptId: string; answers: readonly AssessmentAnswer[] }): Promise<AssessmentResult>
  listAttempts(studentId: string, filter?: { chapterId?: string; lessonId?: string }): Promise<readonly AssessmentAttemptSummary[]>
  /** Tutor only: void every attempt so the student can retake from attempt 1. */
  reset(input: { studentId: string; chapterId: string; lessonId: string }): Promise<void>
}

export interface ContentSource {
  /** All chapters in curriculum order (A0 → C1), including planned ones. */
  listChapters(): Promise<readonly Chapter[]>
  getChapter(chapterId: string): Promise<Chapter | undefined>
}
