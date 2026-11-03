/**
 * DEMO DATA (M1). Student-facing dashboard, progress and vocabulary shells.
 * Replaced by real learning records in M4/M5.
 */

export interface WeeklyActivityDay {
  day: string
  minutes: number
  speakingMinutes: number
}

export const DEMO_WEEKLY_ACTIVITY: WeeklyActivityDay[] = [
  { day: 'Mon', minutes: 25, speakingMinutes: 8 },
  { day: 'Tue', minutes: 40, speakingMinutes: 15 },
  { day: 'Wed', minutes: 0, speakingMinutes: 0 },
  { day: 'Thu', minutes: 35, speakingMinutes: 12 },
  { day: 'Fri', minutes: 20, speakingMinutes: 10 },
  { day: 'Sat', minutes: 55, speakingMinutes: 25 },
  { day: 'Sun', minutes: 15, speakingMinutes: 5 },
]

export type SkillKey = 'grammar' | 'vocabulary' | 'speaking' | 'listening' | 'reading' | 'writing'

export interface SkillSummary {
  key: SkillKey
  label: string
  /** Objective completion-based mastery, 0-100. */
  mastery: number
  /** Number of completed activities contributing to the score. */
  activities: number
  trend: 'up' | 'flat' | 'down'
}

export const DEMO_SKILLS: SkillSummary[] = [
  { key: 'grammar', label: 'Grammar', mastery: 74, activities: 86, trend: 'up' },
  { key: 'vocabulary', label: 'Vocabulary', mastery: 68, activities: 412, trend: 'up' },
  { key: 'speaking', label: 'Speaking', mastery: 52, activities: 23, trend: 'up' },
  { key: 'listening', label: 'Listening', mastery: 81, activities: 31, trend: 'flat' },
  { key: 'reading', label: 'Reading', mastery: 77, activities: 19, trend: 'flat' },
  { key: 'writing', label: 'Writing', mastery: 58, activities: 9, trend: 'down' },
]

export interface WeakTopic {
  id: string
  title: string
  accuracy: number
  attempts: number
}

export const DEMO_WEAK_TOPICS: WeakTopic[] = [
  { id: 'articles', title: 'Articles: a / an / the', accuracy: 61, attempts: 48 },
  { id: 'past-continuous', title: 'Past Continuous with when / while', accuracy: 66, attempts: 22 },
  { id: 'prepositions-time', title: 'Prepositions of time: in / on / at', accuracy: 70, attempts: 35 },
]

export interface ActivityEvent {
  id: string
  type: 'lesson' | 'speaking' | 'vocabulary' | 'assessment' | 'assignment' | 'achievement'
  title: string
  detail: string
  at: string
}

export const DEMO_RECENT_ACTIVITY: ActivityEvent[] = [
  { id: 'e1', type: 'speaking', title: 'Daily-life roleplay: at the pharmacy', detail: '9 min, 14 turns', at: '2026-11-03T08:40:00Z' },
  { id: 'e2', type: 'lesson', title: 'When and while', detail: 'Scored 72%', at: '2026-11-02T18:10:00Z' },
  { id: 'e3', type: 'vocabulary', title: 'Review session', detail: '24 cards, 21 correct', at: '2026-11-02T17:45:00Z' },
  { id: 'e4', type: 'achievement', title: '7-day streak', detail: 'Practised every day this week', at: '2026-11-01T20:00:00Z' },
  { id: 'e5', type: 'assessment', title: 'Chapter 6 check', detail: 'Scored 90%', at: '2026-10-31T19:20:00Z' },
]

export interface Assignment {
  id: string
  title: string
  description: string
  dueAt: string
  status: 'pending' | 'submitted' | 'reviewed' | 'overdue'
  kind: 'speaking' | 'writing' | 'exercise' | 'reading'
}

export const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: 'as1',
    title: 'Record a 2-minute story about last weekend',
    description: 'Use at least five Past Continuous sentences with when or while.',
    dueAt: '2026-11-05T21:00:00Z',
    status: 'pending',
    kind: 'speaking',
  },
  {
    id: 'as2',
    title: 'Error correction set: articles',
    description: '20 sentences focused on a / an / the.',
    dueAt: '2026-11-04T21:00:00Z',
    status: 'pending',
    kind: 'exercise',
  },
  {
    id: 'as3',
    title: 'Write an email to a friend about your plans',
    description: '80-120 words using going to and Present Continuous.',
    dueAt: '2026-10-30T21:00:00Z',
    status: 'reviewed',
    kind: 'writing',
  },
]

export interface Achievement {
  id: string
  title: string
  description: string
  earnedAt: string
}

export const DEMO_ACHIEVEMENTS: Achievement[] = [
  { id: 'ach1', title: '7-day streak', description: 'Practised seven days in a row.', earnedAt: '2026-11-01T20:00:00Z' },
  { id: 'ach2', title: 'First roleplay', description: 'Completed your first AI roleplay.', earnedAt: '2026-10-24T17:00:00Z' },
  { id: 'ach3', title: '300 words', description: 'Learned 300 vocabulary items.', earnedAt: '2026-10-20T12:00:00Z' },
]

export interface DemoStudentSnapshot {
  level: 'A2'
  levelLabel: string
  courseProgress: number
  currentChapterId: string
  currentLessonId: string
  streakDays: number
  dailySpeakingTargetMinutes: number
  speakingMinutesToday: number
  vocabularyDue: number
  wordsLearned: number
  totalPracticeMinutes: number
}

export const DEMO_STUDENT_SNAPSHOT: DemoStudentSnapshot = {
  level: 'A2',
  levelLabel: 'A2 - Pre-intermediate',
  courseProgress: 36,
  currentChapterId: 'a2-07',
  currentLessonId: 'a2-07-03',
  streakDays: 7,
  dailySpeakingTargetMinutes: 15,
  speakingMinutesToday: 9,
  vocabularyDue: 24,
  wordsLearned: 312,
  totalPracticeMinutes: 1540,
}
