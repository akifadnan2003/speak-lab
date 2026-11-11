import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LocalImportPlan, LocalVocabularyImporter } from '../cloud-import'
import { createStaticVocabularyBank } from '../content'
import { createMemoryVocabularyRepository } from '../persistence/memory'
import { VocabularyProvider } from '../VocabularyProvider'
import { LocalImportCard } from './LocalImportCard'

const A = '11111111-1111-4111-8111-111111111111'

const plan: LocalImportPlan = {
  studentId: A,
  snapshot: { version: 1, studentId: A, exportedAt: '2026-11-01T00:00:00.000Z', states: [], reviews: new Array(5).fill(null) },
  upload: new Array(3).fill(null),
  skipped: [],
  entries: [
    { entryId: 'v-hello', resolution: 'import' },
    { entryId: 'v-name', resolution: 'merge' },
    { entryId: 'v-from', resolution: 'server_newer' },
  ],
  statesWithoutReviews: [],
}

function renderCard(importer: LocalVocabularyImporter) {
  const services = { bank: createStaticVocabularyBank(), repository: createMemoryVocabularyRepository(), storage: 'cloud' as const, importer }
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VocabularyProvider services={services}>
        <LocalImportCard studentId={A} />
      </VocabularyProvider>
    </QueryClientProvider>,
  )
}

describe('LocalImportCard', () => {
  it('renders nothing when there is nothing on the device', async () => {
    const inspect = vi.fn().mockResolvedValue(null)
    const { container } = renderCard({ inspect, run: vi.fn(), discard: vi.fn() })
    await waitFor(() => expect(inspect).toHaveBeenCalledWith(A))
    expect(container).toBeEmptyDOMElement()
  })

  it('explains what will happen and uploads only after the learner confirms', async () => {
    const run = vi.fn().mockResolvedValue({ statuses: { applied: 2, recorded: 1 }, rejected: [], clearedDevice: true })
    renderCard({ inspect: vi.fn().mockResolvedValue(plan), run, discard: vi.fn() })
    const card = await screen.findByTestId('vocab-import')
    expect(card).toHaveTextContent('5 answers for 3 words')
    expect(screen.getByTestId('vocab-import-plan')).toHaveTextContent('1 word will be added')
    expect(screen.getByTestId('vocab-import-plan')).toHaveTextContent('already have more recent progress in your account and stay as they are')
    expect(run).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('vocab-import-confirm'))
    expect(run).toHaveBeenCalledWith(plan, { consent: true })
    expect(await screen.findByTestId('vocab-import-done')).toHaveTextContent('2 answers added to your progress, 1 older answer kept as history only')
  })

  it('keeps the device copy and says so when the upload fails', async () => {
    const run = vi.fn().mockRejectedValue(new Error('offline'))
    const discard = vi.fn()
    renderCard({ inspect: vi.fn().mockResolvedValue(plan), run, discard })
    await userEvent.click(await screen.findByTestId('vocab-import-confirm'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was deleted from this device')
    expect(discard).not.toHaveBeenCalled()
  })

  it('"Not now" hides the card without uploading or deleting anything', async () => {
    const run = vi.fn()
    const discard = vi.fn()
    renderCard({ inspect: vi.fn().mockResolvedValue(plan), run, discard })
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByTestId('vocab-import')).toBeNull()
    expect(run).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
  })

  it('deleting the device copy needs a second confirmation', async () => {
    const discard = vi.fn().mockResolvedValue(undefined)
    renderCard({ inspect: vi.fn().mockResolvedValue(plan), run: vi.fn(), discard })
    await userEvent.click(await screen.findByTestId('vocab-import-discard'))
    expect(discard).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByTestId('vocab-import-discard-confirm'))
    expect(discard).toHaveBeenCalledWith(A)
  })
})
