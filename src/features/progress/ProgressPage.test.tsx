import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '@/config/env'
import { resetCurriculumServicesForTests } from '@/features/curriculum/CurriculumProvider'
import { createLocalStorageProgressRepository } from '@/features/curriculum/persistence/local-storage'
import { createLocalStorageVocabularyRepository } from '@/features/vocabulary/persistence/local-storage'
import { createInitialState, schedule } from '@/features/vocabulary/srs/scheduler'

const mockEnv = vi.hoisted(
  (): { env: AppEnv } => ({ env: { supabaseUrl: null, supabaseAnonKey: null, supabaseConfigured: false, uiPreview: true, basePath: '/', isDev: false } }),
)
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
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return router
}

/** Seeds the device repositories exactly as the lesson workspace and the vocabulary session would. */
async function seedSomeLearning(now: Date) {
  const progress = createLocalStorageProgressRepository()
  const at = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  await progress.recordAttempt({
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    studentId: STUDENT,
    chapterId: 'a0-01',
    chapterVersion: 1,
    lessonId: 'a0-01-l01',
    exerciseId: 'a0-01-l01-e01',
    exerciseType: 'multiple_choice',
    attemptNumber: 1,
    answer: { type: 'multiple_choice', optionId: 'a' },
    correct: true,
    score: 1,
    hintUsed: false,
    createdAt: at,
  })
  await progress.upsertLessonProgress({ studentId: STUDENT, chapterId: 'a0-01', lessonId: 'a0-01-l01', status: 'completed', bestScore: 100, lastScore: 100, completedAt: at, updatedAt: at })
  const vocabulary = createLocalStorageVocabularyRepository()
  const { state, quality } = schedule(createInitialState(STUDENT, 'v-hello', now), { skill: 'recognition', correct: true, now })
  await vocabulary.upsertState(state)
  await vocabulary.recordReview({
    id: 'rev-progress-test-00001',
    studentId: STUDENT,
    entryId: 'v-hello',
    modeId: 'meaning_choice',
    skill: 'recognition',
    correct: true,
    quality,
    hintUsed: false,
    reviewedAt: now.toISOString(),
    intervalDaysAfter: state.intervalDays,
    stageAfter: state.stage,
  })
}

describe('Progress page (preview session, device records)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetCurriculumServicesForTests()
  })

  it('shows an honest empty state for a new learner: no invented numbers, every skill unassessed', async () => {
    await renderAt('/progress')
    expect(await screen.findByRole('heading', { name: 'Your learning record' })).toBeInTheDocument()
    expect(await screen.findByTestId('progress-empty')).toBeInTheDocument()
    const stats = screen.getByTestId('overview-stats')
    expect(stats).toHaveAttribute('data-empty', 'true')
    expect(within(stats).getByText('Lessons completed').nextSibling).toHaveTextContent('0')
    expect(within(stats).getByText('Learning streak').nextSibling).toHaveTextContent('0d')
    expect(screen.getByTestId('weekly-activity')).toHaveAttribute('data-total', '0')
    expect(screen.getAllByTestId('skill-row')).toHaveLength(6)
    expect(screen.getAllByTestId('skill-row').filter((row) => row.getAttribute('data-evidence') === 'measured')).toHaveLength(0)
    expect(screen.getByText('Listening').closest('[data-testid="skill-row"]')).toHaveAttribute('data-evidence', 'no_content')
    expect(screen.getByTestId('weak-topics-empty')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument()
    expect(screen.getByTestId('achievements-card')).toHaveAttribute('data-earned', '0')
    expect(screen.getByTestId('next-step')).toHaveAttribute('data-kind', 'start')
    expect(screen.getByTestId('progress-storage-label')).toHaveTextContent('Records on this device')
  })

  it('reflects real device records: a completed lesson and a vocabulary review', async () => {
    await seedSomeLearning(new Date())
    await renderAt('/progress')
    const stats = await screen.findByTestId('overview-stats')
    expect(stats).toHaveAttribute('data-empty', 'false')
    expect(within(stats).getByText('Lessons completed').nextSibling).toHaveTextContent('1')
    expect(within(stats).getByText('Learning streak').nextSibling).toHaveTextContent('1d')
    expect(within(stats).getByText('Words learned').nextSibling).toHaveTextContent('1')
    expect(screen.getByTestId('weekly-activity')).toHaveAttribute('data-total', '3') // lesson + exercise + review
    expect(screen.queryByTestId('progress-empty')).not.toBeInTheDocument()
    const earned = screen.getAllByTestId('achievement').filter((a) => a.getAttribute('data-earned') === 'true')
    expect(earned.map((a) => a.getAttribute('data-id')).sort()).toEqual(['first_lesson', 'first_vocabulary_review'])
    expect(screen.getByText('Completed English sentences: who + what')).toBeInTheDocument()
    expect(within(screen.getByTestId('timeline-card')).getByText('First vocabulary review')).toBeInTheDocument()
    // One graded exercise is far below the evidence threshold: still "Not assessed yet".
    expect(screen.getByText('Grammar').closest('[data-testid="skill-row"]')).toHaveAttribute('data-evidence', 'insufficient')
    expect(screen.getByTestId('next-step')).toHaveAttribute('data-kind', 'continue')
  })

  it('drives the student home page from the same records', async () => {
    await seedSomeLearning(new Date())
    await renderAt('/')
    expect(await screen.findByTestId('home-metrics')).toBeInTheDocument()
    expect(screen.getByTestId('home-badges')).toHaveTextContent('1-day streak')
    expect(screen.getByTestId('home-vocab')).toHaveTextContent('1 learned')
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument()
    expect(screen.queryByText(/Pending assignments/)).not.toBeInTheDocument()
  })
})
