import { describe, expect, it } from 'vitest'
import { grade, isAnswerComplete } from '@/features/exercises/engine/grade'
import { CURRICULUM } from './curriculum-map'
import { CLIENT_CURRICULUM_JSON } from './generated/client-curriculum'
import { CURRICULUM as APP_CURRICULUM } from './index'
import { isRedacted, redactAssessmentKeys, REDACTED } from './redact'

describe('redactAssessmentKeys', () => {
  const redacted = redactAssessmentKeys(CURRICULUM)
  const original = CURRICULUM.find((c) => c.id === 'a0-01')!
  const chapter = redacted.find((c) => c.id === 'a0-01')!

  it('removes answer keys from assessment lessons only', () => {
    const assessment = chapter.lessons.find((l) => l.kind === 'assessment')!
    const practice = chapter.lessons.find((l) => l.kind === 'grammar')!
    for (const exercise of assessment.exercises) {
      if (['multiple_choice', 'fill_blank', 'error_correction', 'question_formation', 'sentence_transformation', 'guided_writing'].includes(exercise.type)) {
        expect(isRedacted(exercise), exercise.id).toBe(true)
      }
    }
    expect(practice.exercises.some(isRedacted)).toBe(false)
    expect(practice).toEqual(original.lessons.find((l) => l.id === practice.id))
  })

  it('does not leak the key through the bundle text', () => {
    const assessment = chapter.lessons.find((l) => l.kind === 'assessment')!
    const text = JSON.stringify(assessment.exercises.filter((e) => e.type === 'fill_blank' || e.type === 'multiple_choice'))
    const originalKeys = original.lessons
      .find((l) => l.kind === 'assessment')!
      .exercises.flatMap((e) => (e.type === 'fill_blank' ? e.blanks.flatMap((b) => b.accepted) : []))
    expect(originalKeys.length).toBeGreaterThan(0)
    for (const key of originalKeys) expect(text.includes(`"${key}"`)).toBe(false)
    expect(text).toContain(REDACTED)
  })

  it('keeps redacted exercises renderable and answerable, but never gradable as correct', () => {
    const assessment = chapter.lessons.find((l) => l.kind === 'assessment')!
    const mcq = assessment.exercises.find((e) => e.type === 'multiple_choice')!
    expect(mcq.type === 'multiple_choice' && mcq.options.length).toBeGreaterThan(1)
    expect(isAnswerComplete(mcq, { type: 'multiple_choice', optionId: 'a' })).toBe(true)
    expect(grade(mcq, { type: 'multiple_choice', optionId: 'a' }).correct).toBe(false)
    const blank = assessment.exercises.find((e) => e.type === 'fill_blank')!
    if (blank.type === 'fill_blank') {
      expect(isAnswerComplete(blank, { type: 'fill_blank', values: blank.blanks.map(() => 'x') })).toBe(true)
    }
  })

  it('ships only redacted assessment keys to the app (generated client content, non-preview build)', () => {
    const client = JSON.parse(CLIENT_CURRICULUM_JSON) as { id: string; lessons: { kind: string; exercises: unknown[] }[] }[]
    expect(client).toHaveLength(CURRICULUM.length)
    const parsed = redactAssessmentKeys(CURRICULUM)
    expect(client).toEqual(JSON.parse(JSON.stringify(parsed)))
    // Under vitest VITE_UI_PREVIEW is unset, so the app curriculum is the redacted one.
    const appAssessment = APP_CURRICULUM.find((c) => c.id === 'a0-01')!.lessons.find((l) => l.kind === 'assessment')!
    expect(appAssessment.exercises.filter((e) => e.type === 'multiple_choice').every(isRedacted)).toBe(true)
  })

  it('leaves the original curriculum untouched', () => {
    const originalAssessment = original.lessons.find((l) => l.kind === 'assessment')!
    expect(originalAssessment.exercises.some(isRedacted)).toBe(false)
  })
})
