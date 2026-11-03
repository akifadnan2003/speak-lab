import { CheckCircle2, ChevronRight, Lock, PlayCircle } from 'lucide-react'
import { Link } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { DEMO_CHAPTERS, DEMO_LEVELS, type DemoChapter } from '@/demo/curriculum'
import { cn } from '@/lib/utils'

function chapterStatusBadge(chapter: DemoChapter) {
  switch (chapter.status) {
    case 'completed':
      return (
        <Badge variant="success">
          <CheckCircle2 aria-hidden /> Completed
        </Badge>
      )
    case 'in_progress':
      return (
        <Badge variant="primary">
          <PlayCircle aria-hidden /> In progress
        </Badge>
      )
    case 'available':
      return <Badge variant="info">Ready to start</Badge>
    default:
      return (
        <Badge variant="outline">
          <Lock aria-hidden /> Locked
        </Badge>
      )
  }
}

export function LearnPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Learn"
        title="Your curriculum"
        description="From foundations to advanced fluency. Your tutor can unlock or skip chapters to match your level."
        actions={<DemoNotice />}
      />

      <section className="flex flex-col gap-3">
        <SectionHeader title="Levels" description="Overall path from A0 to C1." />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
          {DEMO_LEVELS.map((level) => {
            const pct = Math.round((level.completedChapters / level.chapters) * 100)
            const current = pct > 0 && pct < 100
            return (
              <Card
                key={level.level}
                className={cn('w-44 shrink-0 sm:w-auto', current && 'border-primary/50 ring-1 ring-primary/30')}
              >
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{level.level}</span>
                    <span className="text-xs text-fg-muted tabular">
                      {level.completedChapters}/{level.chapters}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{level.name}</p>
                  <Progress value={pct} size="sm" indicatorClassName={pct === 100 ? 'bg-success' : undefined} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="A2 · Pre-intermediate" description="Chapters in your current level." />
        <ol className="flex flex-col gap-3">
          {DEMO_CHAPTERS.map((chapter) => {
            const locked = chapter.status === 'locked'
            const inner = (
              <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold',
                    chapter.status === 'completed' && 'bg-success-soft text-success-soft-fg',
                    chapter.status === 'in_progress' && 'bg-primary-soft text-primary-soft-fg',
                    chapter.status === 'available' && 'bg-info-soft text-info-soft-fg',
                    locked && 'bg-surface-2 text-fg-subtle',
                  )}
                >
                  {chapter.number}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold sm:text-base">{chapter.title}</h3>
                    {chapterStatusBadge(chapter)}
                  </div>
                  <p className="line-clamp-2 text-sm text-fg-muted">{chapter.description}</p>
                  {!locked ? (
                    <div className="flex items-center gap-3">
                      <Progress value={chapter.progress} size="sm" className="max-w-56" />
                      <span className="text-xs text-fg-muted tabular">
                        {chapter.lessons.filter((l) => l.status === 'completed').length}/{chapter.lessons.length} lessons
                      </span>
                    </div>
                  ) : null}
                </div>
                {!locked ? <ChevronRight className="size-5 shrink-0 text-fg-subtle" aria-hidden /> : null}
              </CardContent>
            )
            return (
              <li key={chapter.id}>
                {locked ? (
                  <Card className="opacity-70" aria-disabled="true">
                    {inner}
                  </Card>
                ) : (
                  <Link
                    to={`/learn/${chapter.id}`}
                    className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Card className="transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-sm">{inner}</Card>
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
