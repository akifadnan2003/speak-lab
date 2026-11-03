import { ArrowRight, Award, Flame, Layers, Mic, Play, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Progress, ProgressRing } from '@/components/ui/progress'
import { findLesson, LESSON_KIND_LABEL } from '@/demo/curriculum'
import {
  DEMO_ACHIEVEMENTS,
  DEMO_ASSIGNMENTS,
  DEMO_RECENT_ACTIVITY,
  DEMO_STUDENT_SNAPSHOT,
  DEMO_WEAK_TOPICS,
  DEMO_WEEKLY_ACTIVITY,
} from '@/demo/student-home'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { ActivityList } from '@/features/progress/ActivityList'
import { WeeklyActivityChart } from '@/features/progress/WeeklyActivityChart'
import { formatRelative, greetingFor } from '@/lib/utils'

export function StudentHomePage() {
  const user = useCurrentUser()
  const snapshot = DEMO_STUDENT_SNAPSHOT
  const next = findLesson(snapshot.currentChapterId, snapshot.currentLessonId)
  const firstName = user?.fullName.split(' ')[0] ?? 'there'
  const pending = DEMO_ASSIGNMENTS.filter((a) => a.status === 'pending')
  const speakingPct = Math.round((snapshot.speakingMinutesToday / snapshot.dailySpeakingTargetMinutes) * 100)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-fg-muted">{greetingFor()},</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{firstName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">{snapshot.levelLabel}</Badge>
            <Badge variant="warning">
              <Flame aria-hidden /> {snapshot.streakDays}-day streak
            </Badge>
          </div>
        </div>
        <DemoNotice>Sample content. Real lessons, streaks and progress arrive from M3.</DemoNotice>
      </div>

      {/* Continue learning */}
      <Card className="overflow-hidden border-brand-200/60 bg-gradient-to-br from-brand-50 to-surface dark:border-brand-800/60 dark:from-brand-950/60 dark:to-surface">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Today&apos;s recommended lesson</p>
            {next ? (
              <>
                <h2 className="truncate text-lg font-semibold sm:text-xl">{next.lesson.title}</h2>
                <p className="text-sm text-fg-muted">
                  {next.chapter.level} · Chapter {next.chapter.number} · {next.chapter.title} ·{' '}
                  {LESSON_KIND_LABEL[next.lesson.kind]} · {next.lesson.estimatedMinutes} min
                </p>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {next ? (
              <Button asChild size="lg">
                <Link to={`/learn/${next.chapter.id}/lessons/${next.lesson.id}`}>
                  <Play aria-hidden /> Continue learning
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

      {/* Metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4">
            <ProgressRing value={snapshot.courseProgress} size={68} label="Course progress">
              <span className="text-sm font-semibold tabular">{snapshot.courseProgress}%</span>
            </ProgressRing>
            <div>
              <p className="text-sm font-semibold">Course progress</p>
              <p className="text-xs text-fg-muted">{snapshot.levelLabel}</p>
              <Link to="/learn" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View curriculum <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <ProgressRing value={speakingPct} size={68} label="Daily speaking target">
              <Target className="size-5 text-primary" aria-hidden />
            </ProgressRing>
            <div>
              <p className="text-sm font-semibold">Daily speaking target</p>
              <p className="text-xs text-fg-muted tabular">
                {snapshot.speakingMinutesToday} of {snapshot.dailySpeakingTargetMinutes} min today
              </p>
              <Link to="/speak" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Practise now <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <span className="flex size-[68px] shrink-0 items-center justify-center rounded-full bg-info-soft text-info-soft-fg">
              <Layers className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">Vocabulary due</p>
              <p className="text-xs text-fg-muted tabular">{snapshot.vocabularyDue} words to review</p>
              <Link to="/vocabulary" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Start review <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <SectionHeader title="Weekly activity" description="Minutes of practice per day. Speaking shown in solid blue." />
            </CardHeader>
            <CardContent className="pt-0">
              <WeeklyActivityChart data={DEMO_WEEKLY_ACTIVITY} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeader
                title="Recent activity"
                actions={
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/progress">View all</Link>
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="pt-0">
              <ActivityList items={DEMO_RECENT_ACTIVITY} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending assignments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {pending.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium">{assignment.title}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    Due {new Date(assignment.dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weak grammar topics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-0">
              {DEMO_WEAK_TOPICS.map((topic) => (
                <div key={topic.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{topic.title}</span>
                    <span className="shrink-0 text-xs text-fg-muted tabular">{topic.accuracy}%</span>
                  </div>
                  <Progress value={topic.accuracy} size="sm" indicatorClassName="bg-warning" />
                </div>
              ))}
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link to="/speak/grammar">
                  <Sparkles aria-hidden /> Practise weak topics
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent achievements</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {DEMO_ACHIEVEMENTS.map((achievement) => (
                <div key={achievement.id} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-fg">
                    <Award className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{achievement.title}</p>
                    <p className="text-xs text-fg-muted">
                      {achievement.description} · {formatRelative(achievement.earnedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
