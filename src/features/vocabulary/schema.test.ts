import { describe, expect, it } from 'vitest'
import { containsTerm, parseVocabularyBank, VocabularyBankSchema, VocabularyEntrySchema } from './schema'

const base = {
  id: 'v-apple',
  term: 'apple',
  partOfSpeech: 'noun' as const,
  definition: 'a round fruit',
  examples: ['I eat an apple every day.'],
  level: 'A0' as const,
  topics: ['food' as const],
}

describe('VocabularyEntrySchema', () => {
  it('applies defaults and keeps translations optional', () => {
    const entry = VocabularyEntrySchema.parse(base)
    expect(entry.kind).toBe('word')
    expect(entry.translations).toEqual({})
    expect(entry.synonyms).toEqual([])
    expect(entry.chapterIds).toEqual([])
  })

  it('accepts the full shape', () => {
    const entry = VocabularyEntrySchema.parse({
      ...base,
      kind: 'word',
      translations: { az: 'alma' },
      pronunciation: { respelling: 'AP-uhl', ipa: 'ˈæp.əl' },
      synonyms: [],
      antonyms: [],
      collocations: ['green apple'],
      wordFamily: ['apple tree'],
      grammarNote: { en: 'Countable: an apple, two apples.', az: 'Sayıla bilən: an apple, two apples.' },
      tags: ['fruit'],
      chapterIds: ['a0-03'],
    })
    expect(entry.translations.az).toBe('alma')
  })

  it('rejects unknown languages, topics and bad audio urls', () => {
    expect(VocabularyEntrySchema.safeParse({ ...base, translations: { tr: 'elma' } }).success).toBe(false)
    expect(VocabularyEntrySchema.safeParse({ ...base, topics: ['sports'] }).success).toBe(false)
    expect(VocabularyEntrySchema.safeParse({ ...base, pronunciation: { audioUrl: 'not a url' } }).success).toBe(false)
    expect(VocabularyEntrySchema.safeParse({ ...base, examples: [] }).success).toBe(false)
  })
})

describe('VocabularyBankSchema', () => {
  it('rejects duplicate ids and duplicate term + part of speech', () => {
    expect(VocabularyBankSchema.safeParse([base, { ...base, term: 'pear', examples: ['A pear.'] }]).success).toBe(false)
    expect(VocabularyBankSchema.safeParse([base, { ...base, id: 'v-apple-2' }]).success).toBe(false)
    expect(VocabularyBankSchema.safeParse([base, { ...base, id: 'v-apple-verb', partOfSpeech: 'verb' }]).success).toBe(true)
  })

  it('requires the first example to contain the term, allowing simple inflections', () => {
    expect(VocabularyBankSchema.safeParse([{ ...base, examples: ['I like fruit.'] }]).success).toBe(false)
    expect(containsTerm('She studies at night.', 'study')).toBe(true)
    expect(containsTerm('We are going home.', 'to go')).toBe(true)
    expect(containsTerm('Two apples, please.', 'apple')).toBe(true)
    expect(containsTerm('Nothing here.', 'apple')).toBe(false)
  })

  it('accepts an empty bank', () => {
    expect(parseVocabularyBank([])).toEqual([])
  })
})
