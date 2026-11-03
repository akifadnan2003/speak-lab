/**
 * DEMO DATA (M1). Tutor dashboard shells: student cards and the individual
 * student profile. Real records are produced by M5/M6. The two fictional
 * learners below mirror the launch scenario (two Azerbaijani students) but the
 * UI never assumes a two-student limit.
 */
import type { CefrLevel } from './curriculum'
import type { Assignment, SkillSummary, WeakTopic } from './student-home'

export type LearningStatus = 'active' | 'inactive' | 'needs_attention' | 'invited' | 'disabled'

export interface DemoStudentCard {
  id: string
  fullName: string
  email: string
  level: CefrLevel
  currentChapter: string
  courseProgress: number
  lastActiveAt: string
  pendingAssignments: number
  speakingSessionsThisWeek: number
  speakingMinutesThisWeek: number
  status: LearningStatus
}

export const DEMO_STUDENTS: DemoStudentCard[] = [
  {
    id: 'st-aysel',
    fullName: 'Aysel Mammadova',
    email: 'aysel@example.com',
    level: 'A2',
    currentChapter: 'A2 · Chapter 7 · Past Continuous',
    courseProgress: 36,
    lastActiveAt: '2026-11-03T08:49:00Z',
    pendingAssignments: 2,
    speakingSessionsThisWeek: 4,
    speakingMinutesThisWeek: 38,
    status: 'active',
  },
  {
    id: 'st-rashad',
    fullName: 'Rashad Aliyev',
    email: 'rashad@example.com',
    level: 'B1',
    currentChapter: 'B1 · Chapter 2 · Present Perfect',
    courseProgress: 48,
    lastActiveAt: '2026-10-29T20:15:00Z',
    pendingAssignments: 1,
    speakingSessionsThisWeek: 1,
    speakingMinutesThisWeek: 7,
    status: 'needs_attention',
  },
]

export interface DemoInvitation {
  id: string
  email: string
  sentAt: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'expired'
}

export const DEMO_INVITATIONS: DemoInvitation[] = [
  { id: 'inv1', email: 'nigar@example.com', sentAt: '2026-11-01T10:00:00Z', expiresAt: '2026-11-02T10:00:00Z', status: 'expired' },
]

export interface DemoGrammarTopic {
  id: string
  title: string
  accuracy: number
  attempts: number
  lastPractisedAt: string
  recurringError?: string
}

export interface DemoTeacherNote {
  id: string
  createdAt: string
  body: string
}

export interface DemoListeningActivity {
  id: string
  title: string
  score: number
  completedAt: string
}

export interface DemoHistoryEvent {
  id: string
  at: string
  type: 'lesson' | 'speaking' | 'assessment' | 'assignment' | 'vocabulary' | 'account'
  title: string
  detail: string
}

export interface DemoStudentProfile {
  card: DemoStudentCard
  objectives: string[]
  totalPracticeMinutes: number
  practiceMinutesLast7Days: number
  skills: SkillSummary[]
  grammarTopics: DemoGrammarTopic[]
  weakTopics: WeakTopic[]
  vocabulary: { learned: number; due: number; retention: number; difficult: string[] }
  speaking: { sessions: number; minutes: number; recurringDifficulties: string[] }
  listening: DemoListeningActivity[]
  assignments: Assignment[]
  notes: DemoTeacherNote[]
  history: DemoHistoryEvent[]
  settings: { levelOverride: CefrLevel | null; supportLanguage: 'az' | 'none'; feedbackStyle: string; aiDailyMinutes: number }
}

const ayselCard = DEMO_STUDENTS[0]
const rashadCard = DEMO_STUDENTS[1]

export const DEMO_STUDENT_PROFILES: Record<string, DemoStudentProfile> = {}

if (ayselCard) {
  DEMO_STUDENT_PROFILES[ayselCard.id] = {
    card: ayselCard,
    objectives: ['Speak for two minutes without stopping', 'Use past tenses accurately in stories', 'Reach B1 by spring'],
    totalPracticeMinutes: 1540,
    practiceMinutesLast7Days: 190,
    skills: [
      { key: 'grammar', label: 'Grammar', mastery: 74, activities: 86, trend: 'up' },
      { key: 'vocabulary', label: 'Vocabulary', mastery: 68, activities: 412, trend: 'up' },
      { key: 'speaking', label: 'Speaking', mastery: 52, activities: 23, trend: 'up' },
      { key: 'listening', label: 'Listening', mastery: 81, activities: 31, trend: 'flat' },
      { key: 'reading', label: 'Reading', mastery: 77, activities: 19, trend: 'flat' },
      { key: 'writing', label: 'Writing', mastery: 58, activities: 9, trend: 'down' },
    ],
    grammarTopics: [
      { id: 'g1', title: 'Past Simple', accuracy: 88, attempts: 120, lastPractisedAt: '2026-11-02T18:00:00Z' },
      { id: 'g2', title: 'Past Continuous', accuracy: 66, attempts: 22, lastPractisedAt: '2026-11-02T18:10:00Z', recurringError: 'Uses Past Simple after while' },
      { id: 'g3', title: 'Articles', accuracy: 61, attempts: 48, lastPractisedAt: '2026-10-30T19:00:00Z', recurringError: 'Omits the before superlatives' },
      { id: 'g4', title: 'Prepositions of time', accuracy: 70, attempts: 35, lastPractisedAt: '2026-10-28T18:30:00Z' },
      { id: 'g5', title: 'Present Simple vs Continuous', accuracy: 91, attempts: 140, lastPractisedAt: '2026-10-20T17:00:00Z' },
    ],
    weakTopics: [
      { id: 'articles', title: 'Articles: a / an / the', accuracy: 61, attempts: 48 },
      { id: 'past-continuous', title: 'Past Continuous with when / while', accuracy: 66, attempts: 22 },
    ],
    vocabulary: { learned: 312, due: 24, retention: 86, difficult: ['nevertheless', 'run out of', 'look forward to'] },
    speaking: { sessions: 23, minutes: 214, recurringDifficulties: ['Drops articles when speaking quickly', 'Hesitates before irregular past forms'] },
    listening: [
      { id: 'l1', title: 'A strange evening', score: 80, completedAt: '2026-11-02T18:30:00Z' },
      { id: 'l2', title: 'At the train station', score: 90, completedAt: '2026-10-29T18:00:00Z' },
    ],
    assignments: [
      { id: 'as1', title: 'Record a 2-minute story about last weekend', description: 'Use at least five Past Continuous sentences.', dueAt: '2026-11-05T21:00:00Z', status: 'pending', kind: 'speaking' },
      { id: 'as2', title: 'Error correction set: articles', description: '20 sentences focused on a / an / the.', dueAt: '2026-11-04T21:00:00Z', status: 'pending', kind: 'exercise' },
      { id: 'as3', title: 'Write an email about your plans', description: '80-120 words using going to.', dueAt: '2026-10-30T21:00:00Z', status: 'reviewed', kind: 'writing' },
    ],
    notes: [
      { id: 'n1', createdAt: '2026-11-01T21:00:00Z', body: 'Very strong comprehension. Push for longer spoken answers; she stops after one sentence when unsure.' },
      { id: 'n2', createdAt: '2026-10-25T20:00:00Z', body: 'Articles remain the main recurring issue. Assign a weekly error-correction set.' },
    ],
    history: [
      { id: 'h1', at: '2026-11-03T08:40:00Z', type: 'speaking', title: 'Roleplay: at the pharmacy', detail: '9 min, 14 turns' },
      { id: 'h2', at: '2026-11-02T18:10:00Z', type: 'lesson', title: 'When and while', detail: 'Scored 72%' },
      { id: 'h3', at: '2026-11-02T17:45:00Z', type: 'vocabulary', title: 'Review session', detail: '24 cards, 21 correct' },
      { id: 'h4', at: '2026-10-31T19:20:00Z', type: 'assessment', title: 'Chapter 6 check', detail: 'Scored 90%' },
      { id: 'h5', at: '2026-10-30T20:00:00Z', type: 'assignment', title: 'Email about plans', detail: 'Submitted and reviewed' },
      { id: 'h6', at: '2026-10-12T09:00:00Z', type: 'account', title: 'Account activated', detail: 'Accepted invitation' },
    ],
    settings: { levelOverride: null, supportLanguage: 'az', feedbackStyle: 'detailed', aiDailyMinutes: 30 },
  }
}

if (rashadCard) {
  DEMO_STUDENT_PROFILES[rashadCard.id] = {
    card: rashadCard,
    objectives: ['Prepare for job interviews in English', 'Improve fluency under time pressure'],
    totalPracticeMinutes: 980,
    practiceMinutesLast7Days: 35,
    skills: [
      { key: 'grammar', label: 'Grammar', mastery: 79, activities: 64, trend: 'flat' },
      { key: 'vocabulary', label: 'Vocabulary', mastery: 72, activities: 288, trend: 'down' },
      { key: 'speaking', label: 'Speaking', mastery: 47, activities: 11, trend: 'down' },
      { key: 'listening', label: 'Listening', mastery: 85, activities: 22, trend: 'flat' },
      { key: 'reading', label: 'Reading', mastery: 83, activities: 15, trend: 'up' },
      { key: 'writing', label: 'Writing', mastery: 64, activities: 6, trend: 'flat' },
    ],
    grammarTopics: [
      { id: 'g1', title: 'Present Perfect', accuracy: 71, attempts: 40, lastPractisedAt: '2026-10-29T20:00:00Z', recurringError: 'Uses Past Simple with since / for' },
      { id: 'g2', title: 'Conditionals (first)', accuracy: 84, attempts: 26, lastPractisedAt: '2026-10-27T19:00:00Z' },
      { id: 'g3', title: 'Comparatives', accuracy: 93, attempts: 50, lastPractisedAt: '2026-10-15T18:00:00Z' },
    ],
    weakTopics: [{ id: 'present-perfect', title: 'Present Perfect with since / for', accuracy: 71, attempts: 40 }],
    vocabulary: { learned: 240, due: 57, retention: 79, difficult: ['accomplish', 'deadline', 'in charge of'] },
    speaking: { sessions: 11, minutes: 96, recurringDifficulties: ['Long pauses before answers', 'Avoids Present Perfect in speech'] },
    listening: [{ id: 'l1', title: 'A job interview', score: 85, completedAt: '2026-10-26T18:00:00Z' }],
    assignments: [
      { id: 'as4', title: 'Interview practice: tell me about yourself', description: 'Record a 90-second answer.', dueAt: '2026-11-02T21:00:00Z', status: 'overdue', kind: 'speaking' },
    ],
    notes: [
      { id: 'n3', createdAt: '2026-10-30T21:00:00Z', body: 'Inactive for five days. Send a short check-in and reduce assignment size this week.' },
    ],
    history: [
      { id: 'h1', at: '2026-10-29T20:15:00Z', type: 'lesson', title: 'Present Perfect: since and for', detail: 'Scored 68%' },
      { id: 'h2', at: '2026-10-26T18:00:00Z', type: 'speaking', title: 'Interview preparation', detail: '7 min, 9 turns' },
      { id: 'h3', at: '2026-10-14T09:00:00Z', type: 'account', title: 'Account activated', detail: 'Accepted invitation' },
    ],
    settings: { levelOverride: 'B1', supportLanguage: 'az', feedbackStyle: 'fluency', aiDailyMinutes: 30 },
  }
}

export function findStudentProfile(id: string): DemoStudentProfile | undefined {
  return DEMO_STUDENT_PROFILES[id]
}

export const LEARNING_STATUS_LABEL: Record<LearningStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  needs_attention: 'Needs attention',
  invited: 'Invited',
  disabled: 'Disabled',
}
