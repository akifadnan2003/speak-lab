import type { ProgressRepository } from '../ports'
import { createMemoryProgressRepository, createMemoryStore, type MemoryStore } from './memory'

/**
 * localStorage-backed ProgressRepository.
 *
 * This is the M3 stand-in for the Supabase repository: progress survives
 * reloads on one device so the Learn flow is genuinely usable today. The UI
 * labels it as device-only. Storage is namespaced per student id so switching
 * preview roles or accounts never mixes records. Attempts are capped to keep
 * the payload small; the server-side table has no such cap.
 *
 * Every operation reads the stored JSON fresh and writes it back, so two
 * tabs (or tests) sharing one Storage never see stale cached state.
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

export function createLocalStorageProgressRepository(
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): ProgressRepository {
  if (!storage) return createMemoryProgressRepository()
  const forStudent = (studentId: string) =>
    createMemoryProgressRepository(readStore(storage, studentId), (s) => writeStore(storage, studentId, s))
  return {
    listLessonProgress: (studentId) => forStudent(studentId).listLessonProgress(studentId),
    upsertLessonProgress: (record) => forStudent(record.studentId).upsertLessonProgress(record),
    recordAttempt: (attempt) => forStudent(attempt.studentId).recordAttempt(attempt),
    listAttempts: (studentId, filter) => forStudent(studentId).listAttempts(studentId, filter),
    listChapterOverrides: (studentId) => forStudent(studentId).listChapterOverrides(studentId),
  }
}
