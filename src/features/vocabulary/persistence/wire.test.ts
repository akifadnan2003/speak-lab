import { describe, expect, it } from 'vitest'
import type { VocabularyReviewRecord } from '../ports'
import { computeVocabularyStats } from '../stats'
import { VOCABULARY_BANK } from '../content'
import { dateKey } from '../srs/time'
import { stateFromRow, toReviewPayload, type StudentVocabularyRow } from './wire'

const A = '11111111-1111-4111-8111-111111111111'

const baseReview: VocabularyReviewRecord = {
  id: 'rev-wire-00001',
  studentId: A,
  entryId: 'v-hello',
  modeId: 'flashcards',
  skill: 'recognition',
  correct: true,
  quality: 3,
  hintUsed: false,
  reviewedAt: '2026-11-01T09:00:00.000Z',
  intervalDaysAfter: 3,
  stageAfter: 'learning',
}

function row(overrides: Partial<StudentVocabularyRow> = {}): StudentVocabularyRow {
  return {
    student_id: A,
    entry_id: 'v-hello',
    stage: 'review',
    ease: '2.36',
    interval_days: 7,
    repetitions: 3,
    recall_streak: 1,
    lapses: 0,
    due_at: '2025-03-09T23:30:00-04:00',
    last_reviewed_at: '2025-03-02T23:30:00-05:00',
    first_learned_at: '2025-02-20T04:30:00+00:00',
    last_result_correct: true,
    recognition_correct: 2,
    recognition_incorrect: 0,
    recall_correct: 1,
    recall_incorrect: 0,
    spoken_count: 0,
    review_count: 3,
    last_review_id: 'x',
    created_at: '2025-02-20T04:30:00+00:00',
    updated_at: '2025-03-02T23:30:01+00:00',
    ...overrides,
  }
}

describe('review payload', () => {
  it('sends the flashcard self-grade, never the client quality, interval or stage', () => {
    expect(toReviewPayload(baseReview)).toEqual({
      id: 'rev-wire-00001',
      entry_id: 'v-hello',
      mode_id: 'flashcards',
      skill: 'recognition',
      correct: true,
      hint_used: false,
      self_grade: 'hard',
      reviewed_at: '2026-11-01T09:00:00.000Z',
    })
    expect(toReviewPayload({ ...baseReview, quality: 1, correct: false }).self_grade).toBe('again')
    expect(toReviewPayload({ ...baseReview, quality: 5 }).self_grade).toBe('easy')
  })

  it('does not invent a self-grade for other modes and trims long answers', () => {
    const p = toReviewPayload({ ...baseReview, modeId: 'active_recall', skill: 'recall', quality: 5, answer: 'x'.repeat(500) })
    expect(p.self_grade).toBeUndefined()
    expect(p.answer).toHaveLength(200)
  })
})

describe('server rows → app state (time zones)', () => {
  it('normalises instants from any session offset to UTC ISO strings', () => {
    const s = stateFromRow(row())
    expect(s.dueAt).toBe('2025-03-10T03:30:00.000Z')
    expect(s.lastReviewedAt).toBe('2025-03-03T04:30:00.000Z')
    expect(s.ease).toBe(2.36)
    expect(s.recognition).toEqual({ correct: 2, incorrect: 0 })
  })

  it('omits optional fields the server left null', () => {
    const s = stateFromRow(row({ stage: 'new', due_at: null, last_reviewed_at: null, first_learned_at: null, last_result_correct: null }))
    expect(s.dueAt).toBeNull()
    expect('lastReviewedAt' in s).toBe(false)
    expect('lastResultCorrect' in s).toBe(false)
  })

  it('buckets the same server instant into the learner’s own calendar day', () => {
    // 2025-03-10T03:30Z is still the 9th in New York but already the 10th in Baku.
    const due = stateFromRow(row()).dueAt!
    expect(dateKey(new Date(due), 'America/New_York')).toBe('2025-03-09')
    expect(dateKey(new Date(due), 'Asia/Baku')).toBe('2025-03-10')

    const now = new Date('2025-03-10T12:00:00Z') // the 10th in both zones
    const opts = { studentId: A, now }
    const ny = computeVocabularyStats(VOCABULARY_BANK, [stateFromRow(row())], [], { ...opts, timeZone: 'America/New_York' })
    const baku = computeVocabularyStats(VOCABULARY_BANK, [stateFromRow(row())], [], { ...opts, timeZone: 'Asia/Baku' })
    expect(ny.dueNow).toBe(1)
    expect(baku.dueNow).toBe(1)
    expect(ny.overdue).toBe(1) // due yesterday, New York time
    expect(baku.overdue).toBe(0) // due today, Baku time
  })
})
