import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useProgression } from '@/features/curriculum/CurriculumProvider'
import { currentChapter } from '@/features/curriculum/progression'
import { CEFR_LEVELS, LEVEL_NAMES, type CefrLevel } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import { ChapterStatusBadge } from './ChapterStatusBadge'

export function LearnPage() {
  const user = useCurrentUser()
  const { states, isLoading } = useProgression(user?.id ?? null)
  // null = follow the learner's current level until they pick one explicitly.
  const [level, setLevel] = useState<CefrLevel | null>(null)

  const current = states ? currentChapter(states) : undefined
  const activeLevel: CefrLevel = level ?? current?.chapter.level ?? 'A0'

  const all = states ? [...states.values()] : []
  const levelSummaries = CEFR_LEVELS.map((lvl) => {
    const chapters = all.filter((s) => s.chapter.level === lvl)
    const done = chapters.filter((s) => s.status === 'completed' || s.status === 'skipped').length
    return { level: lvl, name: LEVEL_NAMES[lvl], chapters: chapters.length, completed: done }
  })
  const visible = all.filter((s) => s.chapter.level === activeLevel)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Learn"
        title="Your curriculum"
        description="From foundations to advanced fluency. Your tutor can unlock or skip chapters to match your level."
      />

      <section className="flex flex-col gap-3">
        <SectionHeader title="Levels" description="Overall path from A0 to C1. Choose a level to see its chapters." />
        <div
          role="group"
          aria-label="Levels"
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6"
        >
          {levelSummaries.map((summary) => {
            const pct = summary.chapters === 0 ? 0 : Math.round((summary.completed / summary.chapters) * 100)
            const selected = summary.level === activeLevel
            const isCurrent = current?.chapter.level === summary.level
            return (
              <button
                key={summary.level}
                type="button"
                aria-pressed={selected}
                aria-label={`${summary.level} ${summary.name}, ${summary.completed} of ${summary.chapters} chapters done`}
                onClick={() => setLevel(summary.level)}
                className={cn(
                  'w-40 shrink-0 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto',
                )}
              >
                <Card
                  className={cn(
                    'h-full transition-[box-shadow,border-color] hover:border-line-strong',
                    selected && 'border-primary ring-1 ring-primary/40',
                    isCurrent && !selected && 'border-primary/40',
                  )}
                >
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">{summary.level}</span>
                      <span className="text-xs text-fg-muted tabular">
                        {summary.completed}/{summary.chapters}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{summary.name}</p>
                    <Progress value={pct} size="sm" indicatorClassName={pct === 100 ? 'bg-success' : undefined} />
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-live="polite">
        <SectionHeader
          title={`${activeLevel} · ${LEVEL_NAMES[activeLevel]}`}
          description={current?.chapter.level === activeLevel ? 'Chapters in your current level.' : 'Chapters in this level.'}
        />
        {isLoading && !states ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="No chapters" description="This level has no chapters yet." />
        ) : (
          <ol className="flex flex-col gap-3">
            {visible.map((state) => {
              const { chapter } = state
              const openable = chapter.status === 'authored' && state.status !== 'locked'
              const inner = (
                <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                  <span
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular',
                      state.status === 'completed' && 'bg-success-soft text-success-soft-fg',
                      state.status === 'in_progress' && 'bg-primary-soft text-primary-soft-fg',
                      state.status === 'available' && chapter.status === 'authored' && 'bg-info-soft text-info-soft-fg',
                      (state.status === 'locked' || state.status === 'skipped' || chapter.status === 'planned') &&
                        'bg-surface-2 text-fg-subtle',
                    )}
                  >
                    {chapter.number}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold sm:text-base">{chapter.title}</h3>
                      <ChapterStatusBadge state={state} />
                    </div>
                    <p className="line-clamp-2 text-sm text-fg-muted">{chapter.description}</p>
                    {chapter.status === 'authored' && state.status !== 'locked' ? (
                      <div className="flex items-center gap-3">
                        <Progress value={state.progress} size="sm" className="max-w-56" />
                        <span className="text-xs text-fg-muted tabular">
                          {state.lessons.filter((l) => l.status === 'completed').length}/{state.lessons.length} lessons
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {openable ? <ChevronRight className="size-5 shrink-0 text-fg-subtle" aria-hidden /> : null}
                </CardContent>
              )
              return (
                <li key={chapter.id} data-testid="chapter-card" data-status={state.status}>
                  {openable ? (
                    <Link
                      to={`/learn/${chapter.id}`}
                      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Card className="transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-sm">{inner}</Card>
                    </Link>
                  ) : (
                    <Card className="opacity-75" aria-disabled="true">
                      {inner}
                    </Card>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
