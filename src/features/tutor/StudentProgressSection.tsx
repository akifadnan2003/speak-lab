import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/page-header'
import { AchievementsCard } from '@/features/progress/AchievementsCard'
import { levelLabel } from '@/features/progress/labels'
import { OverviewStats } from '@/features/progress/OverviewStats'
import { WeakTopicsCard } from '@/features/progress/PracticeCards'
import { ProgressSkeleton } from '@/features/progress/ProgressPage'
import { SkillsCard } from '@/features/progress/SkillsCard'
import { TimelineCard } from '@/features/progress/TimelineCard'
import { useLearningAnalytics } from '@/features/progress/useLearningAnalytics'
import { WeeklyActivityChart } from '@/features/progress/WeeklyActivityChart'

/**
 * Read-only learning progress of a linked student (M5). The same analytics as the student's own
 * Progress page over the same records; RLS returns rows only for students linked through
 * `tutor_students`. Assignments, notes and grading belong to M6.
 */
export function StudentProgressSection({ studentId }: { studentId: string }) {
  const { analytics, isLoading, error } = useLearningAnalytics(studentId)
  if (error) {
    return <EmptyState title="Progress could not be loaded" description={error instanceof Error ? error.message : 'Please try again.'} />
  }
  if (isLoading || !analytics) return <ProgressSkeleton />
  return (
    <div className="flex flex-col gap-6" data-testid="student-progress">
      <p className="text-sm text-fg-muted" data-testid="student-level">
        {levelLabel(analytics.overview).replace('your tutor', 'you')}
      </p>
      <OverviewStats overview={analytics.overview} possessive="their" />
      {analytics.overview.isEmpty ? (
        <EmptyState title="No learning activity yet" description="This student has not completed a lesson or reviewed vocabulary. Numbers appear here as soon as they do." compact />
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionHeader title="This week" description="Activity per day, counted on calendar days in your time zone." as="h3" />
          </CardHeader>
          <CardContent className="pt-0">
            <WeeklyActivityChart weekly={analytics.weekly} />
          </CardContent>
        </Card>
        <SkillsCard skills={analytics.skills} />
        <WeakTopicsCard insights={analytics.insights} />
        <TimelineCard events={analytics.timeline} timeline />
        <AchievementsCard achievements={analytics.achievements} />
      </div>
    </div>
  )
}
