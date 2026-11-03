import type { VocabularyRepository } from '../ports'
import { createMemoryVocabularyRepository, createVocabularyStore, type VocabularyStore } from './memory'

/**
 * localStorage-backed vocabulary repository, namespaced per student id so two
 * accounts on one device never share records. Reads fresh on every call and
 * writes after every mutation (same approach as the curriculum repository).
 */
export const VOCAB_STORAGE_PREFIX = 'speaklab.vocab.v1'
const MAX_STORED_REVIEWS = 5000

function storageKey(studentId: string) {
  return `${VOCAB_STORAGE_PREFIX}:${studentId}`
}

function readStore(storage: Storage, studentId: string): VocabularyStore {
  try {
    const raw = storage.getItem(storageKey(studentId))
    if (!raw) return createVocabularyStore()
    const parsed = JSON.parse(raw) as Partial<VocabularyStore>
    return {
      states: Array.isArray(parsed.states) ? parsed.states : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    }
  } catch {
    return createVocabularyStore()
  }
}

function writeStore(storage: Storage, studentId: string, store: VocabularyStore) {
  try {
    if (store.states.length === 0 && store.reviews.length === 0) {
      storage.removeItem(storageKey(studentId))
      return
    }
    storage.setItem(storageKey(studentId), JSON.stringify({ ...store, reviews: store.reviews.slice(-MAX_STORED_REVIEWS) }))
  } catch {
    /* quota exceeded or storage unavailable */
  }
}

/** Remove every student's device-local vocabulary records (call on sign-out). */
export function clearStoredVocabulary(storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined) {
  if (!storage) return
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(`${VOCAB_STORAGE_PREFIX}:`)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function createLocalStorageVocabularyRepository(
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): VocabularyRepository {
  if (!storage) return createMemoryVocabularyRepository()
  const forStudent = (studentId: string) =>
    createMemoryVocabularyRepository(readStore(storage, studentId), (s) => writeStore(storage, studentId, s))
  return {
    listStates: (studentId) => forStudent(studentId).listStates(studentId),
    upsertState: (state) => forStudent(state.studentId).upsertState(state),
    recordReview: (review) => forStudent(review.studentId).recordReview(review),
    listReviews: (studentId, filter) => forStudent(studentId).listReviews(studentId, filter),
    clear: (studentId) => forStudent(studentId).clear(studentId),
  }
}
