import type { AssessmentAttemptSummary, ExerciseAttemptRecord, LessonProgressRecord } from '@/features/curriculum/ports'
import type { Chapter, Lesson } from '@/features/curriculum/schema'
import { dateKey } from '@/features/vocabulary/srs/time'
import type { Clock, LearningRecords } from './types'

/**
 * Shared record helpers for the analytics modules. Pure, deterministic, no I/O.
 */

export interface LessonRef {
  readonly chapter: Chapter
  readonly lesson: Lesson
}

export function lessonIndex(chapters: readonly Chapter[]): ReadonlyMap<string, LessonRef> {
  const index = new Map<string, LessonRef>()
  for (const chapter of chapters) for (const lesson of chapter.lessons) index.set(`${chapter.id}/${lesson.id}`, { chapter, lesson })
  return index
}

export function lessonKey(chapterId: string, lessonId: string): string {
  return `${chapterId}/${lessonId}`
}

/** Practice lessons (everything but the chapter check) of authored chapters. */
export function isPracticeLesson(ref: LessonRef | undefined): ref is LessonRef {
  return ref !== undefined && ref.chapter.status === 'authored' && ref.lesson.kind !== 'assessment'
}

/** Calendar day (`YYYY-MM-DD`) of an ISO instant in the learner's zone. */
export function dayOf(iso: string, clock: Clock): string {
  return dateKey(new Date(iso), clock.timeZone)
}

export function todayKey(clock: Clock): string {
  return dateKey(clock.now, clock.timeZone)
}

/** Submitted chapter checks only: open or voided attempts are not outcomes. */
export function submittedAssessments(assessments: readonly AssessmentAttemptSummary[]): AssessmentAttemptSummary[] {
  return assessments.filter((a) => a.status === 'submitted' && a.submittedAt !== undefined && a.score !== undefined)
}

/** Completed practice lessons with their completion instant, one per lesson. */
export function completedPracticeLessons(records: LearningRecords): { record: LessonProgressRecord; ref: LessonRef }[] {
  const index = lessonIndex(records.chapters)
  const out: { record: LessonProgressRecord; ref: LessonRef }[] = []
  for (const record of records.lessonProgress) {
    if (record.status !== 'completed' || !record.completedAt) continue
    const ref = index.get(lessonKey(record.chapterId, record.lessonId))
    if (!isPracticeLesson(ref)) continue
    out.push({ record, ref })
  }
  return out.sort((a, b) => a.record.completedAt!.localeCompare(b.record.completedAt!) || a.record.lessonId.localeCompare(b.record.lessonId))
}

/**
 * First tries: for every exercise, the most recent attempt with `attemptNumber === 1`, i.e. the
 * first answer of the latest run. Retries within a run (attempt 2, 3) and earlier runs are
 * ignored, so repeating a lesson neither inflates nor double-counts accuracy.
 */
export function latestFirstTries(attempts: readonly ExerciseAttemptRecord[]): ReadonlyMap<string, ExerciseAttemptRecord> {
  const byExercise = new Map<string, ExerciseAttemptRecord>()
  for (const attempt of attempts) {
    if (attempt.attemptNumber !== 1) continue
    const key = `${attempt.chapterId}/${attempt.lessonId}/${attempt.exerciseId}`
    const current = byExercise.get(key)
    if (!current || attempt.createdAt > current.createdAt || (attempt.createdAt === current.createdAt && attempt.id > current.id)) {
      byExercise.set(key, attempt)
    }
  }
  return byExercise
}

/** Distinct attempt rows by id (the id is the idempotency key, so duplicates are the same event). */
export function uniqueAttempts(attempts: readonly ExerciseAttemptRecord[]): ExerciseAttemptRecord[] {
  const seen = new Map<string, ExerciseAttemptRecord>()
  for (const attempt of attempts) if (!seen.has(attempt.id)) seen.set(attempt.id, attempt)
  return [...seen.values()]
}

/** Mean of 0..1 scores as a percentage, or null without evidence. */
export function percent(scores: readonly number[]): number | null {
  if (scores.length === 0) return null
  const total = scores.reduce((sum, s) => sum + Math.min(1, Math.max(0, s)), 0)
  return Math.round((total / scores.length) * 100)
}

/**
 * Every calendar day with genuine learning activity: a practice lesson completed, an exercise
 * answered, a chapter check submitted, or a vocabulary answer recorded. Used by the streak and
 * the consistency achievement. Opening a page is not activity.
 */
export function activeDays(records: LearningRecords, clock: Clock): ReadonlySet<string> {
  const days = new Set<string>()
  for (const { record } of completedPracticeLessons(records)) days.add(dayOf(record.completedAt!, clock))
  for (const attempt of uniqueAttempts(records.attempts)) days.add(dayOf(attempt.createdAt, clock))
  for (const a of submittedAssessments(records.assessments)) days.add(dayOf(a.submittedAt!, clock))
  for (const review of records.vocabularyReviews) days.add(dayOf(review.reviewedAt, clock))
  return days
}

/** Latest instant of any learning activity, or null for a brand-new learner. */
export function latestActivityAt(records: LearningRecords): string | null {
  let latest: string | null = null
  const consider = (iso: string | undefined) => {
    if (iso && (!latest || iso > latest)) latest = iso
  }
  for (const r of records.lessonProgress) consider(r.updatedAt)
  for (const a of records.attempts) consider(a.createdAt)
  for (const a of submittedAssessments(records.assessments)) consider(a.submittedAt)
  for (const r of records.vocabularyReviews) consider(r.reviewedAt)
  return latest
}
