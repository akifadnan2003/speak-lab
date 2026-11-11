import { describe, expect, it } from 'vitest'
import {
  assessmentLessonIndex,
  attemptsRemaining,
  countUsedAttempts,
  MAX_ASSESSMENT_ATTEMPTS,
  mergeAssessmentResults,
  openAttempt,
  revealAnswersAfter,
} from './assessment-rules'
import { CURRICULUM } from './content'
import type { AssessmentAttemptSummary, LessonProgressRecord } from './ports'

const base: AssessmentAttemptSummary = {
  id: 'att-1',
  studentId: 's1',
  chapterId: 'a0-01',
  chapterVersion: 1,
  lessonId: 'a0-01-l11',
  attemptNumber: 1,
  status: 'submitted',
  passMark: 80,
  score: 60,
  passed: false,
  startedAt: '2026-11-11T10:00:00.000Z',
  expiresAt: '2026-11-11T12:00:00.000Z',
  submittedAt: '2026-11-11T10:20:00.000Z',
}

describe('assessment rules', () => {
  it('indexes every assessment lesson in the curriculum', () => {
    const index = assessmentLessonIndex(CURRICULUM)
    expect(index.has('a0-01/a0-01-l11')).toBe(true)
    expect(index.has('a2-07/a2-07-l05')).toBe(true)
    expect(index.has('a0-01/a0-01-l01')).toBe(false)
  })

  it('discloses answers only after a pass or when the last attempt is used', () => {
    expect(revealAnswersAfter(false, 1)).toBe(false)
    expect(revealAnswersAfter(false, MAX_ASSESSMENT_ATTEMPTS - 1)).toBe(false)
    expect(revealAnswersAfter(false, MAX_ASSESSMENT_ATTEMPTS)).toBe(true)
    expect(revealAnswersAfter(true, 1)).toBe(true)
    expect(attemptsRemaining(0)).toBe(MAX_ASSESSMENT_ATTEMPTS)
    expect(attemptsRemaining(MAX_ASSESSMENT_ATTEMPTS + 5)).toBe(0)
  })

  it('counts only submitted attempts of the current chapter version', () => {
    const attempts: AssessmentAttemptSummary[] = [
      base,
      { ...base, id: 'att-2', status: 'voided' },
      { ...base, id: 'att-3', status: 'in_progress', score: undefined, passed: undefined, submittedAt: undefined },
      { ...base, id: 'att-4', chapterVersion: 2 },
    ]
    expect(countUsedAttempts(attempts, 1)).toBe(1)
    expect(countUsedAttempts(attempts, 2)).toBe(1)
  })

  it('finds the open attempt only while it has not expired', () => {
    const open: AssessmentAttemptSummary = { ...base, id: 'open', status: 'in_progress', score: undefined, passed: undefined, submittedAt: undefined }
    expect(openAttempt([base, open], Date.parse('2026-11-11T11:00:00.000Z'))?.id).toBe('open')
    expect(openAttempt([base, open], Date.parse('2026-11-11T13:00:00.000Z'))).toBeUndefined()
  })

  it('synthesises assessment progress from attempts and drops client rows that claim an assessment', () => {
    const index = assessmentLessonIndex(CURRICULUM)
    const forged: LessonProgressRecord = {
      studentId: 's1',
      chapterId: 'a0-01',
      lessonId: 'a0-01-l11',
      status: 'completed',
      bestScore: 100,
      updatedAt: 'x',
    }
    const practice: LessonProgressRecord = { studentId: 's1', chapterId: 'a0-01', lessonId: 'a0-01-l01', status: 'completed', bestScore: 90, updatedAt: 'x' }
    const merged = mergeAssessmentResults(
      [forged, practice],
      [base, { ...base, id: 'att-2', attemptNumber: 2, score: 85, passed: true, submittedAt: '2026-11-11T11:00:00.000Z' }],
      index,
    )
    expect(merged).toHaveLength(2)
    expect(merged.find((r) => r.lessonId === 'a0-01-l01')).toEqual(practice)
    const assessment = merged.find((r) => r.lessonId === 'a0-01-l11')
    expect(assessment).toMatchObject({ status: 'completed', bestScore: 85, lastScore: 85, completedAt: '2026-11-11T11:00:00.000Z' })
  })

  it('keeps a failed assessment in progress with its best score', () => {
    const merged = mergeAssessmentResults([], [base, { ...base, id: 'att-2', score: 40, submittedAt: '2026-11-11T11:00:00.000Z' }], assessmentLessonIndex(CURRICULUM))
    expect(merged[0]).toMatchObject({ status: 'in_progress', bestScore: 60, lastScore: 40, completedAt: undefined })
  })
})
