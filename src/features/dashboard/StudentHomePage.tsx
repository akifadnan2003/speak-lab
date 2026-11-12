import { ArrowRight, Flame, Layers, Mic, Play } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { ProgressRing } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { currentChapter, nextLesson } from '@/features/curriculum/progression'
import { LESSON_KIND_LABEL, LEVEL_NAMES } from '@/features/curriculum/schema'
import { AchievementsCard } from '@/features/progress/AchievementsCard'
import { WeakTopicsCard } from '@/features/progress/PracticeCards'
import { TimelineCard } from '@/features/progress/TimelineCard'
import { useLearningAnalytics } from '@/features/progress/useLearningAnalytics'
import { WeeklyActivityChart } from '@/features/progress/WeeklyActivityChart'
import { greetingFor } from '@/lib/utils'

/**
 * Student home: everything on it is derived from the learner's own stored records
 * (docs/PROGRESS_METRICS.md). Speaking practice links to the coach screens, which still show
 * labelled sample content until M7.
 */
export function StudentHomePage() {
  const user = useCurrentUser()
  const { analytics, records, isLoading, error } = useLearningAnalytics(user?.id ?? null)
  const firstName = user?.fullName.split(' ')[0] ?? 'there'

  const chapterState = records ? currentChapter(records.progression) : undefined
  const lessonState = chapterState ? nextLesson(chapterState) : undefined
  const next = chapterState && lessonState ? { chapter: chapterState.chapter, lesson: lessonState.lesson, started: lessonState.status === 'in_progress' } : undefined
  const overview = analytics?.overview

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-fg-muted">{greetingFor()},</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{firstName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="home-badges">
            {overview?.level ? (
              <Badge variant="primary">
                {overview.level} · {LEVEL_NAMES[overview.level]}
                {overview.levelSource === 'placed' ? ' · placed' : ''}
              </Badge>
            ) : null}
            {overview && overview.streakDays > 0 ? (
              <Badge variant="warning">
                <Flame aria-hidden /> {overview.streakDays}-day streak
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Continue learning */}
      <Card className="overflow-hidden border-brand-200/60 bg-gradient-to-br from-brand-50 to-surface dark:border-brand-800/60 dark:from-brand-950/60 dark:to-surface" data-testid="continue-card">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">{next?.started ? 'Continue where you left off' : "Today's lesson"}</p>
            {next ? (
              <>
                <h2 className="truncate text-lg font-semibold sm:text-xl">{next.lesson.title}</h2>
                <p className="text-sm text-fg-muted">
                  {next.chapter.level} · Chapter {next.chapter.number} · {next.chapter.title} · {LESSON_KIND_LABEL[next.lesson.kind]} · {next.lesson.estimatedMinutes} min
                </p>
              </>
            ) : records ? (
              <>
                <h2 className="text-lg font-semibold sm:text-xl">Every available chapter is done</h2>
                <p className="text-sm text-fg-muted">New chapters are on the way. Keep your vocabulary fresh in the meantime.</p>
              </>
            ) : (
              <Skeleton className="h-7 w-64" />
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {next ? (
              <Button asChild size="lg">
                <Link to={`/learn/${next.chapter.id}/lessons/${next.lesson.id}`}>
                  <Play aria-hidden /> {next.started ? 'Continue learning' : 'Start lesson'}
                </Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="soft">
              <Link to="/speak">
                <Mic aria-hidden /> Talk with the coach
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-danger">Your progress could not be loaded. {error instanceof Error ? error.message : ''}</p>
          </CardContent>
        </Card>
      ) : isLoading || !analytics || !overview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="home-loading">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="home-metrics">
            <Card>
              <CardContent className="flex items-center gap-4">
                <ProgressRing value={chapterState?.progress ?? (overview.chaptersAvailable > 0 && overview.chaptersCompleted === overview.chaptersAvailable ? 100 : 0)} size={68} label="Current chapter progress">
                  <span className="text-sm font-semibold tabular">{chapterState?.progress ?? 0}%</span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{chapterState ? `Chapter ${chapterState.chapter.number}` : 'Chapters'}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {chapterState ? chapterState.chapter.title : `${overview.chaptersCompleted} of ${overview.chaptersAvailable} available completed`}
                  </p>
                  <Link to="/learn" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    View curriculum <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4">
                <span className="flex size-[68px] shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-soft-fg">
                  <Flame className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{overview.streakDays > 0 ? `${overview.streakDays}-day streak` : 'No streak yet'}</p>
                  <p className="text-xs text-fg-muted tabular">
                    {overview.lessonsCompleted} {overview.lessonsCompleted === 1 ? 'lesson' : 'lessons'} completed · {overview.activeDaysTotal} active {overview.activeDaysTotal === 1 ? 'day' : 'days'}
                  </p>
                  <Link to="/progress" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    See your record <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4">
                <span className="flex size-[68px] shrink-0 items-center justify-center rounded-full bg-info-soft text-info-soft-fg">
                  <Layers className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Vocabulary</p>
                  <p className="text-xs text-fg-muted tabular" data-testid="home-vocab">
                    {overview.vocabularyDue > 0 ? `${overview.vocabularyDue} ${overview.vocabularyDue === 1 ? 'word' : 'words'} due now` : `${overview.vocabularyLearned} learned · nothing due`}
                  </p>
                  <Link to="/vocabulary" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {overview.vocabularyDue > 0 ? 'Start review' : 'Learn words'} <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <SectionHeader title="This week" description="Lessons, exercises, vocabulary reviews and chapter checks per day." />
                </CardHeader>
                <CardContent className="pt-0">
                  <WeeklyActivityChart weekly={analytics.weekly} />
                </CardContent>
              </Card>
              <TimelineCard events={analytics.timeline} limit={5} title="Recent activity" />
            </div>
            <div className="flex flex-col gap-6">
              <WeakTopicsCard insights={analytics.insights} compact />
              <AchievementsCard achievements={analytics.achievements} compact />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
