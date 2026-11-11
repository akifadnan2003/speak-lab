/* oxlint-disable react/only-export-components -- provider module exporting its hooks */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { createLocalVocabularyImporter, type LocalVocabularyImporter } from './cloud-import'
import { createStaticVocabularyBank } from './content'
import { createSupabaseVocabularyApi } from './persistence/api'
import { ensureVocabularyCleanupRegistered, trackVocabularyRepository } from './persistence/cleanup'
import { createCloudVocabularyRepository } from './persistence/cloud'
import { createLocalStorageVocabularyRepository } from './persistence/local-storage'
import type { VocabularyBankSource, VocabularyRepository, VocabularyReviewRecord, VocabularyState } from './ports'

/**
 * Dependency injection for the vocabulary bank and progress repository.
 *
 * Defaults: with a configured Supabase project, progress lives in the student's account
 * (`storage: 'cloud'`, server-authoritative, offline queue) and `importer` offers a consented
 * upload of anything older saved on this device. Without one (UI preview, tests) it stays on the
 * device as in M4. Screens and the scheduler are identical in both cases.
 */
export interface VocabularyServices {
  readonly bank: VocabularyBankSource
  readonly repository: VocabularyRepository
  readonly storage: 'device' | 'cloud'
  readonly importer?: LocalVocabularyImporter
}

const VocabularyContext = createContext<VocabularyServices | null>(null)

// Wipes vocabulary caches and queues on sign-out and account switch (M2 local-data contract).
ensureVocabularyCleanupRegistered()

export function createDefaultVocabularyServices(): VocabularyServices {
  const bank = createStaticVocabularyBank()
  const device = createLocalStorageVocabularyRepository()
  const client = getSupabaseClient()
  if (!client) return { bank, repository: device, storage: 'device' }
  const api = createSupabaseVocabularyApi(client)
  // The session's user id is only used to refuse mismatched requests; the database always
  // takes the student from the verified JWT.
  const getSessionUserId = async () => (await client.auth.getSession()).data.session?.user.id ?? null
  const repository = createCloudVocabularyRepository({ api, getSessionUserId })
  trackVocabularyRepository(repository)
  return { bank, repository, storage: 'cloud', importer: createLocalVocabularyImporter({ device, api, getSessionUserId }) }
}

let defaults: VocabularyServices | null = null
function getDefaults(): VocabularyServices {
  defaults ??= createDefaultVocabularyServices()
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
  localImport: (studentId: string) => ['student', studentId, 'vocab-local-import'] as const,
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

/** What an upload of this device's older vocabulary practice would do (cloud mode only). */
export function useLocalVocabularyImport(studentId: string | null) {
  const { importer } = useVocabularyServices()
  const client = useQueryClient()
  const id = studentId ?? ''
  const plan = useQuery({
    queryKey: vocabularyKeys.localImport(id),
    queryFn: () => importer!.inspect(id),
    enabled: Boolean(importer) && id.length > 0,
    staleTime: Infinity,
    retry: false,
  })
  const done = () => {
    void client.invalidateQueries({ queryKey: vocabularyKeys.localImport(id) })
    void client.invalidateQueries({ queryKey: vocabularyKeys.states(id) })
    void client.invalidateQueries({ queryKey: vocabularyKeys.reviews(id) })
  }
  const upload = useMutation({
    mutationFn: () => {
      if (!importer || !plan.data) throw new Error('Nothing to upload')
      return importer.run(plan.data, { consent: true })
    },
    onSuccess: done,
  })
  const discard = useMutation({
    mutationFn: () => {
      if (!importer) throw new Error('Nothing to discard')
      return importer.discard(id)
    },
    onSuccess: done,
  })
  return { plan, upload, discard }
}
