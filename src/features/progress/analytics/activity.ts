import { daysBetweenKeys } from '@/features/vocabulary/srs/time'
import { completedPracticeLessons, dayOf, submittedAssessments, todayKey, uniqueAttempts } from './records'
import type { Clock, LearningRecords } from './types'

/**
 * Seven-day activity. Definitions: docs/PROGRESS_METRICS.md §2.
 *
 * - A day is a calendar day in the learner's device time zone; the window is today and the six
 *   days before it, oldest first.
 * - `lessonsCompleted`: practice lessons whose completion instant falls on the day (one per lesson).
 * - `exercisesPractised`: distinct exercises answered that day (retries of the same exercise on the
 *   same day count once; the same exercise on two days counts on both).
 * - `vocabularyReviews`: vocabulary answers recorded that day (each review id once).
 * - `checksSubmitted`: chapter checks submitted that day.
 */
export interface ActivityDay {
  /** `YYYY-MM-DD` in the learner's zone. */
  readonly day: string
  /** Short weekday label for the chart, e.g. "Mon". */
  readonly label: string
  readonly isToday: boolean
  readonly lessonsCompleted: number
  readonly exercisesPractised: number
  readonly vocabularyReviews: number
  readonly checksSubmitted: number
  /** Sum of the four signals: what the bar shows. */
  readonly total: number
}

export interface WeeklyActivity {
  readonly days: readonly ActivityDay[]
  readonly activeDays: number
  readonly totals: { lessonsCompleted: number; exercisesPractised: number; vocabularyReviews: number; checksSubmitted: number; total: number }
}

export const WEEK_DAYS = 7

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

function weekdayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

export function computeWeeklyActivity(records: LearningRecords, clock: Clock): WeeklyActivity {
  const today = todayKey(clock)
  const first = shiftKey(today, -(WEEK_DAYS - 1))
  const inWindow = (day: string) => daysBetweenKeys(first, day) >= 0 && daysBetweenKeys(day, today) >= 0

  const lessons = new Map<string, number>()
  const exercises = new Map<string, Set<string>>()
  const reviews = new Map<string, number>()
  const checks = new Map<string, number>()
  const bump = (map: Map<string, number>, day: string) => map.set(day, (map.get(day) ?? 0) + 1)

  for (const { record } of completedPracticeLessons(records)) {
    const day = dayOf(record.completedAt!, clock)
    if (inWindow(day)) bump(lessons, day)
  }
  for (const attempt of uniqueAttempts(records.attempts)) {
    const day = dayOf(attempt.createdAt, clock)
    if (!inWindow(day)) continue
    const set = exercises.get(day) ?? new Set<string>()
    set.add(`${attempt.chapterId}/${attempt.lessonId}/${attempt.exerciseId}`)
    exercises.set(day, set)
  }
  const seenReviews = new Set<string>()
  for (const review of records.vocabularyReviews) {
    if (seenReviews.has(review.id)) continue
    seenReviews.add(review.id)
    const day = dayOf(review.reviewedAt, clock)
    if (inWindow(day)) bump(reviews, day)
  }
  for (const a of submittedAssessments(records.assessments)) {
    const day = dayOf(a.submittedAt!, clock)
    if (inWindow(day)) bump(checks, day)
  }

  const days: ActivityDay[] = []
  for (let i = 0; i < WEEK_DAYS; i++) {
    const day = shiftKey(first, i)
    const lessonsCompleted = lessons.get(day) ?? 0
    const exercisesPractised = exercises.get(day)?.size ?? 0
    const vocabularyReviews = reviews.get(day) ?? 0
    const checksSubmitted = checks.get(day) ?? 0
    days.push({
      day,
      label: weekdayLabel(day),
      isToday: day === today,
      lessonsCompleted,
      exercisesPractised,
      vocabularyReviews,
      checksSubmitted,
      total: lessonsCompleted + exercisesPractised + vocabularyReviews + checksSubmitted,
    })
  }
  const totals = days.reduce(
    (t, d) => ({
      lessonsCompleted: t.lessonsCompleted + d.lessonsCompleted,
      exercisesPractised: t.exercisesPractised + d.exercisesPractised,
      vocabularyReviews: t.vocabularyReviews + d.vocabularyReviews,
      checksSubmitted: t.checksSubmitted + d.checksSubmitted,
      total: t.total + d.total,
    }),
    { lessonsCompleted: 0, exercisesPractised: 0, vocabularyReviews: 0, checksSubmitted: 0, total: 0 },
  )
  return { days, activeDays: days.filter((d) => d.total > 0).length, totals }
}
