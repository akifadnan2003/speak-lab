import { daysBetweenKeys } from '@/features/vocabulary/srs/time'
import { activeDays, completedPracticeLessons, submittedAssessments } from './records'
import type { Clock, LearningRecords } from './types'

/**
 * Evidence-based achievements. Definitions: docs/PROGRESS_METRICS.md §6.
 *
 * Deterministic: the same records always yield the same achievements with the same `earnedAt`.
 * Nothing is awarded for signing in or opening a page. Unearned achievements are listed too so
 * the learner knows what counts.
 */
export type AchievementId =
  | 'first_lesson'
  | 'first_chapter_passed'
  | 'first_vocabulary_review'
  | 'vocabulary_50_reviews'
  | 'vocabulary_25_learned'
  | 'streak_7'
  | 'perfect_check'

export interface Achievement {
  readonly id: AchievementId
  readonly title: string
  readonly description: string
  /** ISO instant of the record that earned it; absent when not earned yet. */
  readonly earnedAt?: string
  /** Progress towards the achievement when it is countable (e.g. 12 of 50). */
  readonly progress?: { readonly current: number; readonly target: number }
}

export const STREAK_TARGET_DAYS = 7
export const VOCABULARY_REVIEWS_TARGET = 50
export const VOCABULARY_LEARNED_TARGET = 25

/** Instant at the end of the given calendar day key (used when only a day is known). */
function endOfDay(key: string): string {
  return `${key}T23:59:59.000Z`
}

export function computeAchievements(records: LearningRecords, clock: Clock): readonly Achievement[] {
  const lessons = completedPracticeLessons(records)
  const checks = submittedAssessments(records.assessments).sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!))
  const reviews = [...new Map(records.vocabularyReviews.map((r) => [r.id, r])).values()].sort(
    (a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id),
  )
  const learned = records.vocabularyStates
    .filter((s) => s.stage !== 'new' && s.firstLearnedAt)
    .sort((a, b) => a.firstLearnedAt!.localeCompare(b.firstLearnedAt!) || a.entryId.localeCompare(b.entryId))

  const firstPass = checks.find((c) => c.passed)
  const perfect = checks.find((c) => c.score === 100)

  // Longest run of consecutive active days; earned on the day the run reaches the target.
  const days = [...activeDays(records, clock)].sort()
  let streakEarned: string | undefined
  let bestRun = 0
  let run = 0
  for (let i = 0; i < days.length; i++) {
    const prev = days[i - 1]
    run = prev && daysBetweenKeys(prev, days[i]!) === 1 ? run + 1 : 1
    bestRun = Math.max(bestRun, run)
    if (run === STREAK_TARGET_DAYS && !streakEarned) streakEarned = endOfDay(days[i]!)
  }

  const list: Achievement[] = [
    {
      id: 'first_lesson',
      title: 'First lesson completed',
      description: 'Finish any practice lesson',
      ...(lessons[0] ? { earnedAt: lessons[0].record.completedAt! } : {}),
    },
    {
      id: 'first_chapter_passed',
      title: 'First chapter check passed',
      description: 'Score at least the pass mark in a chapter check',
      ...(firstPass ? { earnedAt: firstPass.submittedAt! } : {}),
    },
    {
      id: 'perfect_check',
      title: 'Perfect chapter check',
      description: 'Score 100% in a chapter check',
      ...(perfect ? { earnedAt: perfect.submittedAt! } : {}),
    },
    {
      id: 'first_vocabulary_review',
      title: 'First vocabulary review',
      description: 'Answer one vocabulary question',
      ...(reviews[0] ? { earnedAt: reviews[0].reviewedAt } : {}),
    },
    {
      id: 'vocabulary_50_reviews',
      title: '50 vocabulary reviews',
      description: 'Record 50 vocabulary answers',
      progress: { current: Math.min(reviews.length, VOCABULARY_REVIEWS_TARGET), target: VOCABULARY_REVIEWS_TARGET },
      ...(reviews[VOCABULARY_REVIEWS_TARGET - 1] ? { earnedAt: reviews[VOCABULARY_REVIEWS_TARGET - 1]!.reviewedAt } : {}),
    },
    {
      id: 'vocabulary_25_learned',
      title: '25 words learned',
      description: 'Move 25 words out of "new"',
      progress: { current: Math.min(learned.length, VOCABULARY_LEARNED_TARGET), target: VOCABULARY_LEARNED_TARGET },
      ...(learned[VOCABULARY_LEARNED_TARGET - 1] ? { earnedAt: learned[VOCABULARY_LEARNED_TARGET - 1]!.firstLearnedAt! } : {}),
    },
    {
      id: 'streak_7',
      title: '7 days in a row',
      description: 'Learn something on seven consecutive days',
      progress: { current: Math.min(bestRun, STREAK_TARGET_DAYS), target: STREAK_TARGET_DAYS },
      ...(streakEarned ? { earnedAt: streakEarned } : {}),
    },
  ]
  // Earned first (newest first), then the rest in definition order.
  return [...list.filter((a) => a.earnedAt).sort((a, b) => b.earnedAt!.localeCompare(a.earnedAt!)), ...list.filter((a) => !a.earnedAt)]
}
