import { LEVEL_NAMES } from '@/features/curriculum/schema'
import type { ActivityListItem } from './ActivityList'
import type { LearningOverview, TimelineEvent } from './analytics'

/** Display helpers shared by the student and tutor progress screens (no components here). */

export function levelLabel(overview: LearningOverview): string {
  if (!overview.level) return 'Level not set'
  const name = `${overview.level} · ${LEVEL_NAMES[overview.level]}`
  if (overview.levelSource === 'placed') return `${name} (placed by your tutor)`
  if (overview.levelSource === 'completed') return `${name} (completed)`
  return name
}

const TIMELINE_TYPE: Record<TimelineEvent['kind'], ActivityListItem['type']> = {
  lesson_completed: 'lesson',
  check_passed: 'assessment',
  check_failed: 'assessment',
  chapter_completed: 'achievement',
  vocabulary_milestone: 'vocabulary',
  vocabulary_first_review: 'vocabulary',
}

export function toActivityItems(events: readonly TimelineEvent[]): ActivityListItem[] {
  return events.map((e) => ({ id: e.id, type: TIMELINE_TYPE[e.kind], title: e.title, detail: e.detail, at: e.at }))
}
