import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createStaticVocabularyBank } from './content'
import { createMemoryVocabularyRepository } from './persistence/memory'
import { createInitialState, schedule } from './srs/scheduler'
import { useVocabularyMutations, useVocabularyRecords, VocabularyProvider, type VocabularyServices } from './VocabularyProvider'

const A = '11111111-1111-4111-8111-111111111111'

function harness(services: VocabularyServices) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <VocabularyProvider services={services}>{children}</VocabularyProvider>
    </QueryClientProvider>
  )
  return { wrapper }
}

afterEach(() => onlineManager.setOnline(true))

describe('vocabulary saving while the browser reports itself offline', () => {
  // TanStack Query pauses mutations and queries while `navigator.onLine` is false. The vocabulary
  // repositories handle offline themselves (durable queue, cached reads), so they must run anyway.
  it('still hands the answer to the repository and still reads records', async () => {
    const repository = createMemoryVocabularyRepository()
    const services: VocabularyServices = { bank: createStaticVocabularyBank(), repository, storage: 'cloud' }
    const { wrapper } = harness(services)
    onlineManager.setOnline(false)

    const records = renderHook(() => useVocabularyRecords(A), { wrapper })
    await waitFor(() => expect(records.result.current.states).toEqual([]))

    const mutations = renderHook(() => useVocabularyMutations(A), { wrapper })
    const at = new Date('2026-11-12T09:00:00Z')
    const { state, quality } = schedule(createInitialState(A, 'v-hello', at), { skill: 'recognition', correct: true, now: at })
    act(() => {
      mutations.result.current.saveReview.mutate({
        state,
        review: {
          id: 'rev-offline-1',
          studentId: A,
          entryId: 'v-hello',
          modeId: 'meaning_choice',
          skill: 'recognition',
          correct: true,
          quality,
          hintUsed: false,
          reviewedAt: at.toISOString(),
          intervalDaysAfter: state.intervalDays,
          stageAfter: state.stage,
        },
      })
    })
    await waitFor(() => expect(mutations.result.current.saveReview.isSuccess).toBe(true))
    expect((await repository.listReviews(A)).map((r) => r.id)).toEqual(['rev-offline-1'])
  })
})
