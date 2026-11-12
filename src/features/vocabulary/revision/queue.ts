import type { VocabularyState } from '../ports'
import type { VocabularyEntry } from '../schema'
import { accuracy, createInitialState, isDue } from '../srs/scheduler'
import { dateKey, DAY_MS } from '../srs/time'

/**
 * Personal revision queue. Pure and deterministic: the same inputs always
 * produce the same order. Buckets are filled in priority order and an entry
 * appears once, under the first reason that applies.
 */

export type QueueReason =
  | 'overdue'
  | 'recently_incorrect'
  | 'weak_recall'
  | 'current_chapter'
  | 'mastered_reinforcement'
  | 'due'
  | 'new'

export const QUEUE_REASON_LABEL: Record<QueueReason, string> = {
  overdue: 'Overdue',
  recently_incorrect: 'Recently incorrect',
  weak_recall: 'Weak recall',
  current_chapter: 'From your current chapter',
  mastered_reinforcement: 'Keeping it mastered',
  due: 'Due today',
  new: 'New word',
}

export interface QueueEntry {
  readonly entry: VocabularyEntry
  readonly state: VocabularyState
  readonly reason: QueueReason
}

export interface QueueOptions {
  readonly studentId: string
  readonly now: Date
  readonly timeZone?: string
  /** Chapters the learner is currently working on. */
  readonly currentChapterIds?: readonly string[]
  /** Cap on brand-new words introduced per session. */
  readonly newLimit?: number
  /** Cap on total queue length. */
  readonly limit?: number
}

export const RECENT_INCORRECT_WINDOW_DAYS = 7
export const WEAK_RECALL_THRESHOLD = 0.7
export const WEAK_RECALL_MIN_ATTEMPTS = 3
export const DEFAULT_NEW_LIMIT = 10

export function buildRevisionQueue(
  entries: readonly VocabularyEntry[],
  states: readonly VocabularyState[],
  options: QueueOptions,
): QueueEntry[] {
  const { now, timeZone } = options
  const today = dateKey(now, timeZone)
  const stateById = new Map(states.map((s) => [s.entryId, s]))
  const current = new Set(options.currentChapterIds ?? [])
  const byId = [...entries].sort((a, b) => a.id.localeCompare(b.id))

  const pairs = byId.map((entry) => ({
    entry,
    state: stateById.get(entry.id) ?? createInitialState(options.studentId, entry.id, now),
  }))

  const used = new Set<string>()
  const out: QueueEntry[] = []
  const take = (reason: QueueReason, items: typeof pairs) => {
    for (const p of items) {
      if (used.has(p.entry.id)) continue
      used.add(p.entry.id)
      out.push({ ...p, reason })
    }
  }

  const due = pairs.filter((p) => isDue(p.state, now))
  const dueTime = (p: (typeof pairs)[number]) => (p.state.dueAt ? new Date(p.state.dueAt).getTime() : 0)

  // 1. Overdue: due before today, most overdue first.
  take(
    'overdue',
    due.filter((p) => p.state.dueAt && dateKey(new Date(p.state.dueAt), timeZone) < today).sort((a, b) => dueTime(a) - dueTime(b)),
  )

  // 2. Recently incorrect: last answer wrong within the window (due or not).
  const recentCutoff = now.getTime() - RECENT_INCORRECT_WINDOW_DAYS * DAY_MS
  take(
    'recently_incorrect',
    pairs
      .filter((p) => p.state.lastResultCorrect === false && p.state.lastReviewedAt && new Date(p.state.lastReviewedAt).getTime() >= recentCutoff)
      .sort((a, b) => new Date(b.state.lastReviewedAt!).getTime() - new Date(a.state.lastReviewedAt!).getTime()),
  )

  // 3. Weak active recall.
  take(
    'weak_recall',
    pairs
      .filter((p) => {
        const attempts = p.state.recall.correct + p.state.recall.incorrect
        const acc = accuracy(p.state.recall)
        return attempts >= WEAK_RECALL_MIN_ATTEMPTS && acc !== null && acc < WEAK_RECALL_THRESHOLD
      })
      .sort((a, b) => (accuracy(a.state.recall) ?? 0) - (accuracy(b.state.recall) ?? 0)),
  )

  // 4. Words from the chapters in progress that are not mastered yet.
  take(
    'current_chapter',
    pairs.filter((p) => p.state.stage !== 'mastered' && p.entry.chapterIds.some((id) => current.has(id))),
  )

  // 5. Mastered words that have come due again.
  take(
    'mastered_reinforcement',
    due.filter((p) => p.state.stage === 'mastered').sort((a, b) => dueTime(a) - dueTime(b)),
  )

  // 6. Everything else that is due today.
  take('due', due.sort((a, b) => dueTime(a) - dueTime(b)))

  // 7. Introduce new words, easiest level first, capped.
  const newLimit = options.newLimit ?? DEFAULT_NEW_LIMIT
  const fresh = pairs
    .filter((p) => p.state.stage === 'new' && !used.has(p.entry.id))
    .sort((a, b) => levelRank(a.entry.level) - levelRank(b.entry.level) || a.entry.id.localeCompare(b.entry.id))
    .slice(0, newLimit)
  take('new', fresh)

  return options.limit !== undefined ? out.slice(0, options.limit) : out
}

const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1']
function levelRank(level: string): number {
  const i = LEVEL_ORDER.indexOf(level)
  return i === -1 ? LEVEL_ORDER.length : i
}
