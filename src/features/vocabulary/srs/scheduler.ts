import type { VocabularySkill, VocabularyStage, VocabularyState } from '../ports'
import { addDays } from './time'

/**
 * SM-2-style spaced repetition, adapted for SpeakLab.
 *
 * This is the classic SuperMemo-2 interval/ease scheme with three
 * adaptations, all explainable and deterministic:
 *
 * 1. Learning steps. The first two correct answers schedule 1 and 3 days
 *    instead of SM-2's 1 and 6, because our learners meet words in lessons
 *    and need a quick second exposure.
 * 2. Mastery is earned by active recall. Recognising a meaning (multiple
 *    choice, matching) counts for scheduling but only consecutive correct
 *    *recall* answers (typing or saying the word) advance the recall streak
 *    that unlocks `mastered` (interval ≥ 21 days and streak ≥ 3).
 * 3. Lapses are remembered. A wrong answer on a review/mastered item moves it
 *    back to `learning`, resets the interval to one day, lowers ease by 0.2
 *    and increments `lapses`, so the revision queue can reinforce it.
 *
 * No claim is made that these parameters are optimal; they are the SM-2
 * defaults plus the three documented changes, and `docs/ROADMAP.md` lists
 * tuning them from real review data as later work.
 */

export const EASE_DEFAULT = 2.5
export const EASE_MIN = 1.3
export const EASE_MAX = 3.0
export const MASTERY_INTERVAL_DAYS = 21
export const MASTERY_RECALL_STREAK = 3
const LEARNING_STEPS_DAYS = [1, 3, 6] as const

export type SelfGrade = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewInput {
  readonly skill: VocabularySkill
  readonly correct: boolean
  readonly hintUsed?: boolean
  /** Flashcards: the learner's own judgement, which replaces correct/hint. */
  readonly selfGrade?: SelfGrade
  readonly now: Date
}

export interface ScheduleResult {
  readonly state: VocabularyState
  readonly quality: number
}

export function createInitialState(studentId: string, entryId: string, now: Date): VocabularyState {
  return {
    studentId,
    entryId,
    stage: 'new',
    ease: EASE_DEFAULT,
    intervalDays: 0,
    repetitions: 0,
    recallStreak: 0,
    lapses: 0,
    dueAt: null,
    recognition: { correct: 0, incorrect: 0 },
    recall: { correct: 0, incorrect: 0 },
    spokenCount: 0,
    updatedAt: now.toISOString(),
  }
}

/** SM-2 quality 0–5 derived from what happened. */
export function qualityFor(input: Pick<ReviewInput, 'skill' | 'correct' | 'hintUsed' | 'selfGrade'>): number {
  if (input.selfGrade) {
    switch (input.selfGrade) {
      case 'again':
        return 1
      case 'hard':
        return 3
      case 'good':
        return 4
      case 'easy':
        return 5
    }
  }
  if (!input.correct) return 1
  if (input.skill === 'recall' || input.skill === 'spoken') return input.hintUsed ? 4 : 5
  return 4
}

export function isCorrectQuality(quality: number): boolean {
  return quality >= 3
}

function clampEase(ease: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, Math.round(ease * 100) / 100))
}

/** SM-2 ease update. */
export function nextEase(ease: number, quality: number): number {
  return clampEase(ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
}

export function nextInterval(previousInterval: number, repetitions: number, ease: number): number {
  const step = LEARNING_STEPS_DAYS[repetitions - 1]
  if (step !== undefined) return step
  return Math.max(LEARNING_STEPS_DAYS[2] + 1, Math.round(previousInterval * ease))
}

export function isDue(state: VocabularyState, now: Date): boolean {
  return state.dueAt !== null && new Date(state.dueAt).getTime() <= now.getTime()
}

/** Pure transition: returns the next state and the quality that produced it. */
export function schedule(state: VocabularyState, input: ReviewInput): ScheduleResult {
  const quality = qualityFor(input)
  const correct = isCorrectQuality(quality)
  const nowIso = input.now.toISOString()
  const skillCounts = bumpCounters(state, input.skill, correct)

  if (!correct) {
    const lapsed = state.stage === 'review' || state.stage === 'mastered'
    const next: VocabularyState = {
      ...state,
      ...skillCounts,
      stage: 'learning',
      ease: clampEase(state.ease - 0.2),
      intervalDays: 1,
      repetitions: 0,
      recallStreak: 0,
      lapses: state.lapses + (lapsed ? 1 : 0),
      dueAt: addDays(input.now, 1).toISOString(),
      lastReviewedAt: nowIso,
      firstLearnedAt: state.firstLearnedAt ?? nowIso,
      lastResultCorrect: false,
      updatedAt: nowIso,
    }
    return { state: next, quality }
  }

  const repetitions = state.repetitions + 1
  const ease = nextEase(state.ease, quality)
  let intervalDays = nextInterval(state.intervalDays, repetitions, ease)
  // "Hard" keeps the item close: never more than a 1.2× stretch.
  if (quality === 3 && repetitions > 1) intervalDays = Math.max(1, Math.min(intervalDays, Math.round(state.intervalDays * 1.2)))
  const recallStreak = input.skill === 'recognition' ? state.recallStreak : state.recallStreak + 1

  let stage: VocabularyStage
  if (intervalDays >= MASTERY_INTERVAL_DAYS && recallStreak >= MASTERY_RECALL_STREAK) stage = 'mastered'
  else if (state.stage === 'mastered') stage = 'mastered'
  else if (repetitions >= LEARNING_STEPS_DAYS.length) stage = 'review'
  else stage = 'learning'

  const next: VocabularyState = {
    ...state,
    ...skillCounts,
    stage,
    ease,
    intervalDays,
    repetitions,
    recallStreak,
    dueAt: addDays(input.now, intervalDays).toISOString(),
    lastReviewedAt: nowIso,
    firstLearnedAt: state.firstLearnedAt ?? nowIso,
    lastResultCorrect: true,
    updatedAt: nowIso,
  }
  return { state: next, quality }
}

function bumpCounters(
  state: VocabularyState,
  skill: VocabularySkill,
  correct: boolean,
): Pick<VocabularyState, 'recognition' | 'recall' | 'spokenCount'> {
  const bump = (c: { correct: number; incorrect: number }) =>
    correct ? { ...c, correct: c.correct + 1 } : { ...c, incorrect: c.incorrect + 1 }
  switch (skill) {
    case 'recognition':
      return { recognition: bump(state.recognition), recall: state.recall, spokenCount: state.spokenCount }
    case 'recall':
      return { recognition: state.recognition, recall: bump(state.recall), spokenCount: state.spokenCount }
    case 'spoken':
      return { recognition: state.recognition, recall: state.recall, spokenCount: state.spokenCount + 1 }
  }
}

/** Accuracy 0..1 or null when there is nothing to measure. */
export function accuracy(counter: { correct: number; incorrect: number }): number | null {
  const total = counter.correct + counter.incorrect
  return total === 0 ? null : counter.correct / total
}
