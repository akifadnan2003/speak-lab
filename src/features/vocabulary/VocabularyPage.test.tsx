import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '@/config/env'
import { VOCAB_STORAGE_PREFIX } from './persistence/local-storage'

const mockEnv: { env: AppEnv } = {
  env: { supabaseUrl: null, supabaseAnonKey: null, supabaseConfigured: false, uiPreview: true, basePath: '/speak-lab/', isDev: false },
}
vi.mock('@/config/env', () => mockEnv)
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, vi.fn()], updateServiceWorker: vi.fn() }),
}))

const STUDENT = 'preview-student-1'

async function renderAt(path: string) {
  const { createMemoryRouter, RouterProvider } = await import('react-router')
  const { routes } = await import('@/app/router')
  const { AuthProvider } = await import('@/features/auth/AuthProvider')
  const { TooltipProvider } = await import('@/components/ui/tooltip')
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return router
}

function stored() {
  return JSON.parse(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:${STUDENT}`) ?? '{"states":[],"reviews":[]}') as {
    states: { entryId: string; stage: string }[]
    reviews: { entryId: string; correct: boolean }[]
  }
}

describe('Vocabulary dashboard and practice (preview session)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('shows real zeroed stats for a new student and a recommended flashcard session', async () => {
    await renderAt('/vocabulary')
    expect(await screen.findByRole('heading', { name: 'Words and phrases' })).toBeInTheDocument()
    const stats = screen.getByTestId('vocab-stats')
    expect(within(stats).getByText('Words learned').nextSibling).toHaveTextContent('0')
    expect(within(stats).getByText('Streak').nextSibling).toHaveTextContent('0d')
    // A new student gets the capped 10 new words, not the full 12-item session.
    expect(screen.getByText(/Flashcards · 10 words/)).toBeInTheDocument()
    expect(screen.getByTestId('start-session')).toHaveAttribute('href', '/vocabulary/practice/flashcards')
    expect(screen.getByText('Progress saved on this device')).toBeInTheDocument()
  })

  it('filters the word list and reveals translations only when switched on', async () => {
    const user = userEvent.setup()
    await renderAt('/vocabulary')
    await user.click(await screen.findByRole('tab', { name: /Words/ }))
    expect(screen.queryByText(/Azerbaijani:/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Search vocabulary'), 'passport')
    expect(screen.getAllByTestId('word-row')).toHaveLength(1)
    await user.click(screen.getByRole('switch', { name: /translations/ }))
    expect(screen.getByText('Azerbaijani:')).toBeInTheDocument()
    expect(screen.getByText('pasport')).toBeInTheDocument()
  })

  it('lists practice modes with unavailable ones disabled and explained', async () => {
    const user = userEvent.setup()
    await renderAt('/vocabulary')
    await user.click(await screen.findByRole('tab', { name: 'Practice' }))
    expect(screen.getAllByRole('link', { name: 'Start' })).toHaveLength(6)
    expect(screen.getByText('Needs recorded audio (M7/M8).')).toBeInTheDocument()
    expect(screen.getByText('Needs the speech pipeline (M7).')).toBeInTheDocument()
  })

  it('runs an active-recall session that persists reviews under the student id, then resets', async () => {
    const user = userEvent.setup()
    await renderAt('/vocabulary/practice/active_recall')
    expect(await screen.findByRole('heading', { name: 'Active recall' })).toBeInTheDocument()
    expect(screen.getByText('1 of 10')).toBeInTheDocument()
    await user.type(screen.getByLabelText('The word in English'), 'zzz{Enter}')
    await waitFor(() => expect(stored().reviews).toHaveLength(1))
    expect(stored().reviews[0]).toMatchObject({ correct: false })
    expect(stored().states[0]).toMatchObject({ stage: 'learning' })
    expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:preview-tutor`)).toBeNull()

    // Dashboard reflects the stored records, and reset clears them after confirmation.
    const router = await renderAt('/vocabulary')
    expect(router.state.location.pathname).toBe('/vocabulary')
    const stats = await screen.findByTestId('vocab-stats')
    expect(within(stats).getByText('Words learned').nextSibling).toHaveTextContent('1')
    await user.click(screen.getByTestId('reset-vocab'))
    await user.click(await screen.findByTestId('confirm-reset'))
    await waitFor(() => expect(localStorage.getItem(`${VOCAB_STORAGE_PREFIX}:${STUDENT}`)).toBeNull())
  })

  it('refuses an unavailable mode honestly', async () => {
    await renderAt('/vocabulary/practice/listening')
    expect(await screen.findByText('Listen and choose is not available yet')).toBeInTheDocument()
  })
})
