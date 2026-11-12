import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useStudentHomework } from '@/features/assignments/api'
import { countHomework, displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_VARIANT, KIND_LABEL, sortHomework } from '@/features/assignments/model'
import { env } from '@/config/env'
import { formatRelative } from '@/lib/utils'

/** Every assignment the tutor gave the signed-in student, open work first. */
export function HomeworkPage() {
  const user = useCurrentUser()
  const homework = useStudentHomework(user?.id ?? null)
  const [now] = useState(() => new Date())
  const items = homework.data ? sortHomework(homework.data, now) : []
  const counts = countHomework(items, now)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Homework"
        title="Your homework"
        description={items.length > 0 ? `${counts.open} to do${counts.overdue > 0 ? ` (${counts.overdue} overdue)` : ''} · ${counts.awaitingReview} waiting for feedback · ${counts.reviewed} reviewed` : 'Tasks your tutor sets for you, with their feedback.'}
      />
      {homework.isError ? (
        <EmptyState title="Homework could not be loaded" description={homework.error instanceof Error ? homework.error.message : 'Try again.'} />
      ) : homework.isPending && !env.uiPreview ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No homework yet" description={env.uiPreview ? 'Homework needs the real backend; nothing is simulated in preview mode.' : 'When your tutor assigns something, it appears here and on your home page.'} data-testid="homework-empty" />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Homework">
          {items.map(({ assignment, submission }) => {
            const status = displayStatus(assignment, submission, now)
            return (
              <li key={assignment.id}>
                <Link
                  to={`/homework/${assignment.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  data-testid="homework-item"
                  data-status={status}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{assignment.title}</span>
                    <span className="block text-xs text-fg-muted">
                      {KIND_LABEL[assignment.kind]}
                      {assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      {submission.feedbackUpdatedAt ? ` · feedback ${formatRelative(submission.feedbackUpdatedAt)}` : ''}
                    </span>
                  </span>
                  <Badge variant={DISPLAY_STATUS_VARIANT[status]}>{DISPLAY_STATUS_LABEL[status]}</Badge>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
