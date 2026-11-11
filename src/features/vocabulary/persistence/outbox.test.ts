import { describe, expect, it } from 'vitest'
import type { VocabularyReviewRecord } from '../ports'
import { createVocabularyOutbox, OUTBOX_STORAGE_PREFIX } from './outbox'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function review(id: string, studentId = A): VocabularyReviewRecord {
  return {
    id,
    studentId,
    entryId: 'v-hello',
    modeId: 'meaning_choice',
    skill: 'recognition',
    correct: true,
    quality: 4,
    hintUsed: false,
    reviewedAt: '2026-11-01T09:00:00.000Z',
    intervalDaysAfter: 1,
    stageAfter: 'learning',
  }
}

describe('vocabulary outbox', () => {
  it('keeps one queue per account and refuses to queue for someone else', () => {
    localStorage.clear()
    const outbox = createVocabularyOutbox(localStorage)
    outbox.add(A, { review: review('rev-a-000001'), attempts: 0 })
    outbox.add(B, { review: review('rev-b-000001', B), attempts: 0 })
    expect(outbox.list(A).map((i) => i.review.id)).toEqual(['rev-a-000001'])
    expect(outbox.list(B).map((i) => i.review.id)).toEqual(['rev-b-000001'])
    expect(() => outbox.add(A, { review: review('rev-b-000002', B), attempts: 0 })).toThrow(/another account/)
  })

  it('deduplicates by review id and survives a new instance (page reload)', () => {
    localStorage.clear()
    const first = createVocabularyOutbox(localStorage)
    first.add(A, { review: review('rev-a-000001'), attempts: 0 })
    first.add(A, { review: review('rev-a-000001'), attempts: 0 })
    first.bumpAttempts(A, ['rev-a-000001'])
    const reloaded = createVocabularyOutbox(localStorage)
    expect(reloaded.list(A)).toEqual([expect.objectContaining({ attempts: 1 })])
    reloaded.remove(A, ['rev-a-000001'])
    expect(localStorage.getItem(`${OUTBOX_STORAGE_PREFIX}:${A}`)).toBeNull()
  })

  it('ignores tampered entries that name another student', () => {
    localStorage.clear()
    localStorage.setItem(`${OUTBOX_STORAGE_PREFIX}:${A}`, JSON.stringify([{ review: review('rev-b-000009', B), attempts: 0 }]))
    expect(createVocabularyOutbox(localStorage).list(A)).toEqual([])
  })

  it('a storage purge empties the queue (no stale in-memory copy)', () => {
    localStorage.clear()
    const outbox = createVocabularyOutbox(localStorage)
    outbox.add(A, { review: review('rev-a-000001'), attempts: 0 })
    localStorage.clear()
    expect(outbox.list(A)).toEqual([])
  })

  it('falls back to memory when storage refuses writes', () => {
    const full = {
      length: 0,
      clear() {},
      key: () => null,
      getItem: () => null,
      removeItem() {},
      setItem() {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    } satisfies Storage
    const outbox = createVocabularyOutbox(full)
    outbox.add(A, { review: review('rev-a-000001'), attempts: 0 })
    expect(outbox.list(A)).toHaveLength(1)
    outbox.clearAll()
    expect(outbox.list(A)).toEqual([])
  })
})
