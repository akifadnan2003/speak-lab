import type { CefrLevel } from '@/features/curriculum/schema'
import { CEFR_LEVELS } from '@/features/curriculum/schema'
import { computeStreak } from '@/features/vocabulary/stats'
import { activeDays, isPracticeLesson, latestActivityAt, lessonIndex, lessonKey, submittedAssessments, todayKey } from './records'
import type { Clock, LearningRecords } from './types'

/** Learning overview. Definitions: docs/PROGRESS_METRICS.md §1. */
export interface LearningOverview {
  /** Level of the chapter the learner is working in, or the highest completed level. */
  readonly level: CefrLevel | null
  /** How the level was determined. `placed`: a tutor placement skipped earlier chapters. */
  readonly levelSource: 'completed' | 'current' | 'placed' | null
  readonly lessonsCompleted: number
  readonly lessonsInProgress: number
  readonly chaptersCompleted: number
  /** Authored chapters the learner could open or has finished. Planned chapters are excluded. */
  readonly chaptersAvailable: number
  readonly chaptersPlanned: number
  /** Chapter checks: submitted attempts, distinct chapters passed. */
  readonly checksSubmitted: number
  readonly checksPassed: number
  readonly latestActivityAt: string | null
  /** Consecutive active days ending today (or yesterday if today has nothing yet). */
  readonly streakDays: number
  readonly activeDaysTotal: number
  readonly vocabularyLearned: number
  readonly vocabularyDue: number
  readonly vocabularyMastered: number
  /** True until the learner has done anything at all. */
  readonly isEmpty: boolean
}

function levelRank(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level)
}

export function computeOverview(records: LearningRecords, clock: Clock): LearningOverview {
  const index = lessonIndex(records.chapters)
  let lessonsCompleted = 0
  let lessonsInProgress = 0
  for (const record of records.lessonProgress) {
    const ref = index.get(lessonKey(record.chapterId, record.lessonId))
    if (!isPracticeLesson(ref)) continue
    if (record.status === 'completed') lessonsCompleted++
    else if (record.status === 'in_progress') lessonsInProgress++
  }

  let chaptersCompleted = 0
  let chaptersAvailable = 0
  let chaptersPlanned = 0
  let highestCompleted: CefrLevel | null = null
  let current: CefrLevel | null = null
  // A tutor placement skips earlier chapters; the level then comes from the placement, not from work.
  let anySkipped = false
  for (const state of records.progression.values()) {
    if (state.status === 'skipped') anySkipped = true
    if (state.chapter.status !== 'authored') {
      chaptersPlanned++
      continue
    }
    if (state.status !== 'locked' && state.status !== 'skipped') chaptersAvailable++
    if (state.status === 'completed') {
      chaptersCompleted++
      if (!highestCompleted || levelRank(state.chapter.level) > levelRank(highestCompleted)) highestCompleted = state.chapter.level
    }
    if (!current && (state.status === 'in_progress' || state.status === 'available')) current = state.chapter.level
  }

  let level: CefrLevel | null = null
  let levelSource: LearningOverview['levelSource'] = null
  if (current && (!highestCompleted || levelRank(current) >= levelRank(highestCompleted))) {
    level = current
    levelSource = anySkipped && (!highestCompleted || levelRank(current) > levelRank(highestCompleted)) ? 'placed' : 'current'
  } else if (highestCompleted) {
    level = highestCompleted
    levelSource = 'completed'
  }

  const submitted = submittedAssessments(records.assessments)
  const passedChapters = new Set(submitted.filter((a) => a.passed).map((a) => a.chapterId))

  const days = activeDays(records, clock)
  const now = clock.now
  const states = records.vocabularyStates
  const vocabularyLearned = states.filter((s) => s.stage !== 'new').length
  const vocabularyMastered = states.filter((s) => s.stage === 'mastered').length
  const vocabularyDue = states.filter((s) => s.stage !== 'new' && s.dueAt !== null && new Date(s.dueAt).getTime() <= now.getTime()).length

  const latest = latestActivityAt(records)
  return {
    level,
    levelSource,
    lessonsCompleted,
    lessonsInProgress,
    chaptersCompleted,
    chaptersAvailable,
    chaptersPlanned,
    checksSubmitted: submitted.length,
    checksPassed: passedChapters.size,
    latestActivityAt: latest,
    streakDays: computeStreak(days, todayKey(clock)),
    activeDaysTotal: days.size,
    vocabularyLearned,
    vocabularyDue,
    vocabularyMastered,
    isEmpty: days.size === 0 && lessonsInProgress === 0,
  }
}
