import { ArrowRight, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useStudentHomework } from '@/features/assignments/api'
import { countHomework, displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_VARIANT, sortHomework } from '@/features/assignments/model'
import { env } from '@/config/env'

/** Home-page summary of the learner's homework: what is open, overdue, or has new feedback. */
export function HomeworkCard({ studentId }: { studentId: string }) {
  const homework = useStudentHomework(studentId)
  const [now] = useState(() => new Date())
  const items = homework.data ? sortHomework(homework.data, now) : []
  const counts = countHomework(items, now)
  const shown = items.filter((i) => i.assignment.status !== 'cancelled').slice(0, 4)
  return (
    <Card data-testid="homework-card" data-open={counts.open} data-overdue={counts.overdue}>
      <CardHeader>
        <SectionHeader
          title="Homework"
          description={
            homework.data && items.length > 0
              ? `${counts.open} to do${counts.overdue > 0 ? ` (${counts.overdue} overdue)` : ''} · ${counts.awaitingReview} waiting for feedback · ${counts.reviewed} reviewed`
              : undefined
          }
          actions={
            <Link to="/homework" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              All homework <ArrowRight className="size-3" aria-hidden />
            </Link>
          }
        />
      </CardHeader>
      <CardContent className="pt-0">
        {homework.isPending && !env.uiPreview ? (
          <Skeleton className="h-16" />
        ) : shown.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-sm text-fg-muted">
            <ClipboardList className="size-4" aria-hidden /> {env.uiPreview ? 'Homework from your tutor appears here (needs the real backend).' : 'No homework from your tutor yet.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {shown.map(({ assignment, submission }) => {
              const status = displayStatus(assignment, submission, now)
              return (
                <li key={assignment.id} className="py-2 first:pt-0 last:pb-0">
                  <Link to={`/homework/${assignment.id}`} className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" data-testid="homework-card-item" data-status={status}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{assignment.title}</span>
                      <span className="block text-xs text-fg-muted">
                        {assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'No due date'}
                        {status === 'reviewed' && submission.feedback ? ' · feedback from your tutor' : ''}
                      </span>
                    </span>
                    <Badge variant={DISPLAY_STATUS_VARIANT[status]}>{DISPLAY_STATUS_LABEL[status]}</Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
