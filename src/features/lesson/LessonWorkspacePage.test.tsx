import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '@/config/env'
import { PROGRESS_STORAGE_PREFIX } from '@/features/curriculum/persistence/local-storage'

const mockEnv: { env: AppEnv } = {
  env: { supabaseUrl: null, supabaseAnonKey: null, supabaseConfigured: false, uiPreview: true, basePath: '/speak-lab/', isDev: false },
}
vi.mock('@/config/env', () => mockEnv)
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, vi.fn()], updateServiceWorker: vi.fn() }),
}))

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

describe('Learn flow with the real curriculum (preview session)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('lists levels and chapters, with only A0-01 openable for a new student', async () => {
    await renderAt('/learn')
    expect(await screen.findByRole('heading', { name: 'Your curriculum' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^A0 Foundations/ })).toHaveAttribute('aria-pressed', 'true')
    const cards = await screen.findAllByTestId('chapter-card')
    expect(cards).toHaveLength(8)
    expect(cards[0]).toHaveAttribute('data-status', 'available')
    expect(within(cards[0]!).getByRole('link')).toHaveAttribute('href', '/learn/a0-01')
    expect(cards[1]).toHaveAttribute('data-status', 'locked')
    expect(within(cards[1]!).queryByRole('link')).not.toBeInTheDocument()
    expect(within(cards[1]!).getByText('Not written yet')).toBeInTheDocument()
  })

  it('shows the chapter with its lessons and a locked assessment', async () => {
    await renderAt('/learn/a0-01')
    expect(await screen.findByRole('heading', { name: /Sentence structure/ })).toBeInTheDocument()
    const rows = await screen.findAllByTestId('lesson-row')
    expect(rows).toHaveLength(11)
    expect(rows[0]).toHaveAttribute('data-status', 'available')
    expect(rows[10]).toHaveAttribute('data-status', 'locked')
    expect(screen.getByRole('link', { name: /Start chapter/ })).toHaveAttribute('href', '/learn/a0-01/lessons/a0-01-l01')
  })

  it('refuses to open the locked chapter check', async () => {
    await renderAt('/learn/a0-01/lessons/a0-01-l11')
    expect(await screen.findByText('This lesson is locked')).toBeInTheDocument()
  })

  it('runs a lesson, persists attempts and progress on the device, and toggles Azerbaijani help', async () => {
    const user = userEvent.setup()
    await renderAt('/learn/a0-01/lessons/a0-01-l02')
    expect(await screen.findByRole('heading', { name: 'am, is, are' })).toBeInTheDocument()
    expect(screen.getByText('Progress saved on this device')).toBeInTheDocument()

    // Azerbaijani help is off by default and reveals the az layer when switched on.
    expect(screen.queryByTestId('az-text')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /Azerbaijani help/ }))
    expect(screen.getAllByTestId('az-text').length).toBeGreaterThan(0)

    // First exercise: "I ___ a student." with a word bank.
    await user.click(screen.getByRole('button', { name: 'am' }))
    await user.click(screen.getByTestId('check-answer'))
    expect(screen.getByTestId('exercise-feedback')).toHaveAttribute('data-outcome', 'correct')

    const stored = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:preview-student-1`) ?? '{}') as {
      attempts?: { exerciseId: string; correct: boolean }[]
      lessonProgress?: { lessonId: string; status: string }[]
    }
    expect(stored.attempts?.[0]).toMatchObject({ exerciseId: 'a0-01-l02-e01', correct: true })
    expect(stored.lessonProgress?.[0]).toMatchObject({ lessonId: 'a0-01-l02', status: 'in_progress' })
  })

  it('marks a lesson completed in the chapter list after the summary', async () => {
    const user = userEvent.setup()
    // Pre-seed: lesson l01 is in progress; complete it through the UI would take 12 exercises,
    // so simulate completion via the repository contract and verify the chapter view reflects it.
    localStorage.setItem(
      `${PROGRESS_STORAGE_PREFIX}:preview-student-1`,
      JSON.stringify({
        lessonProgress: [
          { studentId: 'preview-student-1', chapterId: 'a0-01', lessonId: 'a0-01-l01', status: 'completed', bestScore: 92, updatedAt: 'x' },
        ],
        attempts: [],
        overrides: [],
      }),
    )
    await renderAt('/learn/a0-01')
    const rows = await screen.findAllByTestId('lesson-row')
    expect(rows[0]).toHaveAttribute('data-status', 'completed')
    expect(within(rows[0]!).getByText('92%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAttribute('href', '/learn/a0-01/lessons/a0-01-l02')
    await user.click(screen.getByRole('link', { name: /Continue/ }))
    expect(await screen.findByRole('heading', { name: 'am, is, are' })).toBeInTheDocument()
  })
})

describe('Chapter check in the preview session (client gateway applying the server rules)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  function unlockAssessment() {
    // Every practice lesson of A0-01 done, so the chapter check is available.
    localStorage.setItem(
      `${PROGRESS_STORAGE_PREFIX}:preview-student-1`,
      JSON.stringify({
        lessonProgress: Array.from({ length: 10 }, (_, i) => ({
          studentId: 'preview-student-1',
          chapterId: 'a0-01',
          lessonId: `a0-01-l${String(i + 1).padStart(2, '0')}`,
          status: 'completed',
          bestScore: 100,
          completedAt: 'x',
          updatedAt: 'x',
        })),
        attempts: [],
        overrides: [],
        assessments: [],
      }),
    )
  }

  it('starts an attempt, saves answers without feedback, submits and records the attempt (not as lesson progress)', async () => {
    const user = userEvent.setup()
    unlockAssessment()
    await renderAt('/learn/a0-01/lessons/a0-01-l11')
    expect(await screen.findByRole('heading', { level: 1, name: 'Chapter check' })).toBeInTheDocument()
    expect(await screen.findByTestId('assessment-status')).toHaveTextContent('No attempts yet')
    await user.click(screen.getByTestId('start-assessment'))
    expect(await screen.findByTestId('assessment-attempt')).toHaveTextContent('Attempt 1 of 3')

    // Walk through every exercise giving a minimal (mostly wrong) answer, then submit.
    const total = Number(/of (\d+)/.exec(screen.getByText(/Exercise 1 of/).textContent ?? '')?.[1])
    expect(total).toBeGreaterThan(5)
    for (let i = 0; i < total; i++) {
      // Scope every query to the runner: the app shell has its own radios (theme switch).
      const runner = within(screen.getByTestId('exercise-runner'))
      const check = runner.getByTestId('check-answer')
      if ((check as HTMLButtonElement).disabled) {
        const radio = runner.queryAllByRole('radio')[0]
        if (radio) await user.click(radio)
        for (const input of runner.queryAllByRole('textbox')) await user.type(input, 'x')
        const pool = runner.queryByTestId('ordering-pool')
        if (pool) {
          const tokens = within(pool).getAllByRole('button').length
          for (let k = 0; k < tokens; k++) {
            const chip = within(pool).queryAllByRole('button').find((b) => !(b as HTMLButtonElement).disabled)
            if (!chip) break
            await user.click(chip)
          }
        }
        const left = runner.queryByRole('group', { name: 'Left items' })
        const right = runner.queryByRole('group', { name: 'Right items' })
        if (left && right) {
          const count = Math.min(within(left).getAllByRole('button').length, within(right).getAllByRole('button').length)
          for (let k = 0; k < count; k++) {
            await user.click(within(left).getAllByRole('button')[k]!)
            await user.click(within(right).getAllByRole('button')[k]!)
          }
        }
      }
      await user.click(runner.getByTestId('check-answer'))
      expect(runner.queryByTestId('exercise-feedback')).not.toBeInTheDocument()
      expect(runner.getByRole('status')).toHaveTextContent('Answer saved')
      const next = runner.queryByTestId('next-exercise')
      if (next) await user.click(next)
    }
    const submit = screen.getByRole('button', { name: /Submit/ })
    expect(submit).toBeEnabled()
    await user.click(submit)
    expect(await screen.findByTestId('summary-outcome')).toHaveTextContent(/Passed|Not passed yet/)
    expect(screen.getByTestId('summary-attempts')).toHaveTextContent('2 attempts left')

    const stored = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:preview-student-1`) ?? '{}') as {
      assessments?: { status: string; attemptNumber: number }[]
      lessonProgress?: { lessonId: string }[]
    }
    expect(stored.assessments?.[0]).toMatchObject({ status: 'submitted', attemptNumber: 1 })
    expect(stored.lessonProgress?.some((r) => r.lessonId === 'a0-01-l11')).toBe(false)
  }, 60_000)

  it('refuses the chapter check while practice lessons are open', async () => {
    await renderAt('/learn/a0-01/lessons/a0-01-l11')
    expect(await screen.findByText('This lesson is locked')).toBeInTheDocument()
  })
})
