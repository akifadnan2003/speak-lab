import { describe, expect, it } from 'vitest'
import { ExerciseSchema, type Exercise } from '@/features/curriculum/schema'
import { ec, fb, gw, match, mc, ord, qf, sp, st, t } from '@/features/curriculum/content/authoring'
import { emptyAnswer, fillTemplate, grade, isAnswerComplete } from './grade'

const parse = (input: unknown): Exercise => ExerciseSchema.parse(input)

describe('grade: multiple choice', () => {
  const ex = parse(mc('x-mc', 'I ___ a student.', ['is', 'am', 'are'], 1))
  it('is correct only for the right option', () => {
    expect(grade(ex, { type: 'multiple_choice', optionId: 'b' })).toMatchObject({ correct: true, score: 1, correctAnswer: 'am' })
    expect(grade(ex, { type: 'multiple_choice', optionId: 'a' })).toMatchObject({ correct: false, score: 0 })
  })
})

describe('grade: fill in the blanks', () => {
  const ex = parse(fb('x-fb', 'You ___ my teacher and he ___ my friend.', ['are', ['is', "'s"]]))
  it('gives partial credit per blank and reports which blank failed', () => {
    const result = grade(ex, { type: 'fill_blank', values: ['Are ', 'am'] })
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0.5)
    expect(result.parts?.map((p) => p.correct)).toEqual([true, false])
    expect(result.correctAnswer).toBe('You are my teacher and he is my friend.')
  })
  it('accepts alternatives', () => {
    expect(grade(ex, { type: 'fill_blank', values: ['are', "'s"] }).correct).toBe(true)
  })
  it('fillTemplate replaces markers in order', () => {
    expect(fillTemplate('a ___ b ___', ['1', '2'])).toBe('a 1 b 2')
  })
})

describe('grade: sentence ordering', () => {
  const ex = parse(ord('x-ord', 'Where are you from?'))
  it('accepts the exact order and rejects others', () => {
    expect(grade(ex, { type: 'sentence_ordering', order: [0, 1, 2, 3] }).correct).toBe(true)
    const wrong = grade(ex, { type: 'sentence_ordering', order: [1, 0, 2, 3] })
    expect(wrong.correct).toBe(false)
    expect(wrong.parts?.map((p) => p.correct)).toEqual([false, false, true, true])
  })
  it('rejects incomplete orders', () => {
    expect(grade(ex, { type: 'sentence_ordering', order: [0, 1] }).correct).toBe(false)
  })
  it('accepts authored alternatives', () => {
    const alt = parse(ord('x-ord2', 'I am not tired.', { alternatives: ['Not I am tired.'] }))
    expect(grade(alt, { type: 'sentence_ordering', order: [2, 0, 1, 3] }).correct).toBe(true)
  })
})

describe('grade: error correction', () => {
  const ex = parse(ec('x-ec', 'He are a teacher.', ['He is a teacher.', "He's a teacher."]))
  it('matches corrected forms loosely on punctuation and case', () => {
    expect(grade(ex, { type: 'error_correction', text: 'he is a teacher' }).correct).toBe(true)
    expect(grade(ex, { type: 'error_correction', text: 'He are a teacher.' }).correct).toBe(false)
  })
})

describe('grade: matching', () => {
  const ex = parse(
    match('x-m', [
      ['my father', 'he'],
      ['my sister', 'she'],
      ['the car', 'it'],
    ]),
  )
  it('scores by pair', () => {
    const result = grade(ex, { type: 'matching', matches: { p1: 'p1', p2: 'p3', p3: 'p2' } })
    expect(result.correct).toBe(false)
    expect(result.score).toBeCloseTo(1 / 3)
    expect(grade(ex, { type: 'matching', matches: { p1: 'p1', p2: 'p2', p3: 'p3' } }).correct).toBe(true)
  })
})

describe('grade: question formation', () => {
  const ex = parse(qf('x-qf', 'You are a student.', ['Are you a student?']))
  it('requires a question mark', () => {
    expect(grade(ex, { type: 'question_formation', text: 'are you a student?' }).correct).toBe(true)
    expect(grade(ex, { type: 'question_formation', text: 'Are you a student' }).correct).toBe(false)
    expect(grade(ex, { type: 'question_formation', text: 'You are a student?' }).correct).toBe(false)
  })
})

describe('grade: sentence transformation', () => {
  const ex = parse(st('x-st', 'I am a teacher.', t('Make it negative.'), ['I am not a teacher.', "I'm not a teacher."]))
  it('accepts any authored variant', () => {
    expect(grade(ex, { type: 'sentence_transformation', text: "I'm not a teacher" }).correct).toBe(true)
    expect(grade(ex, { type: 'sentence_transformation', text: 'I not a teacher' }).correct).toBe(false)
  })
})

describe('grade: speaking prompt (self-check)', () => {
  const ex = parse(sp('x-sp', t('Say your name.'), "Hi, I'm Leyla.", ['Used I\'m', 'Said name']))
  it('is complete only when done and every item is ticked', () => {
    expect(grade(ex, { type: 'speaking_prompt', done: true, checklist: [true, true] }).correct).toBe(true)
    expect(grade(ex, { type: 'speaking_prompt', done: true, checklist: [true, false] })).toMatchObject({ correct: false, score: 0.5 })
    expect(grade(ex, { type: 'speaking_prompt', done: false, checklist: [true, true] }).score).toBe(0)
  })
})

describe('grade: guided writing', () => {
  const ex = parse(
    gw('x-gw', t('Write about you.'), 10, [
      { label: 'name', anyOf: ['my name is', "i'm"] },
      { label: 'negative', anyOf: ["i'm not", "isn't"] },
    ]),
  )
  it('checks word count and required elements deterministically', () => {
    const good = grade(ex, { type: 'guided_writing', text: "My name is Nigar. I'm from Baku and I'm not married. I am a student here." })
    expect(good.correct).toBe(true)
    const short = grade(ex, { type: 'guided_writing', text: "I'm Nigar." })
    expect(short.correct).toBe(false)
    expect(short.parts?.map((p) => p.correct)).toEqual([false, true, false])
  })
})

describe('answer helpers', () => {
  it('emptyAnswer produces an incomplete answer for each type', () => {
    for (const input of [
      mc('a', 'p', ['x', 'y'], 0),
      fb('b', 'x ___', ['y']),
      ord('c', 'a b'),
      ec('d', 'x', ['y']),
      match('e', [['a', 'b'], ['c', 'd']]),
      qf('f', 'x', ['y?']),
      st('g', 'x', t('y'), ['z']),
      sp('h', t('x'), 'y', ['z']),
      gw('i', t('x'), 1, [{ label: 'l', anyOf: ['a'] }]),
    ]) {
      const ex = parse(input)
      const answer = emptyAnswer(ex)
      expect(answer.type).toBe(ex.type)
      // Speaking prompts are self-checked: Done is always allowed, the checklist decides the grade.
      expect(isAnswerComplete(ex, answer)).toBe(ex.type === 'speaking_prompt')
    }
  })

  it('throws on mismatched answer type', () => {
    expect(() => grade(parse(mc('a', 'p', ['x', 'y'], 0)), { type: 'error_correction', text: 'x' })).toThrow()
  })
})
