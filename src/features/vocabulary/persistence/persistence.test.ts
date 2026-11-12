import { beforeEach, describe, expect, it } from 'vitest'
import { exportVocabularySnapshot, isUploadableStudentId } from '../migration'
import type { VocabularyReviewRecord } from '../ports'
import { createInitialState } from '../srs/scheduler'
import { clearStoredVocabulary, createLocalStorageVocabularyRepository, VOCAB_STORAGE_PREFIX } from './local-storage'
import { createMemoryVocabularyRepository } from './memory'

const NOW = new Date('2026-11-10T09:00:00.000Z')
const review = (id: string, studentId = 's1'): VocabularyReviewRecord => ({
  id,
  studentId,
  entryId: 'v-a',
  modeId: 'flashcards',
  skill: 'recognition',
  correct: true,
  quality: 4,
  hintUsed: false,
  reviewedAt: NOW.toISOString(),
  intervalDaysAfter: 1,
  stageAfter: 'learning',
})

describe('memory vocabulary repository', () => {
  it('upserts states per student and entry, records reviews idempotently, clears one student', async () => {
    const repo = createMemoryVocabularyRepository()
    await repo.upsertState(createInitialState('s1', 'v-a', NOW))
    await repo.upsertState({ ...createInitialState('s1', 'v-a', NOW), stage: 'learning' })
    await repo.upsertState(createInitialState('s2', 'v-a', NOW))
    await repo.recordReview(review('r1'))
    await repo.recordReview(review('r1'))
    await repo.recordReview(review('r2', 's2'))
    expect(await repo.listStates('s1')).toHaveLength(1)
    expect((await repo.listStates('s1'))[0]?.stage).toBe('learning')
    expect(await repo.listReviews('s1')).toHaveLength(1)
    await repo.clear('s1')
    expect(await repo.listStates('s1')).toHaveLength(0)
    expect(await repo.listStates('s2')).toHaveLength(1)
    expect(await repo.listReviews('s2')).toHaveLength(1)
  })

  it('filters reviews by entry and since', async () => {
    const repo = createMemoryVocabularyRepository()
    await repo.recordReview({ ...review('r1'), reviewedAt: '2026-11-01T00:00:00.000Z' })
    await repo.recordReview({ ...review('r2'), entryId: 'v-b' })
    expect(await repo.listReviews('s1', { entryId: 'v-b' })).toHaveLength(1)
    expect(await repo.listReviews('s1', { sinceIso: '2026-11-05T00:00:00.000Z' })).toHaveLength(1)
  })
})

describe('localStorage vocabulary repository', () => {
  beforeEach(() => localStorage.clear())

  it('persists per student and restores in a fresh instance', async () => {
    const repo = createLocalStorageVocabularyRepository(localStorage)
    await repo.upsertState(createInitialState('s1', 'v-a', NOW))
    await repo.recordReview(review('r1'))
    await repo.recordReview(review('r2', 's2'))
    expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:s1`)).toContain('v-a')
    expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:s2`)).not.toContain('"states":[{')
    const fresh = createLocalStorageVocabularyRepository(localStorage)
    expect(await fresh.listStates('s1')).toHaveLength(1)
    expect(await fresh.listReviews('s2')).toHaveLength(1)
  })

  it('clear removes that student’s key only; clearStoredVocabulary removes all', async () => {
    const repo = createLocalStorageVocabularyRepository(localStorage)
    await repo.recordReview(review('r1'))
    await repo.recordReview(review('r2', 's2'))
    localStorage.setItem('speaklab.theme', 'dark')
    await repo.clear('s1')
    expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:s1`)).toBeNull()
    expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:s2`)).not.toBeNull()
    clearStoredVocabulary(localStorage)
    expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:s2`)).toBeNull()
    expect(localStorage.getItem('speaklab.theme')).toBe('dark')
  })

  it('survives corrupted storage and falls back to memory without Storage', async () => {
    localStorage.setItem(`${VOCAB_STORAGE_PREFIX}:s1`, '{oops')
    expect(await createLocalStorageVocabularyRepository(localStorage).listStates('s1')).toEqual([])
    const mem = createLocalStorageVocabularyRepository(undefined)
    await mem.recordReview(review('r1'))
    expect(await mem.listReviews('s1')).toHaveLength(1)
  })
})

describe('migration snapshot', () => {
  it('exports only the named student and refuses preview ids', async () => {
    const repo = createMemoryVocabularyRepository()
    await repo.upsertState(createInitialState('s1', 'v-a', NOW))
    await repo.recordReview(review('r1'))
    await repo.recordReview(review('r2', 'preview-student-1'))
    const snap = await exportVocabularySnapshot(repo, 's1', NOW)
    expect(snap).toMatchObject({ version: 1, studentId: 's1', exportedAt: NOW.toISOString() })
    expect(snap.states).toHaveLength(1)
    expect(snap.reviews).toHaveLength(1)
    expect(isUploadableStudentId('preview-student-1')).toBe(false)
    await expect(exportVocabularySnapshot(repo, 'preview-student-1', NOW)).rejects.toThrow(/non-uploadable/)
  })
})
