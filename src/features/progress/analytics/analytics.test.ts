import { describe, expect, it } from 'vitest'
import { CURRICULUM } from '@/features/curriculum/content/curriculum-map'
import { computeAchievements, STREAK_TARGET_DAYS } from './achievements'
import { computeWeeklyActivity } from './activity'
import { attempt, buildRecords, check, completedLesson, inProgressLesson, review, vocabState } from './fixtures'
import { computeLearningAnalytics } from './index'
import { computeOverview } from './overview'
import { computeSkills, MIN_GRADED_EXERCISES, MIN_VOCABULARY_REVIEWS } from './skills'
import { computeTimeline } from './timeline'
import { computePracticeInsights, WEAK_MIN_EXERCISES } from './weak-topics'

const A0 = CURRICULUM.find((c) => c.id === 'a0-01')!
const A2 = CURRICULUM.find((c) => c.id === 'a2-07')!
const grammar1 = A0.lessons[0]! // a0-01-l01, grammar
const grammar2 = A0.lessons[1]! // a0-01-l02, grammar
const reading = A0.lessons.find((l) => l.kind === 'reading')!
const checkLesson = A0.lessons.find((l) => l.kind === 'assessment')!
const practice = A0.lessons.filter((l) => l.kind !== 'assessment')

const BAKU = 'Asia/Baku' // UTC+4, no DST
const clock = { now: new Date('2026-11-12T10:00:00.000Z'), timeZone: BAKU }

function gradedAttempts(lessonId: string, count: number, correctEvery: number, at: string) {
  return Array.from({ length: count }, (_, i) => attempt('a0-01', lessonId, `${lessonId}-e${String(i + 1).padStart(2, '0')}`, { correct: i % correctEvery === 0, at }))
}

describe('an empty account', () => {
  const records = buildRecords(CURRICULUM)
  const analytics = computeLearningAnalytics(records, clock)

  it('reports nothing invented', () => {
    const { overview } = analytics
    expect(overview.isEmpty).toBe(true)
    expect(overview.lessonsCompleted).toBe(0)
    expect(overview.streakDays).toBe(0)
    expect(overview.latestActivityAt).toBeNull()
    expect(overview.level).toBe('A0')
    expect(overview.levelSource).toBe('current')
    expect(overview.chaptersAvailable).toBe(1) // A0-01 only; A2-07 is locked behind planned chapters
    expect(overview.chaptersPlanned).toBe(68)
    expect(analytics.weekly.totals.total).toBe(0)
    expect(analytics.weekly.days).toHaveLength(7)
    expect(analytics.timeline).toEqual([])
    expect(analytics.achievements.every((a) => a.earnedAt === undefined)).toBe(true)
    expect(analytics.insights.weakTopics).toEqual([])
  })

  it('shows every skill without a score', () => {
    const kinds = Object.fromEntries(analytics.skills.map((s) => [s.skill, s.evidence.kind]))
    expect(kinds).toEqual({ grammar: 'insufficient', vocabulary: 'insufficient', reading: 'insufficient', speaking: 'self_checked', writing: 'self_checked', listening: 'no_content' })
  })

  it('suggests starting the first lesson', () => {
    expect(analytics.insights.nextSteps[0]).toMatchObject({ kind: 'start', href: '/learn/a0-01/lessons/a0-01-l01' })
  })
})

describe('partial progress', () => {
  const records = buildRecords(CURRICULUM, {
    lessonProgress: [completedLesson('a0-01', grammar1.id, '2026-11-10T08:00:00.000Z', 92), inProgressLesson('a0-01', grammar2.id, '2026-11-12T07:30:00.000Z')],
    attempts: [
      ...gradedAttempts(grammar1.id, 4, 1, '2026-11-10T07:50:00.000Z'),
      attempt('a0-01', grammar2.id, `${grammar2.id}-e01`, { correct: false, at: '2026-11-12T07:30:00.000Z' }),
      attempt('a0-01', grammar2.id, `${grammar2.id}-e01`, { correct: true, at: '2026-11-12T07:31:00.000Z', attemptNumber: 2 }),
    ],
  })
  const analytics = computeLearningAnalytics(records, clock)

  it('counts completed and in-progress lessons, the current chapter and the latest activity', () => {
    expect(analytics.overview).toMatchObject({ lessonsCompleted: 1, lessonsInProgress: 1, chaptersCompleted: 0, isEmpty: false, latestActivityAt: '2026-11-12T07:31:00.000Z' })
    expect(analytics.overview.streakDays).toBe(1)
    expect(analytics.overview.activeDaysTotal).toBe(2)
  })

  it('does not call a lesson weak on too little evidence', () => {
    expect(analytics.insights.weakTopics).toEqual([])
    expect(analytics.insights.insufficient).toBe(2)
    expect(analytics.skills.find((s) => s.skill === 'grammar')).toMatchObject({ lessonsCompleted: 1, exercisesTried: 5, evidence: { kind: 'insufficient', sample: 5, needed: MIN_GRADED_EXERCISES } })
  })

  it('recommends continuing the lesson in progress', () => {
    expect(analytics.insights.nextSteps[0]).toMatchObject({ kind: 'continue', href: `/learn/a0-01/lessons/${grammar2.id}` })
  })

  it('puts the completed lesson on the timeline and awards the first-lesson achievement once', () => {
    expect(analytics.timeline.map((e) => e.id)).toEqual([`lesson:a0-01/${grammar1.id}`])
    const earned = analytics.achievements.filter((a) => a.earnedAt)
    expect(earned.map((a) => a.id)).toEqual(['first_lesson'])
    expect(earned[0]!.earnedAt).toBe('2026-11-10T08:00:00.000Z')
  })
})

describe('a completed chapter with passed and failed checks', () => {
  const lessons = practice.map((l, i) => completedLesson('a0-01', l.id, `2026-11-0${(i % 7) + 1}T10:00:00.000Z`))
  const failed = check('a0-01', checkLesson.id, { score: 60, at: '2026-11-09T10:00:00.000Z', attemptNumber: 1 })
  const passed = check('a0-01', checkLesson.id, { score: 100, at: '2026-11-10T10:00:00.000Z', attemptNumber: 2 })
  const voided = check('a0-01', checkLesson.id, { score: 0, at: '2026-11-08T10:00:00.000Z', status: 'voided' })
  const open = check('a0-01', checkLesson.id, { score: 0, at: '2026-11-11T10:00:00.000Z', status: 'in_progress' })
  const records = buildRecords(CURRICULUM, {
    // The repository merges the passing attempt into lesson progress; mirror that here.
    lessonProgress: [...lessons, completedLesson('a0-01', checkLesson.id, '2026-11-10T10:00:00.000Z', 100)],
    assessments: [failed, passed, voided, open],
  })
  const analytics = computeLearningAnalytics(records, clock)

  it('counts the chapter as completed and only submitted attempts as checks', () => {
    expect(analytics.overview).toMatchObject({ chaptersCompleted: 1, checksSubmitted: 2, checksPassed: 1, lessonsCompleted: practice.length })
    expect(records.progression.get('a0-01')?.status).toBe('completed')
  })

  it('does not count the chapter check as a practice lesson', () => {
    expect(analytics.overview.lessonsCompleted).toBe(practice.length)
  })

  it('records both check outcomes and the chapter completion once, newest first', () => {
    const ids = analytics.timeline.map((e) => e.id)
    expect(ids.filter((id) => id.startsWith('check:'))).toHaveLength(2)
    expect(ids.filter((id) => id === 'chapter:a0-01')).toHaveLength(1)
    expect(analytics.timeline[0]!.kind).toBe('chapter_completed')
    expect(analytics.timeline.find((e) => e.kind === 'check_failed')?.detail).toContain('Score 60%')
  })

  it('awards first chapter passed and perfect check at the passing attempt', () => {
    const byId = Object.fromEntries(analytics.achievements.map((a) => [a.id, a.earnedAt]))
    expect(byId.first_chapter_passed).toBe('2026-11-10T10:00:00.000Z')
    expect(byId.perfect_check).toBe('2026-11-10T10:00:00.000Z')
  })

  it('lists no weak chapter check once the pass mark is reached', () => {
    expect(analytics.insights.weakTopics.find((w) => w.kind === 'chapter_check')).toBeUndefined()
  })

  it('moves the level to the completed chapter when nothing further is open', () => {
    expect(analytics.overview.level).toBe('A0')
    expect(analytics.overview.levelSource).toBe('completed')
  })
})

describe('a failed chapter check without a pass', () => {
  const records = buildRecords(CURRICULUM, {
    lessonProgress: practice.map((l) => completedLesson('a0-01', l.id, '2026-11-05T10:00:00.000Z')),
    assessments: [check('a0-01', checkLesson.id, { score: 55, at: '2026-11-11T10:00:00.000Z' }), check('a0-01', checkLesson.id, { score: 70, at: '2026-11-12T06:00:00.000Z' })],
  })
  const insights = computePracticeInsights(records, 0)

  it('is a weak topic with the best score and attempt count, linking to the check', () => {
    expect(insights.weakTopics).toEqual([
      expect.objectContaining({ kind: 'chapter_check', accuracy: 70, sample: 2, href: `/learn/a0-01/lessons/${checkLesson.id}` }),
    ])
    expect(insights.nextSteps.find((s) => s.kind === 'chapter_check')).toBeDefined()
  })
})

describe('repeated and duplicate attempts', () => {
  const ids = Array.from({ length: WEAK_MIN_EXERCISES }, (_, i) => `${grammar1.id}-e${String(i + 1).padStart(2, '0')}`)
  // Run 1: everything wrong on the first try. Run 2 (later): everything right on the first try.
  const run1 = ids.map((id) => attempt('a0-01', grammar1.id, id, { correct: false, at: '2026-11-10T08:00:00.000Z' }))
  const retries = ids.map((id) => attempt('a0-01', grammar1.id, id, { correct: true, at: '2026-11-10T08:05:00.000Z', attemptNumber: 2 }))
  const run2 = ids.map((id) => attempt('a0-01', grammar1.id, id, { correct: true, at: '2026-11-11T08:00:00.000Z' }))

  it('is weak after the first run (retries do not rescue the first-try accuracy)', () => {
    const insights = computePracticeInsights(buildRecords(CURRICULUM, { attempts: [...run1, ...retries] }), 0)
    expect(insights.weakTopics).toEqual([expect.objectContaining({ kind: 'lesson', accuracy: 0, sample: WEAK_MIN_EXERCISES, href: `/learn/a0-01/lessons/${grammar1.id}` })])
  })

  it('uses the latest run once the lesson is repeated, and the same row twice counts once', () => {
    const duplicate = { ...run2[0]! }
    const records = buildRecords(CURRICULUM, { attempts: [...run1, ...retries, ...run2, duplicate] })
    expect(computePracticeInsights(records, 0).weakTopics).toEqual([])
    const weekly = computeWeeklyActivity(records, clock)
    expect(weekly.days.find((d) => d.day === '2026-11-10')?.exercisesPractised).toBe(WEAK_MIN_EXERCISES)
    expect(weekly.days.find((d) => d.day === '2026-11-11')?.exercisesPractised).toBe(WEAK_MIN_EXERCISES)
    expect(weekly.totals.exercisesPractised).toBe(WEAK_MIN_EXERCISES * 2)
  })
})

describe('skills', () => {
  it('measures grammar and reading from first tries only once enough graded exercises exist', () => {
    const grammar = gradedAttempts(grammar1.id, MIN_GRADED_EXERCISES, 2, '2026-11-10T08:00:00.000Z') // 50% right
    const readingTries = Array.from({ length: MIN_GRADED_EXERCISES - 1 }, (_, i) =>
      attempt('a0-01', reading.id, `${reading.id}-e${i + 1}`, { correct: true, at: '2026-11-10T09:00:00.000Z' }),
    )
    const skills = computeSkills(buildRecords(CURRICULUM, { attempts: [...grammar, ...readingTries] }))
    expect(skills.find((s) => s.skill === 'grammar')?.evidence).toEqual({ kind: 'measured', accuracy: 50, sample: MIN_GRADED_EXERCISES })
    expect(skills.find((s) => s.skill === 'reading')?.evidence).toEqual({ kind: 'insufficient', sample: MIN_GRADED_EXERCISES - 1, needed: MIN_GRADED_EXERCISES })
  })

  it('never scores speaking or writing, and counts pronunciation work as speaking participation', () => {
    const pron = A0.lessons.find((l) => l.kind === 'pronunciation')!
    const skills = computeSkills(buildRecords(CURRICULUM, { lessonProgress: [completedLesson('a0-01', pron.id, '2026-11-10T08:00:00.000Z')] }))
    expect(skills.find((s) => s.skill === 'speaking')).toMatchObject({ lessonsCompleted: 1, evidence: { kind: 'self_checked' } })
    expect(skills.find((s) => s.skill === 'writing')?.evidence).toEqual({ kind: 'self_checked' })
    expect(skills.find((s) => s.skill === 'listening')?.evidence).toEqual({ kind: 'no_content' })
  })

  it('measures vocabulary from review outcomes and the mastered share', () => {
    const reviews = Array.from({ length: MIN_VOCABULARY_REVIEWS }, (_, i) => review(`v-${i}`, { correct: i < 8, at: `2026-11-10T08:${String(i).padStart(2, '0')}:00.000Z` }))
    const states = [vocabState('v-0', { stage: 'mastered' }), vocabState('v-1', { stage: 'learning' }), vocabState('v-2', { stage: 'review' }), vocabState('v-3')]
    const vocab = computeSkills(buildRecords(CURRICULUM, { vocabularyReviews: reviews, vocabularyStates: states })).find((s) => s.skill === 'vocabulary')
    expect(vocab?.evidence).toEqual({ kind: 'measured', accuracy: 80, mastered: 33, sample: MIN_VOCABULARY_REVIEWS })
  })
})

describe('vocabulary lapses and milestones', () => {
  const states = ['v-a', 'v-b', 'v-c'].map((id) => vocabState(id, { stage: 'learning', lapses: 2, firstLearnedAt: '2026-11-01T09:00:00.000Z' }))
  const reviews = Array.from({ length: 60 }, (_, i) => review('v-a', { correct: true, at: new Date(Date.UTC(2026, 10, 1, 9, i)).toISOString() }))
  const records = buildRecords(CURRICULUM, { vocabularyStates: states, vocabularyReviews: [...reviews, { ...reviews[5]! }] })

  it('flags repeated lapses as a weak topic with a practice link', () => {
    const insights = computePracticeInsights(records, 0)
    expect(insights.weakTopics).toEqual([expect.objectContaining({ kind: 'vocabulary', sample: 3, href: '/vocabulary/practice/active_recall' })])
  })

  it('creates each review milestone once, even with a duplicated review', () => {
    const timeline = computeTimeline(records)
    expect(timeline.filter((e) => e.kind === 'vocabulary_milestone').map((e) => e.title)).toEqual(['50 vocabulary reviews', '10 vocabulary reviews'])
    expect(timeline.filter((e) => e.kind === 'vocabulary_first_review')).toHaveLength(1)
    expect(computeAchievements(records, clock).find((a) => a.id === 'vocabulary_50_reviews')?.earnedAt).toBe(reviews[49]!.reviewedAt)
  })

  it('counts due words only among learned words whose due time has passed', () => {
    const due = vocabState('v-due', { stage: 'review', dueAt: '2026-11-12T09:00:00.000Z' })
    const later = vocabState('v-later', { stage: 'review', dueAt: '2026-11-13T09:00:00.000Z' })
    const overview = computeOverview(buildRecords(CURRICULUM, { vocabularyStates: [due, later, vocabState('v-new')] }), clock)
    expect(overview).toMatchObject({ vocabularyLearned: 2, vocabularyDue: 1, vocabularyMastered: 0 })
  })
})

describe('calendar days, time zones and streaks', () => {
  // 23:30 in Baku on the 11th is 19:30 UTC on the 11th; 00:30 in Baku on the 12th is 20:30 UTC on the 11th.
  const lateEvening = '2026-11-11T19:30:00.000Z'
  const justAfterMidnight = '2026-11-11T20:30:00.000Z'

  it('assigns activity to the learner’s calendar day, not the UTC day', () => {
    const records = buildRecords(CURRICULUM, { vocabularyReviews: [review('v-1', { correct: true, at: lateEvening }), review('v-2', { correct: true, at: justAfterMidnight })] })
    const baku = computeWeeklyActivity(records, { now: new Date('2026-11-12T10:00:00.000Z'), timeZone: BAKU })
    expect(baku.days.find((d) => d.day === '2026-11-11')?.vocabularyReviews).toBe(1)
    expect(baku.days.find((d) => d.day === '2026-11-12')?.vocabularyReviews).toBe(1)
    const utc = computeWeeklyActivity(records, { now: new Date('2026-11-12T10:00:00.000Z'), timeZone: 'UTC' })
    expect(utc.days.find((d) => d.day === '2026-11-11')?.vocabularyReviews).toBe(2)
  })

  it('keeps the window at today and the six previous days, today last', () => {
    const weekly = computeWeeklyActivity(buildRecords(CURRICULUM), { now: new Date('2026-11-12T20:30:00.000Z'), timeZone: BAKU })
    expect(weekly.days.map((d) => d.day)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
    expect(weekly.days.at(-1)?.isToday).toBe(true)
    expect(weekly.days[0]?.label).toBe('Sat')
  })

  it('counts a streak across the midnight boundary and keeps it alive through today', () => {
    const days = ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']
    const reviews = days.map((d, i) => review(`v-${i}`, { correct: true, at: `${d}T05:00:00.000Z` }))
    const records = buildRecords(CURRICULUM, { vocabularyReviews: reviews })
    expect(computeOverview(records, { now: new Date('2026-11-12T10:00:00.000Z'), timeZone: 'UTC' }).streakDays).toBe(7)
    // Nothing yet "today" (the 13th): the streak still counts until the day is over.
    expect(computeOverview(records, { now: new Date('2026-11-13T08:00:00.000Z'), timeZone: 'UTC' }).streakDays).toBe(7)
    // A missed day ends it.
    expect(computeOverview(records, { now: new Date('2026-11-14T08:00:00.000Z'), timeZone: 'UTC' }).streakDays).toBe(0)
    const streak = computeAchievements(records, { now: new Date('2026-11-12T10:00:00.000Z'), timeZone: 'UTC' }).find((a) => a.id === 'streak_7')
    expect(streak?.earnedAt).toBe('2026-11-12T23:59:59.000Z')
    expect(streak?.progress).toEqual({ current: STREAK_TARGET_DAYS, target: STREAK_TARGET_DAYS })
  })

  it('does not award the streak for seven scattered days', () => {
    const reviews = [1, 2, 4, 5, 7, 8, 10].map((d, i) => review(`v-${i}`, { correct: true, at: `2026-11-${String(d).padStart(2, '0')}T05:00:00.000Z` }))
    const streak = computeAchievements(buildRecords(CURRICULUM, { vocabularyReviews: reviews }), clock).find((a) => a.id === 'streak_7')
    expect(streak?.earnedAt).toBeUndefined()
    expect(streak?.progress).toEqual({ current: 2, target: STREAK_TARGET_DAYS })
  })
})

describe('placement and planned content', () => {
  it('reports a placed level and never counts planned chapters as available', () => {
    const skipped = CURRICULUM.filter((c) => c.level === 'A0' || c.level === 'A1').map((c) => ({ chapterId: c.id, kind: 'skip' as const }))
    const records = buildRecords(CURRICULUM, { overrides: [...skipped, { chapterId: 'a2-07', kind: 'unlock' }] })
    const overview = computeOverview(records, clock)
    expect(overview.level).toBe('A2')
    expect(overview.levelSource).toBe('placed')
    expect(overview.chaptersAvailable).toBe(1) // A2-07 only; planned A2-01..06 stay out
    expect(records.progression.get(A2.id)?.status).toBe('available')
  })
})
