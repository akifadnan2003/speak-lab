import { z } from 'zod'
import { CefrLevelSchema, ContentIdSchema, LocalizedTextSchema } from '@/features/curriculum/schema'

/**
 * Vocabulary content model.
 *
 * English is the teaching language: `definition`, `examples` and notes are
 * English. Support-language material lives in `translations`, keyed by
 * language code, and nothing in it is mandatory, so new support languages
 * are a one-line change to `SUPPORT_LANGUAGES`.
 */

export const SUPPORT_LANGUAGES = ['az'] as const
export const SupportLanguageSchema = z.enum(SUPPORT_LANGUAGES)
export type SupportLanguage = z.infer<typeof SupportLanguageSchema>

export const SUPPORT_LANGUAGE_LABEL: Record<SupportLanguage, string> = { az: 'Azerbaijani' }

export const VOCAB_TOPICS = [
  'introductions',
  'family',
  'personality',
  'emotions',
  'daily_routines',
  'university_life',
  'food',
  'travel',
  'directions',
  'common_verbs',
  'descriptions',
  'time_expressions',
  'communication',
] as const
export const VocabTopicSchema = z.enum(VOCAB_TOPICS)
export type VocabTopic = z.infer<typeof VocabTopicSchema>

export const VOCAB_TOPIC_LABEL: Record<VocabTopic, string> = {
  introductions: 'Introductions',
  family: 'Family',
  personality: 'Personality',
  emotions: 'Emotions',
  daily_routines: 'Daily routines',
  university_life: 'University life',
  food: 'Food',
  travel: 'Travel',
  directions: 'Directions',
  common_verbs: 'Common verbs',
  descriptions: 'Descriptions',
  time_expressions: 'Time expressions',
  communication: 'Communication',
}

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'determiner',
  'interjection',
  'phrase',
] as const
export const PartOfSpeechSchema = z.enum(PARTS_OF_SPEECH)
export type PartOfSpeech = z.infer<typeof PartOfSpeechSchema>

const StringList = z.array(z.string().min(1)).default([])

export const VocabularyEntrySchema = z.object({
  id: ContentIdSchema,
  term: z.string().min(1),
  kind: z.enum(['word', 'expression']).default('word'),
  partOfSpeech: PartOfSpeechSchema,
  /** English definition, written for the learner's level. */
  definition: z.string().min(1),
  /** Natural example sentences; the first one is used for blank-out exercises and must contain the term. */
  examples: z.array(z.string().min(1)).min(1),
  translations: z.partialRecord(SupportLanguageSchema, z.string().min(1)).default({}),
  pronunciation: z
    .object({
      /** Simple respelling such as "uh-POYNT-muhnt". */
      respelling: z.string().min(1).optional(),
      ipa: z.string().min(1).optional(),
      /** Only set when a real audio file exists; the UI shows a play control only then. */
      audioUrl: z.string().url().optional(),
    })
    .optional(),
  synonyms: StringList,
  antonyms: StringList,
  collocations: StringList,
  wordFamily: StringList,
  /** Short usage note, e.g. "Always followed by -ing." */
  grammarNote: LocalizedTextSchema.optional(),
  level: CefrLevelSchema,
  topics: z.array(VocabTopicSchema).min(1),
  tags: StringList,
  /** Curriculum chapters that teach this item; used to prioritise current-lesson words. */
  chapterIds: z.array(ContentIdSchema).default([]),
})

export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>
export type VocabularyEntryInput = z.input<typeof VocabularyEntrySchema>

/** A whole bank: unique ids and no duplicate term + part of speech. */
export const VocabularyBankSchema = z.array(VocabularyEntrySchema).superRefine((entries, ctx) => {
  const ids = new Set<string>()
  const terms = new Set<string>()
  entries.forEach((entry, i) => {
    if (ids.has(entry.id)) ctx.addIssue({ code: 'custom', message: `duplicate id ${entry.id}`, path: [i, 'id'] })
    ids.add(entry.id)
    const key = `${entry.term.toLowerCase()}|${entry.partOfSpeech}`
    if (terms.has(key)) ctx.addIssue({ code: 'custom', message: `duplicate term ${entry.term} (${entry.partOfSpeech})`, path: [i, 'term'] })
    terms.add(key)
    const first = entry.examples[0] ?? ''
    if (!containsTerm(first, entry.term)) {
      ctx.addIssue({ code: 'custom', message: `first example must contain the term "${entry.term}"`, path: [i, 'examples', 0] })
    }
  })
})

/**
 * Surface forms a term may take in an example: the term itself plus simple
 * regular inflections (-s, -es, -ed, -ing, y→ies). For multi-word verbs the
 * first word is inflected ("get up" → "gets up"). Longest forms first so
 * blanking removes "studies", not "study" inside it.
 */
export function termForms(term: string): string[] {
  const base = term.replace(/^to /, '')
  const [head = base, ...rest] = base.split(' ')
  const tail = rest.length ? ` ${rest.join(' ')}` : ''
  const stem = head.replace(/e$/, '')
  const yStem = head.replace(/y$/, 'i')
  const heads = [head, `${head}s`, `${head}es`, `${head}ed`, `${stem}ed`, `${head}ing`, `${stem}ing`, `${yStem}es`, `${yStem}ed`]
  const forms = new Set<string>([term, base, ...heads.map((h) => `${h}${tail}`)])
  return [...forms].sort((a, b) => b.length - a.length)
}

/** Case-insensitive check that an example sentence contains the term (allowing simple inflections). */
export function containsTerm(sentence: string, term: string): boolean {
  const s = sentence.toLowerCase()
  return termForms(term).some((form) => s.includes(form.toLowerCase()))
}

export function parseVocabularyBank(input: readonly VocabularyEntryInput[]): VocabularyEntry[] {
  return VocabularyBankSchema.parse(input)
}
