import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useCurriculumServices } from '@/features/curriculum/CurriculumProvider'
import { BookOpen, Smartphone } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { AchievementsCard } from './AchievementsCard'
import { levelLabel } from './labels'
import { OverviewStats } from './OverviewStats'
import { NextStepsCard, WeakTopicsCard } from './PracticeCards'
import { SkillsCard } from './SkillsCard'
import { TimelineCard } from './TimelineCard'
import { useLearningAnalytics } from './useLearningAnalytics'
import { WeeklyActivityChart } from './WeeklyActivityChart'

export function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="progress-loading">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

export function ProgressPage() {
  const user = useCurrentUser()
  const { storage } = useCurriculumServices()
  const { analytics, isLoading, error } = useLearningAnalytics(user?.id ?? null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Progress"
        title="Your learning record"
        description={analytics ? levelLabel(analytics.overview) : 'Every number here comes from your own stored records.'}
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted" data-testid="progress-storage-label">
            <Smartphone className="size-3.5" aria-hidden />
            {storage === 'device' ? 'Records on this device' : 'Records in your account'}
          </span>
        }
      />

      {error ? (
        <EmptyState title="Your progress could not be loaded" description={error instanceof Error ? error.message : 'Please try again.'} data-testid="progress-error" />
      ) : isLoading || !analytics ? (
        <ProgressSkeleton />
      ) : (
        <>
          <OverviewStats overview={analytics.overview} />

          {analytics.overview.isEmpty ? (
            <EmptyState
              icon={BookOpen}
              title="Your record starts with your first lesson"
              description="Finish a lesson or review a few words and this page fills with real numbers: activity by day, skills, what needs practice and what to do next."
              action={
                <Button asChild>
                  <Link to="/learn">Open the curriculum</Link>
                </Button>
              }
              data-testid="progress-empty"
            />
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionHeader title="This week" description="Learning activity per day in your time zone: lessons completed, exercises practised, vocabulary reviews and chapter checks." as="h2" />
              </CardHeader>
              <CardContent className="pt-0">
                <WeeklyActivityChart weekly={analytics.weekly} />
              </CardContent>
            </Card>
            <NextStepsCard steps={analytics.insights.nextSteps} />
            <SkillsCard skills={analytics.skills} />
            <WeakTopicsCard insights={analytics.insights} />
            <TimelineCard events={analytics.timeline} timeline />
            <AchievementsCard achievements={analytics.achievements} />
          </div>
        </>
      )}
    </div>
  )
}
