import { beforeEach, describe, expect, it } from 'vitest'
import { activateLocalUser, clearLocalStudentData, deactivateLocalUser } from '@/lib/local-data'
import './local-cleanup'
import { createLocalStorageProgressRepository, PROGRESS_STORAGE_PREFIX } from './persistence/local-storage'

const NOW = '2026-11-11T10:00:00.000Z'

describe('curriculum local-data cleanup', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    deactivateLocalUser()
  })

  it('wipes device-local progress on sign-out through the registered cleaner', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.upsertLessonProgress({ studentId: 's1', chapterId: 'a0-01', lessonId: 'a0-01-l01', status: 'in_progress', updatedAt: NOW })
    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:s1`)).not.toBeNull()
    await clearLocalStudentData()
    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:s1`)).toBeNull()
    expect(await repo.listLessonProgress('s1')).toEqual([])
  })

  it('wipes the previous learner’s progress when a different account signs in on the same device', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await activateLocalUser('s1')
    await repo.upsertLessonProgress({ studentId: 's1', chapterId: 'a0-01', lessonId: 'a0-01-l01', status: 'completed', bestScore: 90, completedAt: NOW, updatedAt: NOW })
    // Same learner returning keeps their data.
    expect(await activateLocalUser('s1')).toBe(false)
    expect(await repo.listLessonProgress('s1')).toHaveLength(1)
    // A different learner purges it before anything is read.
    expect(await activateLocalUser('s2')).toBe(true)
    expect(await repo.listLessonProgress('s1')).toEqual([])
    expect(await repo.listLessonProgress('s2')).toEqual([])
  })

  it('never imports preview progress into a real account', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.upsertLessonProgress({ studentId: 'preview-student-1', chapterId: 'a0-01', lessonId: 'a0-01-l01', status: 'completed', completedAt: NOW, updatedAt: NOW })
    await activateLocalUser('preview-student-1')
    await activateLocalUser('11111111-1111-4111-8111-111111111111')
    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:preview-student-1`)).toBeNull()
    expect(await repo.listLessonProgress('11111111-1111-4111-8111-111111111111')).toEqual([])
  })
})
