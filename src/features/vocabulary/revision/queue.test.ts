import { describe, expect, it } from 'vitest'
import type { VocabularyState } from '../ports'
import { parseVocabularyBank, type VocabularyEntry } from '../schema'
import { createInitialState } from '../srs/scheduler'
import { addDays } from '../srs/time'
import { buildRevisionQueue } from './queue'

const NOW = new Date('2026-11-10T09:00:00.000Z')
const TZ = 'UTC'

const entries: VocabularyEntry[] = parseVocabularyBank(
  ['v-a', 'v-b', 'v-c', 'v-d', 'v-e', 'v-f', 'v-g', 'v-h'].map((id, i) => ({
    id,
    term: id,
    partOfSpeech: 'noun',
    definition: `definition ${id}`,
    examples: [`This is ${id}.`],
    level: i < 4 ? 'A0' : 'A1',
    topics: ['family'],
    chapterIds: id === 'v-g' ? ['a0-01'] : [],
  })),
)

function state(entryId: string, patch: Partial<VocabularyState>): VocabularyState {
  return { ...createInitialState('s1', entryId, NOW), ...patch }
}

describe('buildRevisionQueue', () => {
  it('orders by bucket priority and is deterministic', () => {
    const states = [
      state('v-a', { stage: 'review', dueAt: addDays(NOW, -3).toISOString() }), // overdue
      state('v-b', { stage: 'review', dueAt: addDays(NOW, -1).toISOString() }), // overdue, less
      state('v-c', { stage: 'learning', dueAt: addDays(NOW, 2).toISOString(), lastResultCorrect: false, lastReviewedAt: addDays(NOW, -1).toISOString() }), // recently incorrect
      state('v-d', { stage: 'review', dueAt: addDays(NOW, 5).toISOString(), recall: { correct: 1, incorrect: 3 } }), // weak recall
      state('v-e', { stage: 'mastered', dueAt: addDays(NOW, -0.1).toISOString() }), // mastered due today
      state('v-f', { stage: 'review', dueAt: addDays(NOW, -0.2).toISOString() }), // due today
    ]
    const queue = buildRevisionQueue(entries, states, { studentId: 's1', now: NOW, timeZone: TZ, currentChapterIds: ['a0-01'] })
    expect(queue.map((q) => `${q.entry.id}:${q.reason}`)).toEqual([
      'v-a:overdue',
      'v-b:overdue',
      'v-c:recently_incorrect',
      'v-d:weak_recall',
      'v-g:current_chapter',
      'v-e:mastered_reinforcement',
      'v-f:due',
      'v-h:new',
    ])
    const again = buildRevisionQueue(entries, states, { studentId: 's1', now: NOW, timeZone: TZ, currentChapterIds: ['a0-01'] })
    expect(again).toEqual(queue)
  })

  it('lists an entry only once, under the highest-priority reason', () => {
    const states = [
      state('v-g', { stage: 'review', dueAt: addDays(NOW, -2).toISOString(), lastResultCorrect: false, lastReviewedAt: NOW.toISOString() }),
    ]
    const queue = buildRevisionQueue(entries, states, { studentId: 's1', now: NOW, timeZone: TZ, currentChapterIds: ['a0-01'], newLimit: 0 })
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ entry: { id: 'v-g' }, reason: 'overdue' })
  })

  it('caps new words, easiest level first, and respects the total limit', () => {
    const queue = buildRevisionQueue(entries, [], { studentId: 's1', now: NOW, timeZone: TZ, newLimit: 3 })
    expect(queue.map((q) => q.entry.id)).toEqual(['v-a', 'v-b', 'v-c'])
    expect(queue.every((q) => q.reason === 'new')).toBe(true)
    expect(buildRevisionQueue(entries, [], { studentId: 's1', now: NOW, timeZone: TZ, limit: 2 })).toHaveLength(2)
  })

  it('an item that is only recently incorrect but not due still appears', () => {
    const states = [state('v-h', { stage: 'learning', dueAt: addDays(NOW, 1).toISOString(), lastResultCorrect: false, lastReviewedAt: addDays(NOW, -6).toISOString() })]
    expect(buildRevisionQueue(entries, states, { studentId: 's1', now: NOW, timeZone: TZ, newLimit: 0 })[0]?.reason).toBe('recently_incorrect')
    const old = [state('v-h', { stage: 'learning', dueAt: addDays(NOW, 1).toISOString(), lastResultCorrect: false, lastReviewedAt: addDays(NOW, -8).toISOString() })]
    expect(buildRevisionQueue(entries, old, { studentId: 's1', now: NOW, timeZone: TZ, newLimit: 0 })).toHaveLength(0)
  })

  it('returns an empty queue for an empty bank', () => {
    expect(buildRevisionQueue([], [], { studentId: 's1', now: NOW })).toEqual([])
  })

  it('uses the time zone to decide what counts as overdue', () => {
    const dueLateUtc = state('v-a', { stage: 'review', dueAt: '2026-11-09T23:30:00.000Z' })
    const utc = buildRevisionQueue(entries, [dueLateUtc], { studentId: 's1', now: NOW, timeZone: 'UTC', newLimit: 0 })
    const baku = buildRevisionQueue(entries, [dueLateUtc], { studentId: 's1', now: NOW, timeZone: 'Asia/Baku', newLimit: 0 })
    expect(utc[0]?.reason).toBe('overdue')
    expect(baku[0]?.reason).toBe('due')
  })
})
