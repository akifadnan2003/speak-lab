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
  listLessonProgress(studentId: string): Promise<readonly LessonProgressRecord[]>
  upsertLessonProgress(record: LessonProgressRecord): Promise<void>
  recordAttempt(attempt: ExerciseAttemptRecord): Promise<void>
  listAttempts(studentId: string, filter?: { lessonId?: string }): Promise<readonly ExerciseAttemptRecord[]>
  listChapterOverrides(studentId: string): Promise<readonly ChapterAccessOverride[]>
}

export interface ContentSource {
  /** All chapters in curriculum order (A0 → C1), including planned ones. */
  listChapters(): Promise<readonly Chapter[]>
  getChapter(chapterId: string): Promise<Chapter | undefined>
}
