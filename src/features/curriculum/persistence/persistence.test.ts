import { beforeEach, describe, expect, it } from 'vitest'
import type { ExerciseAttemptRecord, LessonProgressRecord } from '../ports'
import { clearStoredProgress, createLocalStorageProgressRepository, PROGRESS_STORAGE_PREFIX } from './local-storage'
import { createMemoryProgressRepository } from './memory'

const NOW = '2026-11-03T10:00:00.000Z'
const progress = (studentId: string, lessonId: string, status: LessonProgressRecord['status'] = 'in_progress'): LessonProgressRecord => ({
  studentId,
  chapterId: 'a0-01',
  lessonId,
  status,
  updatedAt: NOW,
})
const attempt = (id: string, studentId = 's1'): ExerciseAttemptRecord => ({
  id,
  studentId,
  chapterId: 'a0-01',
  chapterVersion: 1,
  lessonId: 'a0-01-l01',
  exerciseId: 'a0-01-l01-e01',
  exerciseType: 'multiple_choice',
  attemptNumber: 1,
  answer: { type: 'multiple_choice', optionId: 'a' },
  correct: true,
  score: 1,
  hintUsed: false,
  createdAt: NOW,
})

describe('memory repository', () => {
  it('upserts lesson progress per student and lesson', async () => {
    const repo = createMemoryProgressRepository()
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01'))
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01', 'completed'))
    await repo.upsertLessonProgress(progress('s2', 'a0-01-l01'))
    const s1 = await repo.listLessonProgress('s1')
    expect(s1).toHaveLength(1)
    expect(s1[0]?.status).toBe('completed')
    expect(await repo.listLessonProgress('s2')).toHaveLength(1)
    expect(await repo.listLessonProgress('nobody')).toHaveLength(0)
  })

  it('records attempts idempotently and filters by lesson', async () => {
    const repo = createMemoryProgressRepository()
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt({ ...attempt('a2'), lessonId: 'a0-01-l02' })
    expect(await repo.listAttempts('s1')).toHaveLength(2)
    expect(await repo.listAttempts('s1', { lessonId: 'a0-01-l02' })).toHaveLength(1)
  })
})

describe('localStorage repository', () => {
  beforeEach(() => localStorage.clear())

  it('persists across repository instances and namespaces by student', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01', 'completed'))
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt(attempt('b1', 's2'))

    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:s1`)).toContain('"completed"')
    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:s2`)).not.toContain('"completed"')

    const fresh = createLocalStorageProgressRepository(localStorage)
    expect(await fresh.listLessonProgress('s1')).toHaveLength(1)
    expect(await fresh.listAttempts('s1')).toHaveLength(1)
    expect(await fresh.listAttempts('s2')).toHaveLength(1)
  })

  it('survives corrupted storage', async () => {
    localStorage.setItem(`${PROGRESS_STORAGE_PREFIX}:s1`, '{not json')
    const repo = createLocalStorageProgressRepository(localStorage)
    expect(await repo.listLessonProgress('s1')).toEqual([])
  })

  it('clearStoredProgress removes only SpeakLab progress keys', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt(attempt('b1', 's2'))
    localStorage.setItem('speaklab.theme', 'dark')
    clearStoredProgress(localStorage)
    expect(await repo.listAttempts('s1')).toHaveLength(0)
    expect(await repo.listAttempts('s2')).toHaveLength(0)
    expect(localStorage.getItem('speaklab.theme')).toBe('dark')
  })

  it('falls back to memory without a Storage', async () => {
    const repo = createLocalStorageProgressRepository(undefined)
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01'))
    expect(await repo.listLessonProgress('s1')).toHaveLength(1)
  })
})
