import type { AssessmentGateway, ProgressRepository } from '../ports'
import type { Chapter } from '../schema'
import { createMemoryAssessmentGateway, createMemoryProgressRepository, createMemoryStore, type MemoryStore } from './memory'

/**
 * localStorage-backed ProgressRepository and AssessmentGateway.
 *
 * Used only by builds without a backend (`VITE_UI_PREVIEW`): progress survives reloads on one
 * device so the Learn flow can be reviewed, and the UI labels it as device-only. Real builds use
 * the Supabase implementations (`./supabase.ts`). Storage is namespaced per student id so
 * switching preview roles never mixes records, and every key starts with `speaklab.` so the
 * M2 sign-out purge removes it (`clearStoredProgress` is also registered as a cleaner).
 *
 * Every operation reads the stored JSON fresh and writes it back, so two tabs (or tests) sharing
 * one Storage never see stale cached state.
 */
export const PROGRESS_STORAGE_PREFIX = 'speaklab.progress.v1'
const MAX_STORED_ATTEMPTS = 2000

function storageKey(studentId: string) {
  return `${PROGRESS_STORAGE_PREFIX}:${studentId}`
}

function readStore(storage: Storage, studentId: string): MemoryStore {
  try {
    const raw = storage.getItem(storageKey(studentId))
    if (!raw) return createMemoryStore()
    const parsed = JSON.parse(raw) as Partial<MemoryStore>
    return {
      lessonProgress: Array.isArray(parsed.lessonProgress) ? parsed.lessonProgress : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [],
      assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
    }
  } catch {
    return createMemoryStore()
  }
}

function writeStore(storage: Storage, studentId: string, store: MemoryStore) {
  try {
    const trimmed: MemoryStore = { ...store, attempts: store.attempts.slice(-MAX_STORED_ATTEMPTS) }
    storage.setItem(storageKey(studentId), JSON.stringify(trimmed))
  } catch {
    /* quota exceeded or storage unavailable: the write is lost, reads stay consistent */
  }
}

/**
 * Remove every device-local progress record. Registered with `registerLocalDataCleaner` so
 * sign-out and account switching call it (see `src/features/curriculum/local-cleanup.ts`).
 */
export function clearStoredProgress(storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined) {
  if (!storage) return
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(`${PROGRESS_STORAGE_PREFIX}:`)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

function defaultStorage(): Storage | undefined {
  return typeof window !== 'undefined' ? window.localStorage : undefined
}

export function createLocalStorageProgressRepository(
  storage: Storage | undefined = defaultStorage(),
  chapters?: readonly Chapter[],
): ProgressRepository {
  if (!storage) return createMemoryProgressRepository(undefined, undefined, chapters)
  const forStudent = (studentId: string) =>
    createMemoryProgressRepository(readStore(storage, studentId), (s) => writeStore(storage, studentId, s), chapters)
  return {
    listLessonProgress: (studentId) => forStudent(studentId).listLessonProgress(studentId),
    upsertLessonProgress: (record) => forStudent(record.studentId).upsertLessonProgress(record),
    recordAttempt: (attempt) => forStudent(attempt.studentId).recordAttempt(attempt),
    listAttempts: (studentId, filter) => forStudent(studentId).listAttempts(studentId, filter),
    listChapterOverrides: (studentId) => forStudent(studentId).listChapterOverrides(studentId),
    setChapterOverride: (override) => forStudent(override.studentId).setChapterOverride(override),
    clearChapterOverride: (studentId, chapterId) => forStudent(studentId).clearChapterOverride(studentId, chapterId),
  }
}

export function createLocalStorageAssessmentGateway(
  storage: Storage | undefined = defaultStorage(),
  chapters?: readonly Chapter[],
): AssessmentGateway {
  if (!storage) return createMemoryAssessmentGateway(undefined, undefined, chapters)
  const forStudent = (studentId: string) =>
    createMemoryAssessmentGateway(readStore(storage, studentId), (s) => writeStore(storage, studentId, s), chapters)
  return {
    start: (input) => forStudent(input.studentId).start(input),
    submit: (input) => forStudent(input.studentId).submit(input),
    listAttempts: (studentId, filter) => forStudent(studentId).listAttempts(studentId, filter),
    reset: (input) => forStudent(input.studentId).reset(input),
  }
}
