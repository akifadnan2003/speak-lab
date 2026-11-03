import { CEFR_LEVELS, type CefrLevel } from '@/features/curriculum/schema'
import type { VocabularyReviewRecord, VocabularyStage, VocabularyState } from './ports'
import { buildRevisionQueue, type QueueEntry, type QueueOptions } from './revision/queue'
import type { VocabularyEntry } from './schema'
import { accuracy, isDue } from './srs/scheduler'
import { dateKey, daysBetweenKeys } from './srs/time'

/**
 * Dashboard numbers, computed from stored records only. Nothing here is
 * estimated or decorative; every figure has a definition in `docs/PRODUCT_SPEC.md`
 * style notes next to it.
 */

export interface LevelBreakdown {
  readonly level: CefrLevel
  readonly total: number
  readonly learned: number
  readonly mastered: number
}

export interface DifficultWord {
  readonly entry: VocabularyEntry
  readonly state: VocabularyState
  /** Combined accuracy across recognition and recall, null if never answered. */
  readonly accuracy: number | null
}

export interface VocabularyStats {
  readonly totalEntries: number
  /** Entries with at least one review (stage ≠ new). */
  readonly learned: number
  readonly byStage: Record<VocabularyStage, number>
  readonly dueNow: number
  readonly overdue: number
  /** Consecutive days with at least one review, ending today or yesterday. */
  readonly streakDays: number
  readonly reviewedToday: number
  readonly byLevel: readonly LevelBreakdown[]
  readonly difficult: readonly DifficultWord[]
  readonly recentlyLearned: readonly { entry: VocabularyEntry; state: VocabularyState }[]
  readonly recommended: {
    readonly queue: readonly QueueEntry[]
    readonly estimatedMinutes: number
    /** Mode id to suggest: recall for due reviews, flashcards when most items are new. */
    readonly modeId: 'flashcards' | 'active_recall'
  }
}

export const DIFFICULT_MIN_ATTEMPTS = 4
export const DIFFICULT_ACCURACY = 0.6
/** Average time per item used for the session estimate (measured locally later). */
export const SECONDS_PER_ITEM = 25

export function computeVocabularyStats(
  entries: readonly VocabularyEntry[],
  states: readonly VocabularyState[],
  reviews: readonly VocabularyReviewRecord[],
  options: QueueOptions,
): VocabularyStats {
  const { now, timeZone } = options
  const stateById = new Map(states.map((s) => [s.entryId, s]))
  const entryById = new Map(entries.map((e) => [e.id, e]))
  const known = states.filter((s) => entryById.has(s.entryId))

  const byStage: Record<VocabularyStage, number> = { new: 0, learning: 0, review: 0, mastered: 0 }
  for (const entry of entries) byStage[stateById.get(entry.id)?.stage ?? 'new']++

  const today = dateKey(now, timeZone)
  const dueNow = known.filter((s) => isDue(s, now)).length
  const overdue = known.filter((s) => isDue(s, now) && s.dueAt && dateKey(new Date(s.dueAt), timeZone) < today).length

  const reviewDays = new Set(reviews.map((r) => dateKey(new Date(r.reviewedAt), timeZone)))
  const reviewedToday = reviews.filter((r) => dateKey(new Date(r.reviewedAt), timeZone) === today).length
  const streakDays = computeStreak(reviewDays, today)

  const byLevel = CEFR_LEVELS.map<LevelBreakdown>((level) => {
    const inLevel = entries.filter((e) => e.level === level)
    const st = inLevel.map((e) => stateById.get(e.id))
    return {
      level,
      total: inLevel.length,
      learned: st.filter((s) => s && s.stage !== 'new').length,
      mastered: st.filter((s) => s?.stage === 'mastered').length,
    }
  }).filter((l) => l.total > 0)

  const difficult = known
    .map<DifficultWord | null>((state) => {
      const entry = entryById.get(state.entryId)
      if (!entry) return null
      const combined = {
        correct: state.recognition.correct + state.recall.correct,
        incorrect: state.recognition.incorrect + state.recall.incorrect,
      }
      const attempts = combined.correct + combined.incorrect
      const acc = accuracy(combined)
      const hard = state.lapses >= 2 || (attempts >= DIFFICULT_MIN_ATTEMPTS && acc !== null && acc < DIFFICULT_ACCURACY)
      return hard ? { entry, state, accuracy: acc } : null
    })
    .filter((d): d is DifficultWord => d !== null)
    .sort((a, b) => b.state.lapses - a.state.lapses || (a.accuracy ?? 1) - (b.accuracy ?? 1) || a.entry.id.localeCompare(b.entry.id))
    .slice(0, 10)

  const recentlyLearned = known
    .filter((s) => s.firstLearnedAt)
    .sort((a, b) => b.firstLearnedAt!.localeCompare(a.firstLearnedAt!) || a.entryId.localeCompare(b.entryId))
    .slice(0, 10)
    .map((state) => ({ entry: entryById.get(state.entryId)!, state }))

  const queue = buildRevisionQueue(entries, states, options)
  const newShare = queue.length === 0 ? 1 : queue.filter((q) => q.reason === 'new').length / queue.length

  return {
    totalEntries: entries.length,
    learned: known.filter((s) => s.stage !== 'new').length,
    byStage,
    dueNow,
    overdue,
    streakDays,
    reviewedToday,
    byLevel,
    difficult,
    recentlyLearned,
    recommended: {
      queue,
      estimatedMinutes: Math.max(1, Math.round((queue.length * SECONDS_PER_ITEM) / 60)),
      modeId: newShare > 0.5 ? 'flashcards' : 'active_recall',
    },
  }
}

/** Consecutive days with reviews ending today, or yesterday if today has none yet. */
export function computeStreak(reviewDays: ReadonlySet<string>, today: string): number {
  if (reviewDays.size === 0) return 0
  const sorted = [...reviewDays].sort().reverse()
  const latest = sorted[0]!
  const gap = daysBetweenKeys(latest, today)
  if (gap > 1) return 0
  let streak = 0
  let cursor = latest
  for (const day of sorted) {
    if (day === cursor) {
      streak++
      cursor = shiftKey(cursor, -1)
    } else if (daysBetweenKeys(day, cursor) === 0) {
      continue
    } else {
      break
    }
  }
  return streak
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days))
  return date.toISOString().slice(0, 10)
}
