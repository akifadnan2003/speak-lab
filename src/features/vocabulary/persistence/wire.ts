import type { SelfGrade } from '../srs/scheduler'
import type { VocabularySkill, VocabularyStage, VocabularyReviewRecord, VocabularyState } from '../ports'

/**
 * Wire shapes for the vocabulary tables and functions in
 * `supabase/migrations/20261111160800_vocabulary_persistence.sql`.
 *
 * Kept inside the vocabulary feature (not `src/lib/supabase/database.types.ts`) so this work does
 * not touch files the M3 integration is editing; they can be moved there afterwards.
 */

export interface StudentVocabularyRow {
  student_id: string
  entry_id: string
  stage: VocabularyStage
  /** numeric(4,2): PostgREST returns a number, PGlite/pg may return a string. */
  ease: number | string
  interval_days: number
  repetitions: number
  recall_streak: number
  lapses: number
  due_at: string | null
  last_reviewed_at: string | null
  first_learned_at: string | null
  last_result_correct: boolean | null
  recognition_correct: number
  recognition_incorrect: number
  recall_correct: number
  recall_incorrect: number
  spoken_count: number
  review_count: number
  last_review_id: string | null
  created_at: string
  updated_at: string
}

export interface VocabularyReviewRow {
  id: string
  student_id: string
  entry_id: string
  mode_id: string
  skill: VocabularySkill
  correct: boolean
  quality: number
  hint_used: boolean
  self_grade: SelfGrade | null
  answer: string | null
  reviewed_at: string
  received_at: string
  source: 'live' | 'import'
  applied: boolean
  stage_after: VocabularyStage
  interval_days_after: number
  due_at_after: string | null
  voided_at: string | null
}

/** One review as sent to `record_vocabulary_reviews`. Quality, interval and stage are never sent. */
export interface ReviewPayload {
  id: string
  entry_id: string
  mode_id: string
  skill: VocabularySkill
  correct: boolean
  hint_used: boolean
  self_grade?: SelfGrade
  answer?: string
  reviewed_at: string
}

export type ReviewStatus = 'applied' | 'recorded' | 'duplicate' | 'rejected'

export interface RecordReviewsResult {
  results: { id: string | null; status: ReviewStatus; reason?: string | null }[]
  states: StudentVocabularyRow[]
  reset_at: string | null
}

export const STATE_COLUMNS =
  'student_id, entry_id, stage, ease, interval_days, repetitions, recall_streak, lapses, due_at, last_reviewed_at, first_learned_at, last_result_correct, recognition_correct, recognition_incorrect, recall_correct, recall_incorrect, spoken_count, review_count, last_review_id, created_at, updated_at'

export const REVIEW_COLUMNS =
  'id, student_id, entry_id, mode_id, skill, correct, quality, hint_used, self_grade, answer, reviewed_at, received_at, source, applied, stage_after, interval_days_after, due_at_after, voided_at'

/** Flashcard quality is the learner's own grade; the server needs the grade, not the number. */
const SELF_GRADE_BY_QUALITY: Partial<Record<number, SelfGrade>> = { 1: 'again', 3: 'hard', 4: 'good', 5: 'easy' }

export function toReviewPayload(review: VocabularyReviewRecord): ReviewPayload {
  const selfGrade = review.modeId === 'flashcards' ? SELF_GRADE_BY_QUALITY[review.quality] : undefined
  return {
    id: review.id,
    entry_id: review.entryId,
    mode_id: review.modeId,
    skill: review.skill,
    correct: review.correct,
    hint_used: review.hintUsed,
    ...(selfGrade ? { self_grade: selfGrade } : {}),
    ...(review.answer !== undefined ? { answer: review.answer.slice(0, 200) } : {}),
    reviewed_at: review.reviewedAt,
  }
}

function iso(value: string | Date | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? undefined : new Date(t).toISOString()
}

/** Server row → the app's state shape. Instants are normalised to UTC `toISOString()` form. */
export function stateFromRow(row: StudentVocabularyRow): VocabularyState {
  const lastReviewedAt = iso(row.last_reviewed_at)
  const firstLearnedAt = iso(row.first_learned_at)
  return {
    studentId: row.student_id,
    entryId: row.entry_id,
    stage: row.stage,
    ease: Number(row.ease),
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    recallStreak: row.recall_streak,
    lapses: row.lapses,
    dueAt: iso(row.due_at) ?? null,
    ...(lastReviewedAt ? { lastReviewedAt } : {}),
    ...(firstLearnedAt ? { firstLearnedAt } : {}),
    ...(row.last_result_correct !== null ? { lastResultCorrect: row.last_result_correct } : {}),
    recognition: { correct: row.recognition_correct, incorrect: row.recognition_incorrect },
    recall: { correct: row.recall_correct, incorrect: row.recall_incorrect },
    spokenCount: row.spoken_count,
    updatedAt: iso(row.updated_at) ?? new Date(0).toISOString(),
  }
}

export function reviewFromRow(row: VocabularyReviewRow): VocabularyReviewRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    entryId: row.entry_id,
    modeId: row.mode_id,
    skill: row.skill,
    correct: row.correct,
    quality: row.quality,
    hintUsed: row.hint_used,
    ...(row.answer !== null ? { answer: row.answer } : {}),
    reviewedAt: iso(row.reviewed_at) ?? row.reviewed_at,
    intervalDaysAfter: row.interval_days_after,
    stageAfter: row.stage_after,
  }
}
