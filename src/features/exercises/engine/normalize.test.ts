import { describe, expect, it } from 'vitest'
import { containsPhrase, countWords, matchesAccepted, normalizeText } from './normalize'

describe('normalizeText', () => {
  it('ignores case, extra spaces and a trailing full stop', () => {
    expect(normalizeText('  She IS   a doctor.  ')).toBe('she is a doctor')
  })

  it('converts curly apostrophes and quotes', () => {
    expect(normalizeText('I’m fine')).toBe("i'm fine")
    expect(normalizeText('“Hello”')).toBe('"hello"')
  })

  it('removes a space before punctuation', () => {
    expect(normalizeText('Are you tired ?', { keepQuestionMark: true })).toBe('are you tired?')
  })

  it('drops a trailing question mark by default but keeps it when asked', () => {
    expect(normalizeText('Are you tired?')).toBe('are you tired')
    expect(normalizeText('Are you tired?', { keepQuestionMark: true })).toBe('are you tired?')
    expect(normalizeText('Are you tired.', { keepQuestionMark: true })).toBe('are you tired')
  })

  it('does not forgive missing apostrophes or word order', () => {
    expect(normalizeText('Im fine')).not.toBe(normalizeText("I'm fine"))
    expect(normalizeText('a student I am')).not.toBe(normalizeText('I am a student'))
  })
})

describe('matchesAccepted', () => {
  it('matches any accepted variant', () => {
    expect(matchesAccepted("she's not from Baku", ['She is not from Baku.', "She's not from Baku."])).toBe(true)
    expect(matchesAccepted('she not from Baku', ['She is not from Baku.'])).toBe(false)
  })

  it('rejects empty input', () => {
    expect(matchesAccepted('   ', ['anything'])).toBe(false)
  })
})

describe('countWords / containsPhrase', () => {
  it('counts words including contractions as one word', () => {
    expect(countWords("Hi! I'm Nigar, I'm 22.")).toBe(5)
    expect(countWords('')).toBe(0)
  })

  it('finds phrases case-insensitively', () => {
    expect(containsPhrase("My name is Nigar. I'M not married.", "i'm not")).toBe(true)
    expect(containsPhrase('My name is Nigar.', 'years old')).toBe(false)
  })
})
