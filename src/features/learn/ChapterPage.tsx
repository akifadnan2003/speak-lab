import { ArrowLeft, CheckCircle2, Circle, Lock, PlayCircle, SkipForward } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { findChapter, LESSON_KIND_LABEL, type DemoLesson } from '@/demo/curriculum'
import { cn } from '@/lib/utils'

function LessonStatusIcon({ status }: { status: DemoLesson['status'] }) {
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
  const chapter = findChapter(chapterId)

  if (!chapter) {
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

  const nextLesson = chapter.lessons.find((l) => l.status === 'in_progress' || l.status === 'available')

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
          nextLesson ? (
            <Button asChild size="lg">
              <Link to={`/learn/${chapter.id}/lessons/${nextLesson.id}`}>
                <PlayCircle aria-hidden /> {chapter.progress > 0 ? 'Continue' : 'Start chapter'}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Lessons</CardTitle>
              <span className="text-sm text-fg-muted tabular">{chapter.progress}% complete</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-3">
              <Progress value={chapter.progress} size="sm" />
              <ol className="mt-2 flex flex-col divide-y divide-line">
                {chapter.lessons.map((lesson, index) => {
                  const locked = lesson.status === 'locked'
                  const row = (
                    <div
                      className={cn(
                        'flex items-center gap-3 py-3',
                        !locked && 'transition-colors group-hover:text-primary',
                      )}
                    >
                      <LessonStatusIcon status={lesson.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {index + 1}. {lesson.title}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {LESSON_KIND_LABEL[lesson.kind]} · {lesson.estimatedMinutes} min
                        </p>
                      </div>
                      {typeof lesson.score === 'number' ? (
                        <Badge variant={lesson.score >= 80 ? 'success' : 'warning'}>{lesson.score}%</Badge>
                      ) : null}
                    </div>
                  )
                  return (
                    <li key={lesson.id}>
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
          <DemoNotice>Demo chapter. The real content engine arrives in M3.</DemoNotice>
        </div>
      </div>
    </div>
  )
}
