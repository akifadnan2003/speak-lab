import type { VocabularyEntry } from './schema'

/**
 * Persistence ports for vocabulary learning.
 *
 * Mirrors the curriculum ports: everything carries `studentId` explicitly,
 * records are plain JSON, and the Supabase implementation will map onto the
 * planned `vocabulary_items`, `student_vocabulary` and `vocabulary_reviews`
 * tables (docs/ARCHITECTURE.md §4) without touching screens or the scheduler.
 */

export type VocabularyStage = 'new' | 'learning' | 'review' | 'mastered'

/** Which ability a review exercised. */
export type VocabularySkill = 'recognition' | 'recall' | 'spoken'

export interface SkillCounter {
  readonly correct: number
  readonly incorrect: number
}

export interface VocabularyState {
  readonly studentId: string
  readonly entryId: string
  readonly stage: VocabularyStage
  /** SM-2 ease factor, bounded [1.3, 3.0]. */
  readonly ease: number
  /** Current interval in days (0 before the first review). */
  readonly intervalDays: number
  /** Consecutive correct answers since the last lapse. */
  readonly repetitions: number
  /** Consecutive correct active-recall answers; drives mastery. */
  readonly recallStreak: number
  /** Times the item fell back from review/mastered. */
  readonly lapses: number
  /** ISO instant when the item is next due; null for an item never reviewed. */
  readonly dueAt: string | null
  readonly lastReviewedAt?: string
  readonly firstLearnedAt?: string
  readonly lastResultCorrect?: boolean
  readonly recognition: SkillCounter
  readonly recall: SkillCounter
  /** Spoken use is self-reported, so only a count is kept. */
  readonly spokenCount: number
  readonly updatedAt: string
}

export interface VocabularyReviewRecord {
  /** Client-generated id; idempotency key when syncing. */
  readonly id: string
  readonly studentId: string
  readonly entryId: string
  readonly modeId: string
  readonly skill: VocabularySkill
  readonly correct: boolean
  /** SM-2 quality 0–5 derived from the answer. */
  readonly quality: number
  readonly hintUsed: boolean
  /** What the learner typed or chose, for tutor review. Omitted for flashcards. */
  readonly answer?: string
  readonly reviewedAt: string
  readonly intervalDaysAfter: number
  readonly stageAfter: VocabularyStage
}

export interface VocabularyRepository {
  listStates(studentId: string): Promise<readonly VocabularyState[]>
  upsertState(state: VocabularyState): Promise<void>
  recordReview(review: VocabularyReviewRecord): Promise<void>
  listReviews(studentId: string, filter?: { entryId?: string; sinceIso?: string }): Promise<readonly VocabularyReviewRecord[]>
  /** Remove every record for one student (explicit reset). */
  clear(studentId: string): Promise<void>
}

export interface VocabularyBankSource {
  listEntries(): Promise<readonly VocabularyEntry[]>
}
