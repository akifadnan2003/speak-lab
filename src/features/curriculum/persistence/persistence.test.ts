import { beforeEach, describe, expect, it } from 'vitest'
import { correctAnswerFor } from '@/features/exercises/engine/test-answers'
import { ASSESSMENT_ATTEMPT_TTL_MS, MAX_ASSESSMENT_ATTEMPTS } from '../assessment-rules'
import { CURRICULUM } from '../content/curriculum-map'
import type { ExerciseAttemptRecord, LessonProgressRecord } from '../ports'
import { clearStoredProgress, createLocalStorageProgressRepository, PROGRESS_STORAGE_PREFIX } from './local-storage'
import { createMemoryAssessmentGateway, createMemoryProgressRepository, createMemoryStore } from './memory'

const NOW = '2026-11-03T10:00:00.000Z'
const progress = (studentId: string, lessonId: string, status: LessonProgressRecord['status'] = 'in_progress'): LessonProgressRecord => ({
  studentId,
  chapterId: 'a0-01',
  lessonId,
  status,
  updatedAt: NOW,
})
const attempt = (id: string, studentId = 's1'): ExerciseAttemptRecord => ({
  id,
  studentId,
  chapterId: 'a0-01',
  chapterVersion: 1,
  lessonId: 'a0-01-l01',
  exerciseId: 'a0-01-l01-e01',
  exerciseType: 'multiple_choice',
  attemptNumber: 1,
  answer: { type: 'multiple_choice', optionId: 'a' },
  correct: true,
  score: 1,
  hintUsed: false,
  createdAt: NOW,
})

describe('memory repository', () => {
  it('upserts lesson progress per student and lesson', async () => {
    const repo = createMemoryProgressRepository()
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01'))
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01', 'completed'))
    await repo.upsertLessonProgress(progress('s2', 'a0-01-l01'))
    const s1 = await repo.listLessonProgress('s1')
    expect(s1).toHaveLength(1)
    expect(s1[0]?.status).toBe('completed')
    expect(await repo.listLessonProgress('s2')).toHaveLength(1)
    expect(await repo.listLessonProgress('nobody')).toHaveLength(0)
  })

  it('records attempts idempotently and filters by lesson', async () => {
    const repo = createMemoryProgressRepository()
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt({ ...attempt('a2'), lessonId: 'a0-01-l02' })
    expect(await repo.listAttempts('s1')).toHaveLength(2)
    expect(await repo.listAttempts('s1', { lessonId: 'a0-01-l02' })).toHaveLength(1)
  })
})

describe('localStorage repository', () => {
  beforeEach(() => localStorage.clear())

  it('persists across repository instances and namespaces by student', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01', 'completed'))
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt(attempt('b1', 's2'))

    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:s1`)).toContain('"completed"')
    expect(localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:s2`)).not.toContain('"completed"')

    const fresh = createLocalStorageProgressRepository(localStorage)
    expect(await fresh.listLessonProgress('s1')).toHaveLength(1)
    expect(await fresh.listAttempts('s1')).toHaveLength(1)
    expect(await fresh.listAttempts('s2')).toHaveLength(1)
  })

  it('survives corrupted storage', async () => {
    localStorage.setItem(`${PROGRESS_STORAGE_PREFIX}:s1`, '{not json')
    const repo = createLocalStorageProgressRepository(localStorage)
    expect(await repo.listLessonProgress('s1')).toEqual([])
  })

  it('clearStoredProgress removes only SpeakLab progress keys', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.recordAttempt(attempt('a1'))
    await repo.recordAttempt(attempt('b1', 's2'))
    localStorage.setItem('speaklab.theme', 'dark')
    clearStoredProgress(localStorage)
    expect(await repo.listAttempts('s1')).toHaveLength(0)
    expect(await repo.listAttempts('s2')).toHaveLength(0)
    expect(localStorage.getItem('speaklab.theme')).toBe('dark')
  })

  it('falls back to memory without a Storage', async () => {
    const repo = createLocalStorageProgressRepository(undefined)
    await repo.upsertLessonProgress(progress('s1', 'a0-01-l01'))
    expect(await repo.listLessonProgress('s1')).toHaveLength(1)
  })
})

describe('chapter overrides (memory + localStorage)', () => {
  beforeEach(() => localStorage.clear())

  it('sets, replaces and clears an override per student and chapter', async () => {
    const repo = createLocalStorageProgressRepository(localStorage)
    await repo.setChapterOverride({ studentId: 's1', chapterId: 'a0-02', kind: 'unlock', createdAt: NOW, createdBy: 't1' })
    await repo.setChapterOverride({ studentId: 's1', chapterId: 'a0-02', kind: 'skip', createdAt: NOW, createdBy: 't1' })
    await repo.setChapterOverride({ studentId: 's2', chapterId: 'a0-02', kind: 'unlock', createdAt: NOW, createdBy: 't1' })
    expect(await repo.listChapterOverrides('s1')).toEqual([{ studentId: 's1', chapterId: 'a0-02', kind: 'skip', createdAt: NOW }])
    await repo.clearChapterOverride('s1', 'a0-02')
    expect(await repo.listChapterOverrides('s1')).toEqual([])
    expect(await repo.listChapterOverrides('s2')).toHaveLength(1)
  })

  it('refuses to record an assessment lesson as plain progress', async () => {
    const repo = createMemoryProgressRepository()
    await expect(repo.upsertLessonProgress(progress('s1', 'a0-01-l11', 'completed'))).rejects.toThrow(/assessment gateway/)
  })
})

describe('memory assessment gateway (reference behaviour for the server)', () => {
  const CHAPTER = 'a0-01'
  const LESSON = 'a0-01-l11'
  const correctAnswers = () => {
    const lesson = CURRICULUM.find((c) => c.id === CHAPTER)!.lessons.find((l) => l.id === LESSON)!
    return lesson.exercises.map((exercise) => ({ exerciseId: exercise.id, answer: correctAnswerFor(exercise) }))
  }

  it('grades a submission, records it as progress, and hides answers after a fail', async () => {
    const store = createMemoryStore()
    const gateway = createMemoryAssessmentGateway(store, undefined, CURRICULUM)
    const repo = createMemoryProgressRepository(store, undefined, CURRICULUM)
    const started = await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
    expect(started.attemptsUsed).toBe(0)
    expect(started.attempt.status).toBe('in_progress')
    // Starting again returns the same open attempt (idempotent).
    expect((await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })).attempt.id).toBe(started.attempt.id)

    const failed = await gateway.submit({ studentId: 's1', attemptId: started.attempt.id, answers: [] })
    expect(failed.attempt).toMatchObject({ status: 'submitted', score: 0, passed: false, attemptNumber: 1 })
    expect(failed.revealAnswers).toBe(false)
    expect(failed.results.every((r) => r.correctAnswer === undefined)).toBe(true)
    expect(failed.attemptsUsed).toBe(1)
    const merged = await repo.listLessonProgress('s1')
    expect(merged.find((r) => r.lessonId === LESSON)).toMatchObject({ status: 'in_progress', bestScore: 0 })

    // Submitting the same attempt again is idempotent: the stored answers win.
    const again = await gateway.submit({ studentId: 's1', attemptId: started.attempt.id, answers: correctAnswers() })
    expect(again.attempt.score).toBe(0)
  })

  it('reveals answers on a pass and marks the lesson completed', async () => {
    const store = createMemoryStore()
    const gateway = createMemoryAssessmentGateway(store, undefined, CURRICULUM)
    const opened = await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
    const passed = await gateway.submit({ studentId: 's1', attemptId: opened.attempt.id, answers: correctAnswers() })
    expect(passed.attempt.passed).toBe(true)
    expect(passed.attempt.score).toBe(100)
    expect(passed.revealAnswers).toBe(true)
    expect(passed.results.every((r) => r.correct && typeof r.correctAnswer === 'string')).toBe(true)
    const merged = await createMemoryProgressRepository(store, undefined, CURRICULUM).listLessonProgress('s1')
    expect(merged.find((r) => r.lessonId === LESSON)).toMatchObject({ status: 'completed', bestScore: 100 })
  })

  it('enforces the retake limit, discloses answers on the last attempt, and a tutor reset restarts the count', async () => {
    const store = createMemoryStore()
    const gateway = createMemoryAssessmentGateway(store, undefined, CURRICULUM)
    for (let i = 1; i <= MAX_ASSESSMENT_ATTEMPTS; i++) {
      const opened = await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
      expect(opened.attemptsUsed).toBe(i - 1)
      const result = await gateway.submit({ studentId: 's1', attemptId: opened.attempt.id, answers: [] })
      expect(result.revealAnswers).toBe(i === MAX_ASSESSMENT_ATTEMPTS)
    }
    await expect(gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })).rejects.toThrow(/No attempts left/)
    await gateway.reset({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
    const fresh = await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
    expect(fresh.attemptsUsed).toBe(0)
    expect(fresh.attempt.attemptNumber).toBe(1)
    expect((await gateway.listAttempts('s1', { lessonId: LESSON })).filter((a) => a.status === 'voided')).toHaveLength(MAX_ASSESSMENT_ATTEMPTS)
  })

  it('voids an expired open attempt instead of resuming it', async () => {
    let now = Date.parse('2026-11-11T10:00:00.000Z')
    const gateway = createMemoryAssessmentGateway(createMemoryStore(), undefined, CURRICULUM, () => now)
    const first = await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
    now += ASSESSMENT_ATTEMPT_TTL_MS + 1000
    const second = await gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: LESSON })
    expect(second.attempt.id).not.toBe(first.attempt.id)
    expect(second.attemptsUsed).toBe(0)
    await expect(gateway.submit({ studentId: 's1', attemptId: first.attempt.id, answers: [] })).rejects.toThrow(/cancelled/)
  })

  it('refuses non-assessment lessons', async () => {
    const gateway = createMemoryAssessmentGateway(undefined, undefined, CURRICULUM)
    await expect(gateway.start({ studentId: 's1', chapterId: CHAPTER, lessonId: 'a0-01-l01' })).rejects.toThrow(/not an assessment/)
  })
})
