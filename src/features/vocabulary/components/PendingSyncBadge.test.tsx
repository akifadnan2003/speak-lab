import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createStaticVocabularyBank } from '../content'
import type { SyncReport, VocabularySync } from '../persistence/cloud'
import { createMemoryVocabularyRepository } from '../persistence/memory'
import { VocabularyProvider, type VocabularyServices } from '../VocabularyProvider'
import { PendingSyncBadge } from './PendingSyncBadge'

const A = '11111111-1111-4111-8111-111111111111'

vi.mock('@/features/auth/AuthProvider', () => ({ useCurrentUser: () => ({ id: A }) }))

/** A controllable stand-in for the cloud repository's queue. */
function fakeSync(initial: number) {
  let count = initial
  const listeners = new Set<() => void>()
  const flush = vi.fn(async (): Promise<SyncReport> => {
    count = 0
    for (const l of listeners) l()
    return { sent: 0, statuses: {}, rejected: [] }
  })
  const sync: VocabularySync = {
    flush,
    pendingCount: (studentId) => (studentId === A ? count : 0),
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
  return {
    sync,
    flush,
    set(next: number) {
      count = next
      for (const l of listeners) l()
    },
  }
}

function renderBadge(sync?: VocabularySync) {
  const services: VocabularyServices = {
    bank: createStaticVocabularyBank(),
    repository: createMemoryVocabularyRepository(),
    storage: sync ? 'cloud' : 'device',
    ...(sync ? { sync } : {}),
  }
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <VocabularyProvider services={services}>
        <PendingSyncBadge />
      </VocabularyProvider>
    </QueryClientProvider>,
  )
}

describe('PendingSyncBadge', () => {
  it('renders nothing in device mode', () => {
    const { container } = renderBadge()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while everything is synced, and appears as soon as answers queue up', () => {
    const q = fakeSync(0)
    const { container } = renderBadge(q.sync)
    expect(container).toBeEmptyDOMElement()
    act(() => q.set(2))
    const badge = screen.getByTestId('vocab-pending-sync')
    expect(badge).toHaveAttribute('data-count', '2')
    expect(badge).toHaveTextContent('2 answers have not reached your account yet.')
    expect(badge).toHaveTextContent('Signing out deletes them.')
    act(() => q.set(1))
    expect(screen.getByTestId('vocab-pending-sync')).toHaveTextContent('1 answer has not reached your account yet.')
  })

  it('"Try now" flushes the queue and the badge disappears once it is empty', async () => {
    const q = fakeSync(3)
    renderBadge(q.sync)
    await userEvent.click(screen.getByTestId('vocab-pending-retry'))
    expect(q.flush).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('vocab-pending-sync')).not.toBeInTheDocument()
  })
})
