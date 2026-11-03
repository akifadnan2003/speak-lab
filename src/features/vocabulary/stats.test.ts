import { describe, expect, it } from 'vitest'
import type { VocabularyReviewRecord, VocabularyState } from './ports'
import { parseVocabularyBank } from './schema'
import { createInitialState } from './srs/scheduler'
import { addDays } from './srs/time'
import { computeStreak, computeVocabularyStats } from './stats'

const NOW = new Date('2026-11-10T09:00:00.000Z')
const entries = parseVocabularyBank([
  { id: 'v-a', term: 'a', partOfSpeech: 'noun', definition: 'd', examples: ['a thing'], level: 'A0', topics: ['food'] },
  { id: 'v-b', term: 'b', partOfSpeech: 'noun', definition: 'd', examples: ['b thing'], level: 'A0', topics: ['food'] },
  { id: 'v-c', term: 'c', partOfSpeech: 'noun', definition: 'd', examples: ['c thing'], level: 'A1', topics: ['food'] },
])
const st = (id: string, patch: Partial<VocabularyState>): VocabularyState => ({ ...createInitialState('s1', id, NOW), ...patch })
const review = (iso: string, entryId = 'v-a'): VocabularyReviewRecord => ({
  id: iso + entryId,
  studentId: 's1',
  entryId,
  modeId: 'active_recall',
  skill: 'recall',
  correct: true,
  quality: 5,
  hintUsed: false,
  reviewedAt: iso,
  intervalDaysAfter: 1,
  stageAfter: 'learning',
})

describe('computeVocabularyStats', () => {
  it('counts stages, due, overdue, levels, difficult and recent words from records only', () => {
    const states = [
      st('v-a', { stage: 'mastered', dueAt: addDays(NOW, -2).toISOString(), firstLearnedAt: '2026-11-01T00:00:00.000Z', lapses: 2 }),
      st('v-b', { stage: 'learning', dueAt: addDays(NOW, -0.1).toISOString(), firstLearnedAt: '2026-11-05T00:00:00.000Z', recognition: { correct: 1, incorrect: 3 } }),
    ]
    const stats = computeVocabularyStats(entries, states, [], { studentId: 's1', now: NOW, timeZone: 'UTC' })
    expect(stats.totalEntries).toBe(3)
    expect(stats.learned).toBe(2)
    expect(stats.byStage).toEqual({ new: 1, learning: 1, review: 0, mastered: 1 })
    expect(stats.dueNow).toBe(2)
    expect(stats.overdue).toBe(1)
    expect(stats.byLevel).toEqual([
      { level: 'A0', total: 2, learned: 2, mastered: 1 },
      { level: 'A1', total: 1, learned: 0, mastered: 0 },
    ])
    expect(stats.difficult.map((d) => d.entry.id)).toEqual(['v-a', 'v-b'])
    expect(stats.recentlyLearned.map((r) => r.entry.id)).toEqual(['v-b', 'v-a'])
    expect(stats.recommended.queue.length).toBe(3)
    expect(stats.recommended.modeId).toBe('active_recall')
    expect(stats.streakDays).toBe(0)
  })

  it('suggests flashcards when the queue is mostly new words', () => {
    const stats = computeVocabularyStats(entries, [], [], { studentId: 's1', now: NOW })
    expect(stats.recommended.modeId).toBe('flashcards')
    expect(stats.recommended.estimatedMinutes).toBeGreaterThanOrEqual(1)
  })

  it('handles an empty bank', () => {
    const stats = computeVocabularyStats([], [], [], { studentId: 's1', now: NOW })
    expect(stats.totalEntries).toBe(0)
    expect(stats.byLevel).toEqual([])
    expect(stats.recommended.queue).toEqual([])
  })

  it('computes the streak in the learner’s time zone', () => {
    const reviews = [review('2026-11-09T23:30:00.000Z'), review('2026-11-08T12:00:00.000Z'), review('2026-11-07T12:00:00.000Z')]
    // In UTC the latest review was yesterday → streak 3 still alive.
    expect(computeVocabularyStats(entries, [], reviews, { studentId: 's1', now: NOW, timeZone: 'UTC' }).streakDays).toBe(3)
    // In Baku (UTC+4) that review happened today at 03:30, so the 9th has no review there:
    // the streak is just today (1) and reviewedToday is 1.
    const baku = computeVocabularyStats(entries, [], reviews, { studentId: 's1', now: NOW, timeZone: 'Asia/Baku' })
    expect(baku.streakDays).toBe(1)
    expect(baku.reviewedToday).toBe(1)
  })
})

describe('computeStreak', () => {
  it('breaks when a day is missed and ignores duplicates', () => {
    expect(computeStreak(new Set(['2026-11-10', '2026-11-09', '2026-11-07']), '2026-11-10')).toBe(2)
    expect(computeStreak(new Set(['2026-11-08']), '2026-11-10')).toBe(0)
    expect(computeStreak(new Set(['2026-11-09']), '2026-11-10')).toBe(1)
    expect(computeStreak(new Set(), '2026-11-10')).toBe(0)
  })
})
