import { describe, expect, it } from 'vitest'
import type { VocabularyState } from '../ports'
import {
  accuracy,
  createInitialState,
  EASE_DEFAULT,
  EASE_MIN,
  isDue,
  MASTERY_INTERVAL_DAYS,
  nextEase,
  qualityFor,
  schedule,
  type ReviewInput,
} from './scheduler'
import { addDays, dateKey, daysBetweenKeys } from './time'

const T0 = new Date('2026-11-03T09:00:00.000Z')

function run(state: VocabularyState, steps: Array<Partial<ReviewInput> & { days?: number }>) {
  let s = state
  let now = T0
  const log: VocabularyState[] = []
  for (const step of steps) {
    now = addDays(now, step.days ?? s.intervalDays)
    s = schedule(s, { skill: 'recall', correct: true, ...step, now }).state
    log.push(s)
  }
  return { state: s, log, now }
}

describe('qualityFor', () => {
  it('maps answers to SM-2 quality deterministically', () => {
    expect(qualityFor({ skill: 'recall', correct: true })).toBe(5)
    expect(qualityFor({ skill: 'recall', correct: true, hintUsed: true })).toBe(4)
    expect(qualityFor({ skill: 'recognition', correct: true })).toBe(4)
    expect(qualityFor({ skill: 'recognition', correct: false })).toBe(1)
    expect(qualityFor({ skill: 'recall', correct: true, selfGrade: 'again' })).toBe(1)
    expect(qualityFor({ skill: 'recall', correct: true, selfGrade: 'hard' })).toBe(3)
    expect(qualityFor({ skill: 'recall', correct: true, selfGrade: 'good' })).toBe(4)
    expect(qualityFor({ skill: 'recall', correct: true, selfGrade: 'easy' })).toBe(5)
  })
})

describe('schedule', () => {
  const initial = createInitialState('s1', 'v-hello', T0)

  it('starts new, not due, with default ease', () => {
    expect(initial.stage).toBe('new')
    expect(initial.dueAt).toBeNull()
    expect(initial.ease).toBe(EASE_DEFAULT)
    expect(isDue(initial, T0)).toBe(false)
  })

  it('walks the learning steps 1 → 3 → 6 days, then multiplies by ease', () => {
    const { log } = run(initial, [{ days: 0 }, {}, {}, {}])
    // ease after three q=5 answers: 2.5 + 3 × 0.1 = 2.8; 6 × 2.8 = 16.8 → 17
    expect(log.map((s) => s.intervalDays)).toEqual([1, 3, 6, 17])
    expect(log.map((s) => s.stage)).toEqual(['learning', 'learning', 'review', 'review'])
    expect(log[0]?.dueAt).toBe(addDays(T0, 1).toISOString())
    expect(log[3]?.ease).toBeGreaterThan(EASE_DEFAULT)
  })

  it('reaches mastered only through consecutive recall at a 21-day interval', () => {
    const recall = run(initial, [{ days: 0 }, {}, {}, {}, {}])
    expect(recall.state.intervalDays).toBeGreaterThanOrEqual(MASTERY_INTERVAL_DAYS)
    expect(recall.state.stage).toBe('mastered')

    const recognitionOnly = run(initial, [
      { days: 0, skill: 'recognition' },
      { skill: 'recognition' },
      { skill: 'recognition' },
      { skill: 'recognition' },
      { skill: 'recognition' },
    ])
    expect(recognitionOnly.state.intervalDays).toBeGreaterThanOrEqual(MASTERY_INTERVAL_DAYS)
    expect(recognitionOnly.state.stage).toBe('review')
    expect(recognitionOnly.state.recallStreak).toBe(0)
  })

  it('a wrong answer resets to a one-day learning step, lowers ease and counts a lapse from review', () => {
    const reviewed = run(initial, [{ days: 0 }, {}, {}]).state
    expect(reviewed.stage).toBe('review')
    const lapsed = schedule(reviewed, { skill: 'recall', correct: false, now: addDays(T0, 20) }).state
    expect(lapsed).toMatchObject({ stage: 'learning', intervalDays: 1, repetitions: 0, recallStreak: 0, lapses: 1, lastResultCorrect: false })
    expect(lapsed.ease).toBeCloseTo(reviewed.ease - 0.2, 5)
    expect(lapsed.recall).toEqual({ correct: 3, incorrect: 1 })

    const wrongWhileLearning = schedule(initial, { skill: 'recognition', correct: false, now: T0 }).state
    expect(wrongWhileLearning.lapses).toBe(0)
    expect(wrongWhileLearning.stage).toBe('learning')
    expect(wrongWhileLearning.recognition).toEqual({ correct: 0, incorrect: 1 })
  })

  it('never drops ease below the minimum', () => {
    let s = initial
    for (let i = 0; i < 20; i++) s = schedule(s, { skill: 'recall', correct: false, now: addDays(T0, i) }).state
    expect(s.ease).toBe(EASE_MIN)
    expect(nextEase(EASE_MIN, 0)).toBe(EASE_MIN)
  })

  it('"hard" keeps the interval within 1.2× of the previous one', () => {
    const base = run(initial, [{ days: 0 }, {}, {}]).state // interval 6
    const hard = schedule(base, { skill: 'recall', correct: true, selfGrade: 'hard', now: addDays(T0, 10) }).state
    expect(hard.intervalDays).toBe(7)
    expect(hard.ease).toBeLessThan(base.ease)
  })

  it('tracks spoken use as a count and records first/last review instants', () => {
    const s = schedule(initial, { skill: 'spoken', correct: true, now: T0 }).state
    expect(s.spokenCount).toBe(1)
    expect(s.firstLearnedAt).toBe(T0.toISOString())
    expect(s.lastReviewedAt).toBe(T0.toISOString())
    expect(s.recallStreak).toBe(1)
  })

  it('is deterministic for the same inputs', () => {
    const a = run(initial, [{ days: 0 }, {}, { correct: false }, {}]).state
    const b = run(initial, [{ days: 0 }, {}, { correct: false }, {}]).state
    expect(a).toEqual(b)
  })
})

describe('time helpers and time zones', () => {
  it('dateKey respects the time zone around midnight', () => {
    const late = new Date('2026-11-03T22:30:00.000Z')
    expect(dateKey(late, 'UTC')).toBe('2026-11-03')
    expect(dateKey(late, 'Asia/Baku')).toBe('2026-11-04') // UTC+4
    expect(dateKey(late, 'America/Los_Angeles')).toBe('2026-11-03')
  })

  it('a review due at 23:30 UTC is "overdue" in Baku the next morning but due today in UTC', () => {
    const due = new Date('2026-11-03T23:30:00.000Z')
    const morningBaku = new Date('2026-11-04T04:00:00.000Z') // 08:00 in Baku
    expect(dateKey(due, 'Asia/Baku') < dateKey(morningBaku, 'Asia/Baku')).toBe(false) // both 2026-11-04 in Baku
    expect(dateKey(due, 'UTC') < dateKey(morningBaku, 'UTC')).toBe(true)
  })

  it('daysBetweenKeys counts calendar days', () => {
    expect(daysBetweenKeys('2026-11-01', '2026-11-03')).toBe(2)
    expect(daysBetweenKeys('2026-11-03', '2026-11-01')).toBe(-2)
    expect(daysBetweenKeys('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('accuracy is null without attempts', () => {
    expect(accuracy({ correct: 0, incorrect: 0 })).toBeNull()
    expect(accuracy({ correct: 3, incorrect: 1 })).toBe(0.75)
  })
})
