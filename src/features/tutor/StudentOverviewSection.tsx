import { ArrowRight, BookOpen, ClipboardList, Layers, StickyNote, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { countHomework, displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_VARIANT, sortHomework } from '@/features/assignments/model'
import { useStudentAssignments } from '@/features/assignments/api'
import { currentChapter, nextLesson } from '@/features/curriculum/progression'
import { levelLabel } from '@/features/progress/labels'
import { OverviewStats } from '@/features/progress/OverviewStats'
import { WeakTopicsCard } from '@/features/progress/PracticeCards'
import { TimelineCard } from '@/features/progress/TimelineCard'
import { useLearningAnalytics } from '@/features/progress/useLearningAnalytics'
import { formatRelative } from '@/lib/utils'
import { ACCOUNT_STATUS_LABEL, type StudentAccount } from './api'

/**
 * Tutor overview of one linked student: M5 analytics (same numbers the student sees), homework
 * at a glance, and quick links to the other tabs. Nothing here is estimated; an inactive
 * student gets an honest empty state.
 */
export function StudentOverviewSection({ account }: { account: StudentAccount }) {
  const { analytics, records, isLoading, error } = useLearningAnalytics(account.id)
  const homework = useStudentAssignments(account.id)
  const [now] = useState(() => new Date())
  const chapter = records ? currentChapter(records.progression) : undefined
  const lesson = chapter ? nextLesson(chapter) : undefined
  const items = homework.data ? sortHomework(homework.data, now) : []
  const counts = countHomework(items, now)
  const awaiting = items.filter((i) => displayStatus(i.assignment, i.submission, now) === 'submitted')
  const base = `/tutor/students/${account.id}`

  return (
    <div className="flex flex-col gap-6" data-testid="student-overview">
      {error ? (
        <EmptyState compact title="Progress could not be loaded" description={error instanceof Error ? error.message : 'Try again.'} />
      ) : isLoading || !analytics ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium" data-testid="overview-level">
                {levelLabel(analytics.overview).replace('your tutor', 'you')}
              </p>
              <p className="text-sm text-fg-muted" data-testid="overview-chapter">
                {chapter
                  ? `Working on ${chapter.chapter.level} · Chapter ${chapter.chapter.number} · ${chapter.chapter.title} (${chapter.progress}% of lessons)${lesson ? ` · next: ${lesson.lesson.title}` : ''}`
                  : 'No written chapter is open (the next ones are planned or locked).'}
              </p>
            </div>
            <QuickLinks base={base} />
          </div>
          <OverviewStats overview={analytics.overview} possessive="their" />
          {analytics.overview.isEmpty ? (
            <EmptyState compact title="No learning activity yet" description="The student has not completed a lesson, submitted a chapter check or reviewed vocabulary. Everything above fills in as soon as they do." />
          ) : null}
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card data-testid="overview-homework">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Homework</CardTitle>
            <Link to={`${base}/assignments`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Manage <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0">
            {homework.isPending ? (
              <Skeleton className="h-16" />
            ) : items.length === 0 ? (
              <p className="text-sm text-fg-muted">Nothing assigned yet.</p>
            ) : (
              <>
                <p className="text-sm text-fg-muted tabular">
                  {counts.open} open{counts.overdue > 0 ? ` (${counts.overdue} overdue)` : ''} · {counts.awaitingReview} awaiting review · {counts.reviewed} reviewed
                </p>
                <ul className="flex flex-col divide-y divide-line">
                  {items.slice(0, 4).map(({ assignment, submission }) => {
                    const status = displayStatus(assignment, submission, now)
                    return (
                      <li key={assignment.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                        <span className="min-w-0 flex-1">
                          <Link to={`${base}/assignments?open=${assignment.id}`} className="block truncate text-sm font-medium hover:underline">
                            {assignment.title}
                          </Link>
                          <span className="block text-xs text-fg-muted">
                            {assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'No due date'}
                            {submission.submittedAt ? ` · submitted ${formatRelative(submission.submittedAt)}` : ''}
                          </span>
                        </span>
                        <Badge variant={DISPLAY_STATUS_VARIANT[status]}>{DISPLAY_STATUS_LABEL[status]}</Badge>
                      </li>
                    )
                  })}
                </ul>
                {awaiting.length > 0 ? (
                  <p className="text-xs text-warning-soft-fg">
                    {awaiting.length} {awaiting.length === 1 ? 'submission is' : 'submissions are'} waiting for your feedback.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {analytics ? <WeakTopicsCard insights={analytics.insights} compact /> : null}
        {analytics ? <TimelineCard events={analytics.timeline} limit={5} title="Recent activity" /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">Email</dt>
              <dd className="break-all">{account.email}</dd>
              <dt className="text-fg-muted">Status</dt>
              <dd>{ACCOUNT_STATUS_LABEL[account.status]}</dd>
              <dt className="text-fg-muted">Onboarding</dt>
              <dd>{account.onboardingCompletedAt ? `Completed ${formatRelative(account.onboardingCompletedAt)}` : 'Not completed yet'}</dd>
              <dt className="text-fg-muted">Support language</dt>
              <dd>{account.supportLanguage === 'az' ? 'Azerbaijani' : 'None'}</dd>
              <dt className="text-fg-muted">Linked</dt>
              <dd>{new Date(account.linkedAt).toLocaleString()}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickLinks({ base }: { base: string }) {
  const links = [
    { to: `${base}/assignments`, label: 'Assignments', icon: ClipboardList },
    { to: `${base}/vocabulary`, label: 'Vocabulary', icon: Layers },
    { to: `${base}/progress`, label: 'Progress', icon: Trophy },
    { to: `${base}/curriculum`, label: 'Curriculum', icon: BookOpen },
    { to: `${base}/notes`, label: 'Notes', icon: StickyNote },
  ]
  return (
    <nav aria-label="Student sections" className="flex flex-wrap gap-2">
      {links.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon className="size-3.5" aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  )
}
