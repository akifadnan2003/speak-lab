import type { VocabularyRepository, VocabularyReviewRecord, VocabularyState } from '../ports'

export interface VocabularyStore {
  states: VocabularyState[]
  reviews: VocabularyReviewRecord[]
}

export function createVocabularyStore(): VocabularyStore {
  return { states: [], reviews: [] }
}

/** In-memory repository; base for the localStorage one and used by tests. */
export function createMemoryVocabularyRepository(
  store: VocabularyStore = createVocabularyStore(),
  onChange?: (store: VocabularyStore) => void,
): VocabularyRepository {
  return {
    async listStates(studentId) {
      return store.states.filter((s) => s.studentId === studentId)
    },
    async upsertState(state) {
      const i = store.states.findIndex((s) => s.studentId === state.studentId && s.entryId === state.entryId)
      if (i >= 0) store.states[i] = state
      else store.states.push(state)
      onChange?.(store)
    },
    async recordReview(review) {
      if (store.reviews.some((r) => r.id === review.id)) return
      store.reviews.push(review)
      onChange?.(store)
    },
    async listReviews(studentId, filter) {
      return store.reviews.filter(
        (r) =>
          r.studentId === studentId &&
          (filter?.entryId === undefined || r.entryId === filter.entryId) &&
          (filter?.sinceIso === undefined || r.reviewedAt >= filter.sinceIso),
      )
    },
    async clear(studentId) {
      store.states = store.states.filter((s) => s.studentId !== studentId)
      store.reviews = store.reviews.filter((r) => r.studentId !== studentId)
      onChange?.(store)
    },
  }
}
