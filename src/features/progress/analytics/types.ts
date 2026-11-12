import type { ChapterState } from '@/features/curriculum/progression'
import type { AssessmentAttemptSummary, ExerciseAttemptRecord, LessonProgressRecord } from '@/features/curriculum/ports'
import type { Chapter } from '@/features/curriculum/schema'
import type { VocabularyReviewRecord, VocabularyState } from '@/features/vocabulary/ports'
import type { VocabularyEntry } from '@/features/vocabulary/schema'

/**
 * Everything the analytics functions read. All of it already exists under RLS; nothing here is
 * computed on the server. The same shape serves the student's own screens and the tutor's
 * read-only summary of a linked student (the id simply differs).
 *
 * Metric definitions: docs/PROGRESS_METRICS.md.
 */
export interface LearningRecords {
  readonly studentId: string
  readonly chapters: readonly Chapter[]
  /** `computeProgression` output for the same chapters and progress. */
  readonly progression: ReadonlyMap<string, ChapterState>
  readonly lessonProgress: readonly LessonProgressRecord[]
  readonly attempts: readonly ExerciseAttemptRecord[]
  readonly assessments: readonly AssessmentAttemptSummary[]
  readonly vocabularyEntries: readonly VocabularyEntry[]
  readonly vocabularyStates: readonly VocabularyState[]
  readonly vocabularyReviews: readonly VocabularyReviewRecord[]
}

/** When and where "today" is. Calendar days follow the learner's device time zone. */
export interface Clock {
  readonly now: Date
  readonly timeZone?: string
}
