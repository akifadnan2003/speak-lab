/* oxlint-disable react/only-export-components -- provider module exporting its hooks */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createStaticVocabularyBank } from './content'
import { createLocalStorageVocabularyRepository } from './persistence/local-storage'
import type { VocabularyBankSource, VocabularyRepository, VocabularyReviewRecord, VocabularyState } from './ports'

/**
 * Dependency injection for the vocabulary bank and progress repository.
 * Defaults: bundled bank + localStorage. The Supabase implementations will
 * be passed from App.tsx later; nothing below changes.
 */
export interface VocabularyServices {
  readonly bank: VocabularyBankSource
  readonly repository: VocabularyRepository
  readonly storage: 'device' | 'cloud'
}

const VocabularyContext = createContext<VocabularyServices | null>(null)

let defaults: VocabularyServices | null = null
function getDefaults(): VocabularyServices {
  defaults ??= { bank: createStaticVocabularyBank(), repository: createLocalStorageVocabularyRepository(), storage: 'device' }
  return defaults
}

export function VocabularyProvider({ services, children }: { services?: VocabularyServices; children: ReactNode }) {
  const value = useMemo(() => services ?? getDefaults(), [services])
  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>
}

export function useVocabularyServices(): VocabularyServices {
  return useContext(VocabularyContext) ?? getDefaults()
}

export const vocabularyKeys = {
  bank: ['vocabulary', 'bank'] as const,
  states: (studentId: string) => ['student', studentId, 'vocab-states'] as const,
  reviews: (studentId: string) => ['student', studentId, 'vocab-reviews'] as const,
}

export function useVocabularyBank() {
  const { bank } = useVocabularyServices()
  return useQuery({ queryKey: vocabularyKeys.bank, queryFn: () => bank.listEntries(), staleTime: Infinity })
}

export function useVocabularyRecords(studentId: string | null) {
  const { repository } = useVocabularyServices()
  const id = studentId ?? ''
  const states = useQuery({ queryKey: vocabularyKeys.states(id), queryFn: () => repository.listStates(id), enabled: id.length > 0 })
  const reviews = useQuery({ queryKey: vocabularyKeys.reviews(id), queryFn: () => repository.listReviews(id), enabled: id.length > 0 })
  return {
    states: states.data,
    reviews: reviews.data,
    isLoading: states.isLoading || reviews.isLoading,
    error: states.error ?? reviews.error,
  }
}

export function useVocabularyMutations(studentId: string) {
  const { repository } = useVocabularyServices()
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: vocabularyKeys.states(studentId) })
    void client.invalidateQueries({ queryKey: vocabularyKeys.reviews(studentId) })
  }
  const saveReview = useMutation({
    mutationFn: async ({ state, review }: { state: VocabularyState; review: VocabularyReviewRecord }) => {
      await repository.upsertState(state)
      await repository.recordReview(review)
    },
    onSuccess: invalidate,
  })
  const reset = useMutation({ mutationFn: () => repository.clear(studentId), onSuccess: invalidate })
  return { saveReview, reset }
}
