import { ArrowLeft, CheckCircle2, Circle, Lock, PenLine, PlayCircle, SkipForward } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useProgression } from '@/features/curriculum/CurriculumProvider'
import type { LessonStatus } from '@/features/curriculum/ports'
import { nextLesson } from '@/features/curriculum/progression'
import { LESSON_KIND_LABEL } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import { ChapterStatusBadge } from './ChapterStatusBadge'

function LessonStatusIcon({ status }: { status: LessonStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-5 text-success" aria-label="Completed" />
    case 'in_progress':
      return <PlayCircle className="size-5 text-primary" aria-label="In progress" />
    case 'skipped':
      return <SkipForward className="size-5 text-fg-muted" aria-label="Skipped" />
    case 'locked':
      return <Lock className="size-5 text-fg-subtle" aria-label="Locked" />
    default:
      return <Circle className="size-5 text-fg-subtle" aria-label="Available" />
  }
}

export function ChapterPage() {
  const { chapterId = '' } = useParams()
  const user = useCurrentUser()
  const { states, isLoading } = useProgression(user?.id ?? null)
  const state = states?.get(chapterId)

  if (!states && isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!state) {
    return (
      <EmptyState
        title="Chapter not found"
        description="This chapter does not exist or is not available to you."
        action={
          <Button asChild variant="outline">
            <Link to="/learn">Back to curriculum</Link>
          </Button>
        }
      />
    )
  }

  const { chapter } = state
  const next = nextLesson(state)
  const passMark = chapter.completion.passMark

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/learn">
          <ArrowLeft aria-hidden /> Curriculum
        </Link>
      </Button>
      <PageHeader
        eyebrow={`${chapter.level} · Chapter ${chapter.number}`}
        title={chapter.title}
        description={chapter.description}
        actions={
          next && state.status !== 'locked' ? (
            <Button asChild size="lg">
              <Link to={`/learn/${chapter.id}/lessons/${next.lesson.id}`}>
                <PlayCircle aria-hidden /> {state.progress > 0 ? 'Continue' : 'Start chapter'}
              </Link>
            </Button>
          ) : (
            <ChapterStatusBadge state={state} />
          )
        }
      />

      {state.status === 'locked' ? (
        <div className="flex gap-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-fg" role="status">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Complete {state.missingPrerequisites.map((id) => states?.get(id)?.chapter.title ?? id).join(', ')} first, or ask your tutor
            to unlock this chapter.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {chapter.status === 'planned' ? (
            <EmptyState
              icon={PenLine}
              title="This chapter is not written yet"
              description="Its objectives are fixed; lessons and exercises are still being authored. Your tutor will tell you when it opens."
            />
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Lessons</CardTitle>
                <span className="text-sm text-fg-muted tabular">{state.progress}% complete</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-3">
                <Progress value={state.progress} size="sm" />
                <ol className="mt-2 flex flex-col divide-y divide-line">
                  {state.lessons.map((lessonState, index) => {
                    const { lesson, status, bestScore } = lessonState
                    const locked = status === 'locked'
                    const row = (
                      <div className={cn('flex items-center gap-3 py-3', !locked && 'transition-colors group-hover:text-primary')}>
                        <LessonStatusIcon status={status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {index + 1}. {lesson.title}
                          </p>
                          <p className="text-xs text-fg-muted">
                            {LESSON_KIND_LABEL[lesson.kind]} · {lesson.estimatedMinutes} min
                            {lesson.kind === 'assessment' ? ` · pass mark ${passMark}%` : ''}
                          </p>
                        </div>
                        {typeof bestScore === 'number' && lesson.kind !== 'speaking' ? (
                          <Badge variant={bestScore >= passMark ? 'success' : 'warning'}>{bestScore}%</Badge>
                        ) : null}
                      </div>
                    )
                    return (
                      <li key={lesson.id} data-testid="lesson-row" data-status={status}>
                        {locked ? (
                          <div className="opacity-60">{row}</div>
                        ) : (
                          <Link
                            to={`/learn/${chapter.id}/lessons/${lesson.id}`}
                            className="group block rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {row}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning objectives</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="flex flex-col gap-2 text-sm">
                {chapter.objectives.map((objective) => (
                  <li key={objective} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>How to complete this chapter</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-fg-muted">
              <ul className="flex flex-col gap-1.5">
                <li>Finish every lesson.</li>
                {chapter.completion.requireSpeaking ? <li>Complete the speaking lessons (they cannot be skipped).</li> : null}
                {chapter.completion.requireAssessment ? <li>Score at least {passMark}% in the chapter check.</li> : null}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
