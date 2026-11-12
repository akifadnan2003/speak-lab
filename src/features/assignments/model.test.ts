import { describe, expect, it } from 'vitest'
import { countHomework, describeEvidence, describeTarget, displayStatus, isOverdue, sortHomework, type Assignment, type HomeworkItem, type Submission } from './model'

const NOW = new Date('2026-11-12T12:00:00.000Z')

function assignment(over: Partial<Assignment> = {}): Assignment {
  return {
    id: over.id ?? 'a1',
    tutorId: 't',
    kind: 'written',
    title: 'Write about your weekend',
    instructions: '',
    chapterId: null,
    lessonId: null,
    requiresPass: false,
    reviewTarget: null,
    dueAt: null,
    status: 'published',
    publishedAt: '2026-11-10T00:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...over,
  }
}

function submission(over: Partial<Submission> = {}): Submission {
  return {
    assignmentId: 'a1',
    studentId: 's',
    status: 'assigned',
    draftText: '',
    submittedText: null,
    evidence: null,
    startedAt: null,
    submittedAt: null,
    reviewedAt: null,
    returnedAt: null,
    late: false,
    feedback: null,
    feedbackUpdatedAt: null,
    ...over,
  }
}

describe('display status', () => {
  it('derives overdue only for open work past its due date on a published assignment', () => {
    const due = assignment({ dueAt: '2026-11-11T00:00:00.000Z' })
    expect(displayStatus(due, submission(), NOW)).toBe('overdue')
    expect(displayStatus(due, submission({ status: 'in_progress' }), NOW)).toBe('overdue')
    expect(displayStatus(due, submission({ status: 'submitted' }), NOW)).toBe('submitted')
    expect(displayStatus(assignment({ dueAt: '2026-11-13T00:00:00.000Z' }), submission(), NOW)).toBe('pending')
    expect(displayStatus(assignment({ dueAt: '2026-11-11T00:00:00.000Z', status: 'cancelled' }), submission(), NOW)).toBe('cancelled')
    expect(displayStatus(assignment({ dueAt: '2026-11-11T00:00:00.000Z', status: 'draft' }), submission(), NOW)).toBe('draft')
    expect(isOverdue(assignment(), submission(), NOW)).toBe(false)
  })

  it('maps the stored submission status otherwise', () => {
    expect(displayStatus(assignment(), submission({ status: 'in_progress' }), NOW)).toBe('in_progress')
    expect(displayStatus(assignment(), submission({ status: 'reviewed' }), NOW)).toBe('reviewed')
  })
})

describe('sorting and counting', () => {
  const items: HomeworkItem[] = [
    { assignment: assignment({ id: 'reviewed' }), submission: submission({ status: 'reviewed' }) },
    { assignment: assignment({ id: 'later', dueAt: '2026-11-20T00:00:00.000Z' }), submission: submission() },
    { assignment: assignment({ id: 'overdue', dueAt: '2026-11-01T00:00:00.000Z' }), submission: submission() },
    { assignment: assignment({ id: 'soon', dueAt: '2026-11-13T00:00:00.000Z' }), submission: submission({ status: 'in_progress' }) },
    { assignment: assignment({ id: 'submitted' }), submission: submission({ status: 'submitted' }) },
    { assignment: assignment({ id: 'cancelled', status: 'cancelled' }), submission: submission() },
  ]

  it('puts overdue first, then open by due date, then submitted, reviewed, cancelled', () => {
    expect(sortHomework(items, NOW).map((i) => i.assignment.id)).toEqual(['overdue', 'soon', 'later', 'submitted', 'reviewed', 'cancelled'])
  })

  it('counts open, overdue, awaiting review and reviewed without double counting', () => {
    expect(countHomework(items, NOW)).toEqual({ open: 3, overdue: 1, awaitingReview: 1, reviewed: 1 })
  })
})

describe('descriptions', () => {
  it('describes targets and evidence honestly', () => {
    expect(describeTarget(assignment({ kind: 'lesson', chapterId: 'a0-01', lessonId: 'a0-01-l01' }), 'Who + what')).toBe('Complete the lesson: Who + what')
    expect(describeTarget(assignment({ kind: 'lesson', chapterId: 'a0-01', lessonId: 'a0-01-l11', requiresPass: true }))).toBe('Pass the chapter check')
    expect(describeTarget(assignment({ kind: 'vocabulary', reviewTarget: 1 }))).toBe('Answer 1 vocabulary review')
    expect(describeEvidence({ type: 'lesson_completed', best_score: 90, at: '2026-11-11T00:00:00.000Z' })).toContain('self-reported')
    expect(describeEvidence({ type: 'chapter_check_passed', score: 85, pass_mark: 80, at: '2026-11-11T00:00:00.000Z' })).toContain('graded by the server')
    expect(describeEvidence({ type: 'vocabulary_reviews', count: 20, target: 20, since: '2026-11-11T00:00:00.000Z' })).toBe('20 vocabulary reviews recorded (target 20)')
  })
})
