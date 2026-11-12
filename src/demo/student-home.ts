/**
 * DEMO DATA (M1). What is left after M5: the shapes the tutor *preview* profiles use
 * (`src/demo/students.ts`) and the speaking snapshot shown on the coach screens until M7.
 * The student dashboard and Progress page no longer read anything from here.
 */

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

export interface WeakTopic {
  id: string
  title: string
  accuracy: number
  attempts: number
}

export interface Assignment {
  id: string
  title: string
  description: string
  dueAt: string
  status: 'pending' | 'submitted' | 'reviewed' | 'overdue'
  kind: 'speaking' | 'writing' | 'exercise' | 'reading'
}

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
