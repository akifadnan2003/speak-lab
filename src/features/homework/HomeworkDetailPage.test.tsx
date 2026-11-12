import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeworkItem } from '@/features/assignments/model'
import { HomeworkDetailPage } from './HomeworkDetailPage'

const { state } = vi.hoisted(() => ({
  state: {
    items: [] as HomeworkItem[],
    saveDraft: vi.fn(async () => undefined),
    submit: vi.fn(async () => undefined),
    complete: vi.fn(async () => ({ completed: false, status: 'assigned', progress: { count: 0, target: 5 } })),
  },
}))

vi.mock('react-router', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router')>()), useParams: () => ({ assignmentId: 'a1' }) }))
vi.mock('@/features/auth/AuthProvider', () => ({ useCurrentUser: () => ({ id: 's1', fullName: 'Leyla' }) }))
vi.mock('@/features/curriculum/CurriculumProvider', () => ({ useChapters: () => ({ data: [] }) }))
vi.mock('@/features/assignments/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/assignments/api')>()
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => ({ mutateAsync: fn, mutate: fn, isPending: false, isError: false, isSuccess: false, error: null })
  return {
    ...original,
    useStudentHomework: () => ({ data: state.items, isPending: false, isError: false, error: null }),
    useHomeworkMutations: () => ({ saveDraft: mutation(state.saveDraft), submit: mutation(state.submit), complete: mutation(state.complete) }),
  }
})

function item(over: { kind?: 'written' | 'lesson' | 'vocabulary'; status?: HomeworkItem['submission']['status']; feedback?: string | null; cancelled?: boolean; dueAt?: string | null; evidence?: HomeworkItem['submission']['evidence'] }): HomeworkItem {
  return {
    assignment: {
      id: 'a1',
      tutorId: 't',
      kind: over.kind ?? 'written',
      title: 'Describe your weekend',
      instructions: 'Five sentences in the past simple.',
      chapterId: over.kind === 'lesson' ? 'a0-01' : null,
      lessonId: over.kind === 'lesson' ? 'a0-01-l01' : null,
      requiresPass: false,
      reviewTarget: over.kind === 'vocabulary' ? 5 : null,
      dueAt: over.dueAt ?? null,
      status: over.cancelled ? 'cancelled' : 'published',
      publishedAt: '2026-11-10T00:00:00.000Z',
      cancelledAt: over.cancelled ? '2026-11-11T00:00:00.000Z' : null,
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    },
    submission: {
      assignmentId: 'a1',
      studentId: 's1',
      status: over.status ?? 'assigned',
      draftText: '',
      submittedText: over.status === 'submitted' || over.status === 'reviewed' ? 'I visited my grandmother.' : null,
      evidence: over.evidence ?? null,
      startedAt: null,
      submittedAt: over.status === 'submitted' || over.status === 'reviewed' ? '2026-11-11T10:00:00.000Z' : null,
      reviewedAt: over.status === 'reviewed' ? '2026-11-11T12:00:00.000Z' : null,
      returnedAt: null,
      late: false,
      feedback: over.feedback ?? null,
      feedbackUpdatedAt: over.feedback ? '2026-11-11T12:00:00.000Z' : null,
    },
  }
}

const wrapper = async (ui: React.ReactElement) => {
  const { MemoryRouter } = await import('react-router')
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HomeworkDetailPage', () => {
  beforeEach(() => {
    state.items = []
    state.saveDraft.mockClear()
    state.submit.mockClear()
    state.complete.mockClear()
  })

  it('lets the student save a draft and submit a written answer after confirming', async () => {
    state.items = [item({})]
    await wrapper(<HomeworkDetailPage />)
    expect(screen.getByTestId('homework-status')).toHaveTextContent('To do')
    expect(screen.getByText('Five sentences in the past simple.')).toBeInTheDocument()
    expect(screen.getByTestId('submit-answer')).toBeDisabled()
    await userEvent.type(screen.getByTestId('homework-answer'), 'I visited my grandmother.')
    await userEvent.click(screen.getByTestId('save-draft-answer'))
    expect(state.saveDraft).toHaveBeenCalledWith({ assignmentId: 'a1', text: 'I visited my grandmother.' })
    await userEvent.click(screen.getByTestId('submit-answer'))
    await userEvent.click(await screen.findByTestId('confirm-submit-answer'))
    await waitFor(() => expect(state.submit).toHaveBeenCalledWith({ assignmentId: 'a1', text: 'I visited my grandmother.' }))
  })

  it('shows the submitted text read-only and the tutor’s feedback once reviewed', async () => {
    state.items = [item({ status: 'reviewed', feedback: 'Well done. Mind the past simple of "go".' })]
    await wrapper(<HomeworkDetailPage />)
    expect(screen.getByTestId('homework-status')).toHaveTextContent('Reviewed')
    expect(screen.getByTestId('homework-submitted-text')).toHaveTextContent('I visited my grandmother.')
    expect(screen.queryByTestId('homework-answer')).not.toBeInTheDocument()
    expect(screen.getByTestId('homework-feedback')).toHaveTextContent('Mind the past simple of "go".')
  })

  it('marks lesson homework overdue from the due date and offers "Mark as done" that reports honest progress', async () => {
    state.items = [item({ kind: 'vocabulary', dueAt: '2000-01-01T00:00:00.000Z' })]
    await wrapper(<HomeworkDetailPage />)
    expect(screen.getByTestId('homework-status')).toHaveTextContent('Overdue')
    await userEvent.click(screen.getByTestId('mark-done'))
    await waitFor(() => expect(state.complete).toHaveBeenCalledWith({ assignmentId: 'a1' }))
    expect(await screen.findByTestId('homework-not-yet')).toBeInTheDocument()
    expect(screen.getByTestId('homework-progress')).toHaveTextContent('0 of 5 reviews so far.')
  })

  it('shows verified evidence for completed lesson homework and no controls for cancelled homework', async () => {
    state.items = [item({ kind: 'lesson', status: 'submitted', evidence: { type: 'lesson_completed', best_score: 90, at: '2026-11-11T00:00:00.000Z' } })]
    await wrapper(<HomeworkDetailPage />)
    expect(screen.getByTestId('homework-evidence')).toHaveTextContent('best score of 90%')
    expect(screen.queryByTestId('mark-done')).not.toBeInTheDocument()
    state.items = [item({ cancelled: true })]
    await wrapper(<HomeworkDetailPage />)
    expect(screen.getByTestId('homework-cancelled')).toBeInTheDocument()
    expect(screen.queryByTestId('homework-answer')).not.toBeInTheDocument()
  })
})
