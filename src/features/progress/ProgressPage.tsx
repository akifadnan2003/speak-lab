import { Clock, Flame, Mic, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Stat } from '@/components/ui/stat'
import {
  DEMO_RECENT_ACTIVITY,
  DEMO_SKILLS,
  DEMO_STUDENT_SNAPSHOT,
  DEMO_WEAK_TOPICS,
  DEMO_WEEKLY_ACTIVITY,
} from '@/demo/student-home'
import { formatMinutes } from '@/lib/utils'
import { ActivityList } from './ActivityList'
import { WeeklyActivityChart } from './WeeklyActivityChart'

const SKILL_COLOR: Record<string, string> = {
  grammar: 'bg-skill-grammar',
  vocabulary: 'bg-skill-vocabulary',
  speaking: 'bg-skill-speaking',
  listening: 'bg-skill-listening',
  reading: 'bg-skill-reading',
  writing: 'bg-skill-writing',
}

function TrendIcon({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up') return <TrendingUp className="size-4 text-success" aria-label="Improving" />
  if (trend === 'down') return <TrendingDown className="size-4 text-danger" aria-label="Declining" />
  return <Minus className="size-4 text-fg-subtle" aria-label="Stable" />
}

export function ProgressPage() {
  const snapshot = DEMO_STUDENT_SNAPSHOT
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Progress"
        title="Your learning record"
        description="Objective metrics come from completed activities. Speaking estimates from the coach are labelled separately."
        actions={<DemoNotice>Real analytics arrive in M5.</DemoNotice>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total practice" value={formatMinutes(snapshot.totalPracticeMinutes)} icon={Clock} tone="primary" />
        <Stat label="Current streak" value={`${snapshot.streakDays} days`} icon={Flame} tone="warning" />
        <Stat label="Speaking sessions" value={23} hint="214 min total" icon={Mic} tone="success" />
        <Stat label="Course progress" value={`${snapshot.courseProgress}%`} hint={snapshot.levelLabel} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionHeader title="Skill mastery" description="Share of activities completed at 80%+ accuracy, per skill." />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {DEMO_SKILLS.map((skill) => (
              <div key={skill.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className={`size-2.5 rounded-sm ${SKILL_COLOR[skill.key]}`} aria-hidden />
                    {skill.label}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-fg-muted">
                    <span className="tabular">{skill.activities} activities</span>
                    <TrendIcon trend={skill.trend} />
                    <span className="w-9 text-right font-semibold text-fg tabular">{skill.mastery}%</span>
                  </span>
                </div>
                <Progress value={skill.mastery} size="sm" indicatorClassName={SKILL_COLOR[skill.key]} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader title="Weekly activity" description="Minutes of practice per day." />
          </CardHeader>
          <CardContent className="pt-0">
            <WeeklyActivityChart data={DEMO_WEEKLY_ACTIVITY} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader title="Topics to revisit" description="Lowest accuracy across recent attempts." />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {DEMO_WEAK_TOPICS.map((topic) => (
              <div key={topic.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{topic.title}</span>
                  <span className="text-xs text-fg-muted tabular">
                    {topic.accuracy}% · {topic.attempts} attempts
                  </span>
                </div>
                <Progress value={topic.accuracy} size="sm" indicatorClassName="bg-warning" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader title="Learning history" />
          </CardHeader>
          <CardContent className="pt-0">
            <ActivityList items={DEMO_RECENT_ACTIVITY} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
