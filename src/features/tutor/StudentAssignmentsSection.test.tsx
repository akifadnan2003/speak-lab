import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeworkItem } from '@/features/assignments/model'
import { CURRICULUM } from '@/features/curriculum/content/curriculum-map'
import { computeProgression } from '@/features/curriculum/progression'
import type { StudentAccount } from './api'
import { StudentAssignmentsSection } from './StudentAssignmentsSection'

const { state } = vi.hoisted(() => ({
  state: {
    items: [] as HomeworkItem[],
    create: vi.fn(async (_input: { draft: Record<string, unknown>; studentIds: readonly string[]; publish: boolean }) => undefined),
    update: vi.fn(async () => undefined),
    setStatus: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    review: vi.fn(async () => undefined),
  },
}))

vi.mock('@/features/assignments/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/assignments/api')>()
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => ({ mutateAsync: fn, mutate: fn, isPending: false, isError: false, isSuccess: false, error: null })
  return {
    ...original,
    useStudentAssignments: () => ({ data: state.items, isPending: false, isError: false, error: null, dataUpdatedAt: 1 }),
    useAssignmentMutations: () => ({ create: mutation(state.create), update: mutation(state.update), setStatus: mutation(state.setStatus), remove: mutation(state.remove), review: mutation(state.review) }),
  }
})
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), useStudents: () => ({ data: [account] }) }))
vi.mock('@/features/curriculum/CurriculumProvider', () => ({
  useProgression: () => ({ chapters: CURRICULUM, states: computeProgression({ chapters: CURRICULUM, lessonProgress: [], overrides: [] }) }),
}))

const account: StudentAccount = { id: 's1', email: 'leyla@example.test', fullName: 'Leyla', status: 'active', supportLanguage: 'az', linkedAt: '2026-11-01T00:00:00.000Z', onboardingCompletedAt: '2026-11-01T00:00:00.000Z', preferences: {} }

function submitted(): HomeworkItem {
  return {
    assignment: { id: 'a1', tutorId: 't', kind: 'written', title: 'Describe your weekend', instructions: '', chapterId: null, lessonId: null, requiresPass: false, reviewTarget: null, dueAt: null, status: 'published', publishedAt: '2026-11-10T00:00:00.000Z', cancelledAt: null, createdAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z' },
    submission: { assignmentId: 'a1', studentId: 's1', status: 'submitted', draftText: 'I visited my grandmother.', submittedText: 'I visited my grandmother.', evidence: null, startedAt: '2026-11-11T09:00:00.000Z', submittedAt: '2026-11-11T10:00:00.000Z', reviewedAt: null, returnedAt: null, late: false, feedback: null, feedbackUpdatedAt: null },
  }
}

async function renderSection(path = '/tutor/students/s1/assignments') {
  const { MemoryRouter } = await import('react-router')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StudentAssignmentsSection account={account} tutorId="t" />
    </MemoryRouter>,
  )
}

describe('StudentAssignmentsSection', () => {
  beforeEach(() => {
    state.items = []
    for (const fn of [state.create, state.update, state.setStatus, state.remove, state.review]) fn.mockClear()
  })

  it('creates lesson homework from authored lessons only and assigns it now', async () => {
    await renderSection()
    await userEvent.click(screen.getByTestId('new-assignment'))
    await userEvent.selectOptions(screen.getByTestId('assignment-kind'), 'lesson')
    const options = Array.from((screen.getByTestId('assignment-lesson') as HTMLSelectElement).options).map((o) => o.value)
    expect(options.filter((v) => v.startsWith('a0-01/'))).toHaveLength(11)
    expect(options.some((v) => v.startsWith('a1-'))).toBe(false)
    await userEvent.type(screen.getByTestId('assignment-title'), 'Finish lesson 1')
    await userEvent.selectOptions(screen.getByTestId('assignment-lesson'), 'a0-01/a0-01-l11')
    await userEvent.click(screen.getByTestId('assign-now'))
    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1))
    const call = state.create.mock.calls[0]![0]
    expect(call.publish).toBe(true)
    expect(call.studentIds).toEqual(['s1'])
    expect(call.draft).toMatchObject({ kind: 'lesson', chapterId: 'a0-01', lessonId: 'a0-01-l11', requiresPass: true, title: 'Finish lesson 1' })
  })

  it('refuses an empty title without calling the server', async () => {
    await renderSection()
    await userEvent.click(screen.getByTestId('new-assignment'))
    await userEvent.click(screen.getByTestId('save-draft'))
    expect(await screen.findByText('Give the homework a title')).toBeInTheDocument()
    expect(state.create).not.toHaveBeenCalled()
  })

  it('reviews a submission: shows the text, saves feedback and marks it reviewed', async () => {
    state.items = [submitted()]
    await renderSection('/tutor/students/s1/assignments?open=a1')
    expect(screen.getByTestId('assignment-row')).toHaveAttribute('data-status', 'submitted')
    expect(screen.getByTestId('submission-text')).toHaveTextContent('I visited my grandmother.')
    expect(screen.queryByTestId('edit-assignment')).not.toBeInTheDocument()
    await userEvent.type(screen.getByTestId('feedback-input'), 'Lovely sentences.')
    await userEvent.click(screen.getByTestId('mark-reviewed'))
    await waitFor(() => expect(state.review).toHaveBeenCalledWith({ assignmentId: 'a1', studentId: 's1', feedback: 'Lovely sentences.', status: 'reviewed' }))
  })

  it('cancels published homework only after confirmation', async () => {
    state.items = [submitted()]
    await renderSection('/tutor/students/s1/assignments?open=a1')
    await userEvent.click(screen.getByTestId('cancel-assignment'))
    expect(state.setStatus).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByTestId('confirm-cancel-assignment'))
    await waitFor(() => expect(state.setStatus).toHaveBeenCalledWith({ id: 'a1', status: 'cancelled', studentIds: ['s1'] }))
  })
})
