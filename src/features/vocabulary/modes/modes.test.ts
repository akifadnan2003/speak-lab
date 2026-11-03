import { describe, expect, it } from 'vitest'
import { VOCABULARY_BANK } from '../content'
import { grade } from '@/features/exercises/engine/grade'
import { blankOut, buildMatching, buildMeaningChoice, buildMissingWord, buildSentenceCompletion, findMode, pickDistractors, supportsBlank, VOCABULARY_MODES } from './index'

const hello = VOCABULARY_BANK.find((e) => e.id === 'v-hello')!
const study = VOCABULARY_BANK.find((e) => e.id === 'v-revise')!

describe('vocabulary bank', () => {
  it('has at least 170 validated entries across all 13 topics with Azerbaijani support', () => {
    expect(VOCABULARY_BANK.length).toBeGreaterThanOrEqual(170)
    const topics = new Set(VOCABULARY_BANK.flatMap((e) => e.topics))
    expect(topics.size).toBe(13)
    expect(VOCABULARY_BANK.every((e) => e.translations.az)).toBe(true)
    expect(VOCABULARY_BANK.every((e) => ['A0', 'A1', 'A2'].includes(e.level))).toBe(true)
  })

  it('every entry can be blanked for missing-word practice', () => {
    const failing = VOCABULARY_BANK.filter((e) => !supportsBlank(e)).map((e) => e.id)
    expect(failing).toEqual([])
  })
})

describe('mode registry', () => {
  it('has six available modes plus two honest placeholders', () => {
    expect(VOCABULARY_MODES.filter((m) => m.available)).toHaveLength(6)
    const unavailable = VOCABULARY_MODES.filter((m) => !m.available)
    expect(unavailable.map((m) => m.id)).toEqual(['listening', 'speaking'])
    expect(unavailable.every((m) => m.unavailableReason)).toBe(true)
    expect(findMode('nope')).toBeUndefined()
  })
})

describe('builders', () => {
  it('blankOut respects word boundaries and inflections', () => {
    expect(blankOut('I revise for two hours every evening.', 'revise')).toEqual({ text: 'I ___ for two hours every evening.', answer: 'revise' })
    expect(blankOut('She studies at night.', 'study')).toEqual({ text: 'She ___ at night.', answer: 'studies' })
    expect(blankOut('The cat sat.', 'at')).toBeNull()
    expect(blankOut("It's half past seven.", 'half past')).toEqual({ text: "It's ___ seven.", answer: 'half past' })
  })

  it('distractors are deterministic, distinct and prefer the same part of speech', () => {
    const name = VOCABULARY_BANK.find((e) => e.id === 'v-name')!
    const a = pickDistractors(name, VOCABULARY_BANK, 3)
    const b = pickDistractors(name, VOCABULARY_BANK, 3)
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id))
    expect(new Set(a.map((e) => e.id)).size).toBe(3)
    expect(a.every((e) => e.id !== name.id)).toBe(true)
    expect(a.every((e) => e.partOfSpeech === 'noun')).toBe(true)
    // Falls back across parts of speech when the same one is scarce (only two interjections exist).
    expect(pickDistractors(hello, VOCABULARY_BANK, 3)).toHaveLength(3)
  })

  it('meaning choice grades the definition as correct', () => {
    const ex = buildMeaningChoice(hello, VOCABULARY_BANK)
    expect(ex.type).toBe('multiple_choice')
    if (ex.type !== 'multiple_choice') return
    expect(ex.options).toHaveLength(4)
    const correct = ex.options.find((o) => o.text === hello.definition)!
    expect(grade(ex, { type: 'multiple_choice', optionId: correct.id }).correct).toBe(true)
  })

  it('sentence completion and missing word use the first example', () => {
    const sc = buildSentenceCompletion(study, VOCABULARY_BANK)!
    expect(sc.type === 'multiple_choice' && sc.prompt).toBe('I ___ for two hours every evening.')
    const mw = buildMissingWord(study)!
    expect(mw.type).toBe('fill_blank')
    expect(grade(mw, { type: 'fill_blank', values: ['Revise'] }).correct).toBe(true)
    expect(mw.hint?.en).toContain('6 letters')
  })

  it('matching pairs are keyed by entry id so each pair maps back to a word', () => {
    const group = VOCABULARY_BANK.slice(0, 4)
    const ex = buildMatching(group)!
    expect(ex.type).toBe('matching')
    if (ex.type !== 'matching') return
    expect(ex.pairs.map((p) => p.id)).toEqual(group.map((e) => e.id))
    const result = grade(ex, { type: 'matching', matches: Object.fromEntries(group.map((e) => [e.id, e.id])) })
    expect(result.correct).toBe(true)
    expect(buildMatching(group.slice(0, 1))).toBeNull()
  })
})
