import { describe, expect, it } from 'vitest'
import { CHAPTERS_PER_LEVEL, CURRICULUM, findChapterSync, findLessonSync } from './index'
import { CEFR_LEVELS, CurriculumSchema, topologicalOrder } from '../schema'

describe('curriculum map', () => {
  it('contains 70 chapters across six levels in order', () => {
    expect(CURRICULUM).toHaveLength(70)
    expect(CHAPTERS_PER_LEVEL).toEqual({ A0: 8, A1: 10, A2: 12, B1: 14, B2: 14, C1: 12 })
    const levels = CURRICULUM.map((c) => c.level)
    const sorted = [...levels].sort((a, b) => CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b))
    expect(levels).toEqual(sorted)
  })

  it('numbers chapters consecutively inside each level', () => {
    for (const level of CEFR_LEVELS) {
      const numbers = CURRICULUM.filter((c) => c.level === level).map((c) => c.number)
      expect(numbers).toEqual(numbers.map((_, i) => i + 1))
    }
  })

  it('is prerequisite ordered with no cycles and all prerequisites earlier in the list', () => {
    expect(topologicalOrder(CURRICULUM)).not.toBeNull()
    const seen = new Set<string>()
    for (const chapter of CURRICULUM) {
      for (const p of chapter.prerequisites) expect(seen.has(p), `${chapter.id} requires later ${p}`).toBe(true)
      seen.add(chapter.id)
    }
  })

  it('validates against the curriculum schema', () => {
    expect(() => CurriculumSchema.parse(CURRICULUM)).not.toThrow()
  })

  it('rejects a cycle and an unknown prerequisite', () => {
    const [a, b] = CURRICULUM
    expect(
      CurriculumSchema.safeParse([
        { ...a!, prerequisites: [b!.id] },
        { ...b!, prerequisites: [a!.id] },
      ]).success,
    ).toBe(false)
    expect(CurriculumSchema.safeParse([{ ...a!, prerequisites: ['zz-99'] }]).success).toBe(false)
  })

  it('every chapter has objectives and skills; planned chapters have no lessons', () => {
    for (const chapter of CURRICULUM) {
      expect(chapter.objectives.length).toBeGreaterThan(0)
      expect(chapter.skills.length).toBeGreaterThan(0)
      if (chapter.status === 'planned') expect(chapter.lessons).toHaveLength(0)
    }
  })
})

describe('chapter A0-01', () => {
  const chapter = findChapterSync('a0-01')!

  it('is authored with the required lesson kinds', () => {
    expect(chapter.status).toBe('authored')
    const kinds = chapter.lessons.map((l) => l.kind)
    expect(kinds).toContain('grammar')
    expect(kinds).toContain('vocabulary')
    expect(kinds).toContain('pronunciation')
    expect(kinds).toContain('speaking')
    expect(kinds).toContain('reading')
    expect(kinds).toContain('writing')
    expect(kinds.filter((k) => k === 'assessment')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'speaking').length).toBeGreaterThanOrEqual(2)
  })

  it('covers every exercise type in the brief', () => {
    const types = new Set(chapter.lessons.flatMap((l) => l.exercises.map((e) => e.type)))
    for (const type of [
      'multiple_choice',
      'fill_blank',
      'sentence_ordering',
      'error_correction',
      'matching',
      'question_formation',
      'sentence_transformation',
      'speaking_prompt',
      'guided_writing',
    ]) {
      expect(types.has(type as never), type).toBe(true)
    }
  })

  it('has extensive practice: at least 120 exercises and 18 speaking prompts', () => {
    const all = chapter.lessons.flatMap((l) => l.exercises)
    expect(all.length).toBeGreaterThanOrEqual(120)
    expect(all.filter((e) => e.type === 'speaking_prompt').length).toBeGreaterThanOrEqual(18)
  })

  it('keeps English primary with Azerbaijani only as optional explanation', () => {
    const paragraphs = chapter.lessons.flatMap((l) => l.blocks).filter((b) => b.type === 'paragraph')
    expect(paragraphs.length).toBeGreaterThan(0)
    for (const p of paragraphs) expect(p.text.en.length).toBeGreaterThan(0)
    const withAz = paragraphs.filter((p) => p.text.az)
    expect(withAz.length).toBeGreaterThan(0)
  })

  it('resolves lessons by id', () => {
    expect(findLessonSync('a0-01', 'a0-01-l02')?.lesson.title).toBe('am, is, are')
    expect(findLessonSync('a0-01', 'nope')).toBeUndefined()
    expect(findLessonSync('a0-02', 'a0-01-l02')).toBeUndefined()
  })

  it('ids are unique across the whole chapter', () => {
    const ids = chapter.lessons.flatMap((l) => [l.id, ...l.exercises.map((e) => e.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
