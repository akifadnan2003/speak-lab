import type { AssignmentKind, AssignmentRecipientRow, AssignmentRow, AssignmentStatus, SubmissionStatus } from '@/lib/supabase/database.types'

/**
 * Pure view model for homework. The stored lifecycle is server-enforced (see the migration and
 * docs/ASSIGNMENTS.md); this module only derives what to display from stored rows.
 */

export interface Assignment {
  readonly id: string
  readonly tutorId: string
  readonly kind: AssignmentKind
  readonly title: string
  readonly instructions: string
  readonly chapterId: string | null
  readonly lessonId: string | null
  readonly requiresPass: boolean
  readonly reviewTarget: number | null
  readonly dueAt: string | null
  readonly status: AssignmentStatus
  readonly publishedAt: string | null
  readonly cancelledAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface Submission {
  readonly assignmentId: string
  readonly studentId: string
  readonly status: SubmissionStatus
  readonly draftText: string
  readonly submittedText: string | null
  readonly evidence: CompletionEvidence | null
  readonly startedAt: string | null
  readonly submittedAt: string | null
  readonly reviewedAt: string | null
  readonly returnedAt: string | null
  readonly late: boolean
  readonly feedback: string | null
  readonly feedbackUpdatedAt: string | null
}

export type CompletionEvidence =
  | { readonly type: 'lesson_completed'; readonly best_score: number | null; readonly at: string }
  | { readonly type: 'chapter_check_passed'; readonly score: number; readonly pass_mark: number; readonly at: string }
  | { readonly type: 'vocabulary_reviews'; readonly count: number; readonly target: number; readonly since: string }

/** One assignment together with one student's submission row: what both screens render. */
export interface HomeworkItem {
  readonly assignment: Assignment
  readonly submission: Submission
}

/**
 * What the learner (or tutor) sees. `overdue` is derived: published, due date passed, not
 * submitted or reviewed. `cancelled` wins over everything.
 */
export type HomeworkDisplayStatus = 'pending' | 'in_progress' | 'overdue' | 'submitted' | 'reviewed' | 'cancelled' | 'draft'

export function fromAssignmentRow(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    kind: row.kind,
    title: row.title,
    instructions: row.instructions,
    chapterId: row.chapter_id,
    lessonId: row.lesson_id,
    requiresPass: row.requires_pass,
    reviewTarget: row.review_target,
    dueAt: row.due_at,
    status: row.status,
    publishedAt: row.published_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function fromRecipientRow(row: AssignmentRecipientRow): Submission {
  return {
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    status: row.status,
    draftText: row.draft_text,
    submittedText: row.submitted_text,
    evidence: (row.evidence as CompletionEvidence | null) ?? null,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    returnedAt: row.returned_at,
    late: row.late,
    feedback: row.feedback,
    feedbackUpdatedAt: row.feedback_updated_at,
  }
}

export function isOverdue(assignment: Pick<Assignment, 'dueAt' | 'status'>, submission: Pick<Submission, 'status'>, now: Date): boolean {
  return (
    assignment.status === 'published' &&
    assignment.dueAt !== null &&
    new Date(assignment.dueAt).getTime() < now.getTime() &&
    (submission.status === 'assigned' || submission.status === 'in_progress')
  )
}

export function displayStatus(assignment: Pick<Assignment, 'dueAt' | 'status'>, submission: Pick<Submission, 'status'>, now: Date): HomeworkDisplayStatus {
  if (assignment.status === 'cancelled') return 'cancelled'
  if (assignment.status === 'draft') return 'draft'
  if (submission.status === 'reviewed') return 'reviewed'
  if (submission.status === 'submitted') return 'submitted'
  if (isOverdue(assignment, submission, now)) return 'overdue'
  return submission.status === 'in_progress' ? 'in_progress' : 'pending'
}

export const DISPLAY_STATUS_LABEL: Record<HomeworkDisplayStatus, string> = {
  pending: 'To do',
  in_progress: 'In progress',
  overdue: 'Overdue',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  cancelled: 'Cancelled',
  draft: 'Draft',
}

export const DISPLAY_STATUS_VARIANT: Record<HomeworkDisplayStatus, 'neutral' | 'info' | 'danger' | 'warning' | 'success' | 'outline'> = {
  pending: 'neutral',
  in_progress: 'info',
  overdue: 'danger',
  submitted: 'warning',
  reviewed: 'success',
  cancelled: 'outline',
  draft: 'outline',
}

export const KIND_LABEL: Record<AssignmentKind, string> = {
  lesson: 'Lesson',
  vocabulary: 'Vocabulary review',
  written: 'Written answer',
}

/** Open homework first (overdue, then soonest due), then submitted, reviewed, cancelled. */
export function sortHomework(items: readonly HomeworkItem[], now: Date): HomeworkItem[] {
  const rank: Record<HomeworkDisplayStatus, number> = { overdue: 0, in_progress: 1, pending: 1, submitted: 2, reviewed: 3, draft: 4, cancelled: 5 }
  return [...items].sort((a, b) => {
    const ra = rank[displayStatus(a.assignment, a.submission, now)]
    const rb = rank[displayStatus(b.assignment, b.submission, now)]
    if (ra !== rb) return ra - rb
    const da = a.assignment.dueAt ?? '9999'
    const db = b.assignment.dueAt ?? '9999'
    if (da !== db) return da.localeCompare(db)
    return b.assignment.createdAt.localeCompare(a.assignment.createdAt)
  })
}

export interface HomeworkCounts {
  readonly open: number
  readonly overdue: number
  readonly awaitingReview: number
  readonly reviewed: number
}

export function countHomework(items: readonly HomeworkItem[], now: Date): HomeworkCounts {
  const counts = { open: 0, overdue: 0, awaitingReview: 0, reviewed: 0 }
  for (const item of items) {
    const status = displayStatus(item.assignment, item.submission, now)
    if (status === 'pending' || status === 'in_progress') counts.open++
    else if (status === 'overdue') {
      counts.open++
      counts.overdue++
    } else if (status === 'submitted') counts.awaitingReview++
    else if (status === 'reviewed') counts.reviewed++
  }
  return counts
}

/** Human description of what a lesson/vocabulary assignment asks for. */
export function describeTarget(assignment: Assignment, lessonTitle?: string): string {
  switch (assignment.kind) {
    case 'lesson':
      return assignment.requiresPass ? `Pass the chapter check${lessonTitle ? `: ${lessonTitle}` : ''}` : `Complete the lesson${lessonTitle ? `: ${lessonTitle}` : ''}`
    case 'vocabulary':
      return `Answer ${assignment.reviewTarget} vocabulary ${assignment.reviewTarget === 1 ? 'review' : 'reviews'}`
    case 'written':
      return 'Write your answer in the app'
  }
}

export function describeEvidence(evidence: CompletionEvidence): string {
  switch (evidence.type) {
    case 'lesson_completed':
      return `Lesson completed${evidence.best_score !== null ? ` with a best score of ${evidence.best_score}%` : ''} (practice, self-reported)`
    case 'chapter_check_passed':
      return `Chapter check passed: ${evidence.score}% (pass mark ${evidence.pass_mark}%, graded by the server)`
    case 'vocabulary_reviews':
      return `${evidence.count} vocabulary reviews recorded (target ${evidence.target})`
  }
}
