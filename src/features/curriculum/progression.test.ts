import { describe, expect, it } from 'vitest'
import { CURRICULUM } from './content'
import type { LessonProgressRecord } from './ports'
import { computeProgression, currentChapter, evaluateChapterCompletion, nextLesson, scoreLesson } from './progression'

const a0_01 = CURRICULUM.find((c) => c.id === 'a0-01')!
const NOW = '2026-11-03T10:00:00.000Z'

function record(lessonId: string, status: LessonProgressRecord['status'], bestScore?: number): LessonProgressRecord {
  return { studentId: 's1', chapterId: 'a0-01', lessonId, status, bestScore, updatedAt: NOW }
}

function completeAll(except: string[] = [], assessmentScore = 90): LessonProgressRecord[] {
  return a0_01.lessons
    .filter((l) => !except.includes(l.id))
    .map((l) => record(l.id, 'completed', l.kind === 'assessment' ? assessmentScore : 100))
}

describe('computeProgression', () => {
  it('unlocks only the first chapter for a new student and locks the assessment', () => {
    const states = computeProgression({ chapters: CURRICULUM, lessonProgress: [] })
    expect(states.get('a0-01')?.status).toBe('available')
    expect(states.get('a0-02')?.status).toBe('locked')
    expect(states.get('a0-02')?.missingPrerequisites).toEqual(['a0-01'])
    const first = states.get('a0-01')!
    expect(first.progress).toBe(0)
    expect(first.lessons.find((l) => l.lesson.kind === 'assessment')?.status).toBe('locked')
    expect(first.lessons.filter((l) => l.lesson.kind !== 'assessment').every((l) => l.status === 'available')).toBe(true)
    expect(nextLesson(first)?.lesson.id).toBe('a0-01-l01')
    expect(currentChapter(states)?.chapter.id).toBe('a0-01')
  })

  it('reports in-progress, progress percent and the next lesson', () => {
    const states = computeProgression({
      chapters: CURRICULUM,
      lessonProgress: [record('a0-01-l01', 'completed', 92), record('a0-01-l02', 'in_progress')],
    })
    const first = states.get('a0-01')!
    expect(first.status).toBe('in_progress')
    expect(first.progress).toBe(Math.round((1 / a0_01.lessons.length) * 100))
    expect(nextLesson(first)?.lesson.id).toBe('a0-01-l02')
  })

  it('unlocks the assessment when every other lesson is done', () => {
    const states = computeProgression({ chapters: CURRICULUM, lessonProgress: completeAll(['a0-01-l11']) })
    const first = states.get('a0-01')!
    expect(first.lessons.find((l) => l.lesson.kind === 'assessment')?.status).toBe('available')
    expect(first.status).toBe('in_progress')
  })

  it('completes the chapter and unlocks the next only when the assessment passes', () => {
    const failed = computeProgression({ chapters: CURRICULUM, lessonProgress: completeAll([], 70) })
    expect(failed.get('a0-01')?.status).toBe('in_progress')
    expect(failed.get('a0-02')?.status).toBe('locked')

    const passed = computeProgression({ chapters: CURRICULUM, lessonProgress: completeAll([], 80) })
    expect(passed.get('a0-01')?.status).toBe('completed')
    expect(passed.get('a0-01')?.assessmentBestScore).toBe(80)
    expect(passed.get('a0-02')?.status).toBe('available')
    expect(passed.get('a0-03')?.status).toBe('locked')
  })

  it('does not complete a chapter when a speaking lesson was skipped', () => {
    const progress = completeAll(['a0-01-l07']).concat(record('a0-01-l07', 'skipped'))
    const states = computeProgression({ chapters: CURRICULUM, lessonProgress: progress })
    expect(states.get('a0-01')?.status).toBe('in_progress')
    expect(evaluateChapterCompletion(a0_01, states.get('a0-01')!.lessons)).toBe(false)
  })

  it('honours tutor unlock and skip overrides', () => {
    const states = computeProgression({
      chapters: CURRICULUM,
      lessonProgress: [],
      overrides: [
        { studentId: 's1', chapterId: 'a0-01', kind: 'skip', createdAt: NOW },
        { studentId: 's1', chapterId: 'a1-03', kind: 'unlock', createdAt: NOW },
      ],
    })
    expect(states.get('a0-01')?.status).toBe('skipped')
    expect(states.get('a0-02')?.status).toBe('available')
    expect(states.get('a1-03')?.status).toBe('available')
    expect(states.get('a1-04')?.status).toBe('locked')
  })

  it('planned chapters never count as complete', () => {
    const planned = CURRICULUM.find((c) => c.status === 'planned')!
    expect(evaluateChapterCompletion(planned, [])).toBe(false)
  })
})

describe('scoreLesson', () => {
  it('averages 0..1 scores to a rounded percent and clamps', () => {
    expect(scoreLesson([1, 0.5, 0])).toBe(50)
    expect(scoreLesson([])).toBe(0)
    expect(scoreLesson([2, -1])).toBe(50)
  })
})
