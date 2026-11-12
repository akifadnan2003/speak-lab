import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '@/config/env'
import type { CurriculumServices } from '@/features/curriculum/CurriculumProvider'
import { PROGRESS_STORAGE_PREFIX } from '@/features/curriculum/persistence/local-storage'

const mockEnv: { env: AppEnv } = {
  env: { supabaseUrl: null, supabaseAnonKey: null, supabaseConfigured: false, uiPreview: true, basePath: '/speak-lab/', isDev: false },
}
vi.mock('@/config/env', () => mockEnv)
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, vi.fn()], updateServiceWorker: vi.fn() }),
}))

async function renderAt(path: string, services?: CurriculumServices) {
  const { createMemoryRouter, RouterProvider } = await import('react-router')
  const { routes } = await import('@/app/router')
  const { AuthProvider } = await import('@/features/auth/AuthProvider')
  const { CurriculumProvider } = await import('@/features/curriculum/CurriculumProvider')
  const { TooltipProvider } = await import('@/components/ui/tooltip')
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <CurriculumProvider services={services}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </CurriculumProvider>
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

describe('Chapter check (preview session; the client gateway applies the server rules)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  /** A two-lesson chapter with a two-question check keeps the flow deterministic and fast. */
  async function tinyServices(seedCompleted: boolean) {
    const { parseChapter } = await import('@/features/curriculum/schema')
    const { mc } = await import('@/features/curriculum/content/authoring')
    const { createStaticContentSource } = await import('@/features/curriculum/content')
    const { createMemoryAssessmentGateway, createMemoryProgressRepository, createMemoryStore } = await import('@/features/curriculum/persistence/memory')
    const chapter = parseChapter({
      id: 't-01',
      level: 'A0',
      number: 1,
      title: 'Tiny chapter',
      description: 'For tests.',
      objectives: ['Test'],
      skills: ['grammar'],
      status: 'authored',
      lessons: [
        { id: 't-01-l01', title: 'Practice', kind: 'grammar', estimatedMinutes: 5, exercises: [mc('t-01-l01-e01', 'I ___', ['is', 'am'], 1)] },
        {
          id: 't-01-l02',
          title: 'Chapter check',
          kind: 'assessment',
          estimatedMinutes: 5,
          exercises: [mc('t-01-l02-e01', 'She ___', ['is', 'am'], 0), mc('t-01-l02-e02', 'They ___', ['are', 'is'], 0)],
        },
      ],
    })
    const chapters = [chapter]
    const store = createMemoryStore()
    if (seedCompleted) {
      store.lessonProgress.push({ studentId: 'preview-student-1', chapterId: 't-01', lessonId: 't-01-l01', status: 'completed', bestScore: 100, completedAt: 'x', updatedAt: 'x' })
    }
    return {
      store,
      services: {
        content: createStaticContentSource(chapters),
        progress: createMemoryProgressRepository(store, undefined, chapters),
        assessments: createMemoryAssessmentGateway(store, undefined, chapters),
        storage: 'device' as const,
      },
    }
  }

  it('starts an attempt, saves answers without feedback, submits for grading and records the attempt (never as lesson progress)', async () => {
    const user = userEvent.setup()
    const { store, services } = await tinyServices(true)
    await renderAt('/learn/t-01/lessons/t-01-l02', services)
    expect(await screen.findByRole('heading', { level: 1, name: 'Chapter check' })).toBeInTheDocument()
    expect(await screen.findByTestId('assessment-status')).toHaveTextContent('No attempts yet')
    await user.click(screen.getByTestId('start-assessment'))
    const runner = within(await screen.findByTestId('exercise-runner'))
    expect(runner.getByTestId('assessment-attempt')).toHaveTextContent('Attempt 1 of 3')

    // Question 1 wrong, question 2 right; no feedback while answering.
    await user.click(runner.getByRole('radio', { name: /am/ }))
    await user.click(runner.getByTestId('check-answer'))
    expect(runner.queryByTestId('exercise-feedback')).not.toBeInTheDocument()
    expect(runner.getByRole('status')).toHaveTextContent('Answer saved')
    await user.click(runner.getByTestId('next-exercise'))
    await user.click(runner.getByRole('radio', { name: /are/ }))
    await user.click(runner.getByTestId('check-answer'))
    await user.click(runner.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByTestId('summary-outcome')).toHaveTextContent('Not passed yet')
    expect(screen.getByTestId('summary-score')).toHaveTextContent('Score 50%')
    expect(screen.getByTestId('summary-attempts')).toHaveTextContent('2 attempts left')
    expect(screen.getByTestId('answers-hidden')).toBeInTheDocument()

    expect(store.assessments).toHaveLength(1)
    expect(store.assessments[0]).toMatchObject({ status: 'submitted', attemptNumber: 1, score: 50, passed: false })
    expect(store.lessonProgress.some((r) => r.lessonId === 't-01-l02')).toBe(false)

    // A retake opens attempt 2 on a fresh runner.
    await user.click(screen.getByTestId('retake'))
    expect(await screen.findByTestId('assessment-attempt')).toHaveTextContent('Attempt 2 of 3')
  })

  it('refuses the chapter check while practice lessons are open', async () => {
    const { services } = await tinyServices(false)
    await renderAt('/learn/t-01/lessons/t-01-l02', services)
    expect(await screen.findByText('This lesson is locked')).toBeInTheDocument()
  })
})
