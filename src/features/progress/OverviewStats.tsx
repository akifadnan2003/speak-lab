import { BookOpen, CheckCircle2, Flame, Layers, Trophy } from 'lucide-react'
import { Stat } from '@/components/ui/stat'
import { formatRelative } from '@/lib/utils'
import type { LearningOverview } from './analytics'

/** The learning overview as a responsive stat grid. Every number is defined in docs/PROGRESS_METRICS.md §1. */
export function OverviewStats({ overview, possessive = 'your' }: { overview: LearningOverview; possessive?: 'your' | 'their' }) {
  const chapters = `${overview.chaptersCompleted} of ${overview.chaptersAvailable} available`
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="overview-stats" data-empty={overview.isEmpty}>
      <Stat
        label="Lessons completed"
        value={overview.lessonsCompleted}
        hint={overview.lessonsInProgress > 0 ? `${overview.lessonsInProgress} in progress` : 'Practice lessons finished'}
        icon={BookOpen}
        tone="primary"
      />
      <Stat
        label="Chapters completed"
        value={overview.chaptersCompleted}
        hint={overview.chaptersPlanned > 0 ? `${chapters} · ${overview.chaptersPlanned} more coming` : chapters}
        icon={CheckCircle2}
        tone="success"
      />
      <Stat
        label="Learning streak"
        value={`${overview.streakDays}d`}
        hint={overview.streakDays > 0 ? 'Consecutive days with activity' : overview.activeDaysTotal > 0 ? `${overview.activeDaysTotal} active days in total` : 'Starts with the first activity'}
        icon={Flame}
        tone="warning"
      />
      <Stat
        label="Words learned"
        value={overview.vocabularyLearned}
        hint={overview.vocabularyDue > 0 ? `${overview.vocabularyDue} due now · ${overview.vocabularyMastered} mastered` : `${overview.vocabularyMastered} mastered`}
        icon={Layers}
      />
      <Stat label="Chapter checks" value={overview.checksPassed} hint={`${overview.checksSubmitted} submitted · ${overview.checksPassed} passed`} icon={Trophy} className="hidden lg:block" />
      <Stat
        label="Latest activity"
        value={overview.latestActivityAt ? formatRelative(overview.latestActivityAt) : 'None yet'}
        hint={overview.latestActivityAt ? `Last time ${possessive === 'your' ? 'you' : 'they'} learned something` : 'Nothing recorded yet'}
        className="hidden lg:block"
      />
    </div>
  )
}
