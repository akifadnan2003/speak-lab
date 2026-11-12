import { computeAchievements, type Achievement } from './achievements'
import { computeWeeklyActivity, type WeeklyActivity } from './activity'
import { computeOverview, type LearningOverview } from './overview'
import { computeSkills, type SkillSummary } from './skills'
import { computeTimeline, type TimelineEvent } from './timeline'
import type { Clock, LearningRecords } from './types'
import { computePracticeInsights, type PracticeInsights } from './weak-topics'

export type { Achievement, AchievementId } from './achievements'
export type { ActivityDay, WeeklyActivity } from './activity'
export type { LearningOverview } from './overview'
export type { SkillEvidence, SkillSummary } from './skills'
export type { TimelineEvent, TimelineKind } from './timeline'
export type { Clock, LearningRecords } from './types'
export type { NextStep, PracticeInsights, WeakTopic } from './weak-topics'
export { computeAchievements, computeWeeklyActivity, computeOverview, computeSkills, computeTimeline, computePracticeInsights }

/** Everything the progress screens show, computed once from one set of records. */
export interface LearningAnalytics {
  readonly overview: LearningOverview
  readonly weekly: WeeklyActivity
  readonly skills: readonly SkillSummary[]
  readonly insights: PracticeInsights
  readonly timeline: readonly TimelineEvent[]
  readonly achievements: readonly Achievement[]
}

export function computeLearningAnalytics(records: LearningRecords, clock: Clock): LearningAnalytics {
  const overview = computeOverview(records, clock)
  return {
    overview,
    weekly: computeWeeklyActivity(records, clock),
    skills: computeSkills(records),
    insights: computePracticeInsights(records, overview.vocabularyDue),
    timeline: computeTimeline(records),
    achievements: computeAchievements(records, clock),
  }
}
