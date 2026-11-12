import type { Exercise } from '@/features/curriculum/schema'
import { ExerciseSchema } from '@/features/curriculum/schema'
import { seededShuffle } from '@/features/exercises/engine/shuffle'
import type { VocabularySkill } from '../ports'
import { containsTerm, termForms, type VocabularyEntry } from '../schema'

/**
 * Vocabulary practice modes.
 *
 * Four modes reuse the M3 exercise schema and renderer by *building* an
 * `Exercise` from a vocabulary entry; flashcards and active recall have
 * dedicated components. Listening and speaking are registered so the UI can
 * show them honestly as unavailable, and so adding them later is a matter
 * of flipping `available` and providing a builder.
 */

export type VocabularyModeId =
  | 'flashcards'
  | 'meaning_choice'
  | 'matching'
  | 'missing_word'
  | 'sentence_completion'
  | 'active_recall'
  | 'listening'
  | 'speaking'

export type ModeRenderer = 'flashcard' | 'recall' | 'exercise'

export interface VocabularyMode {
  readonly id: VocabularyModeId
  readonly label: string
  readonly description: string
  readonly skill: VocabularySkill
  readonly renderer: ModeRenderer
  /** Entries consumed per step (matching uses a group). */
  readonly groupSize: number
  readonly available: boolean
  readonly unavailableReason?: string
}

export const VOCABULARY_MODES: readonly VocabularyMode[] = [
  { id: 'flashcards', label: 'Flashcards', description: 'See the word, say the meaning, flip and grade yourself.', skill: 'recognition', renderer: 'flashcard', groupSize: 1, available: true },
  { id: 'meaning_choice', label: 'Choose the meaning', description: 'Pick the correct definition from four.', skill: 'recognition', renderer: 'exercise', groupSize: 1, available: true },
  { id: 'matching', label: 'Match words to meanings', description: 'Match four words to their definitions.', skill: 'recognition', renderer: 'exercise', groupSize: 4, available: true },
  { id: 'missing_word', label: 'Type the missing word', description: 'Complete the example sentence from memory.', skill: 'recall', renderer: 'exercise', groupSize: 1, available: true },
  { id: 'sentence_completion', label: 'Sentence completion', description: 'Choose the word that fits the sentence.', skill: 'recognition', renderer: 'exercise', groupSize: 1, available: true },
  { id: 'active_recall', label: 'Active recall', description: 'Read the definition and type the word in English.', skill: 'recall', renderer: 'recall', groupSize: 1, available: true },
  { id: 'listening', label: 'Listen and choose', description: 'Hear the word and choose the meaning.', skill: 'recognition', renderer: 'exercise', groupSize: 1, available: false, unavailableReason: 'Needs recorded audio (M7/M8).' },
  { id: 'speaking', label: 'Say it in a sentence', description: 'Use the word aloud and get feedback.', skill: 'spoken', renderer: 'recall', groupSize: 1, available: false, unavailableReason: 'Needs the speech pipeline (M7).' },
]

export function findMode(id: string): VocabularyMode | undefined {
  return VOCABULARY_MODES.find((m) => m.id === id)
}

/* ------------------------------------------------------------ builders */

/** Replace the term (or its simple inflection) in the sentence with a blank; returns the removed form. */
export function blankOut(sentence: string, term: string): { text: string; answer: string } | null {
  for (const form of termForms(term)) {
    const index = sentence.toLowerCase().indexOf(form.toLowerCase())
    if (index === -1) continue
    const before = sentence[index - 1]
    const after = sentence[index + form.length]
    const boundaryBefore = !before || !/[\p{L}\p{N}]/u.test(before)
    const boundaryAfter = !after || !/[\p{L}\p{N}]/u.test(after)
    if (!boundaryBefore || !boundaryAfter) continue
    const answer = sentence.slice(index, index + form.length)
    return { text: `${sentence.slice(0, index)}___${sentence.slice(index + form.length)}`, answer }
  }
  return null
}

/** Distractors of the same part of speech, preferring the same level, deterministic for the entry. */
export function pickDistractors(entry: VocabularyEntry, bank: readonly VocabularyEntry[], count: number, salt = ''): VocabularyEntry[] {
  const others = bank.filter((e) => e.id !== entry.id && e.definition !== entry.definition && e.term.toLowerCase() !== entry.term.toLowerCase())
  const samePos = others.filter((e) => e.partOfSpeech === entry.partOfSpeech)
  const sameLevel = samePos.filter((e) => e.level === entry.level)
  const ordered = [
    ...seededShuffle(sameLevel, `${entry.id}:${salt}:l`),
    ...seededShuffle(samePos.filter((e) => e.level !== entry.level), `${entry.id}:${salt}:p`),
    ...seededShuffle(others.filter((e) => e.partOfSpeech !== entry.partOfSpeech), `${entry.id}:${salt}:o`),
  ]
  const unique: VocabularyEntry[] = []
  for (const e of ordered) {
    if (unique.length >= count) break
    if (!unique.some((u) => u.id === e.id)) unique.push(e)
  }
  return unique
}

function options(correct: string, distractors: string[], seed: string) {
  const all = seededShuffle([correct, ...distractors], seed)
  return all.map((text, i) => ({ id: String.fromCharCode(97 + i), text }))
}

export function buildMeaningChoice(entry: VocabularyEntry, bank: readonly VocabularyEntry[]): Exercise {
  const distractors = pickDistractors(entry, bank, 3, 'meaning').map((e) => e.definition)
  const opts = options(entry.definition, distractors, `${entry.id}:meaning`)
  return ExerciseSchema.parse({
    id: `vm-${entry.id}`,
    type: 'multiple_choice',
    skill: 'vocabulary',
    instruction: { en: 'Choose the meaning.' },
    prompt: `${entry.term} (${entry.partOfSpeech})`,
    options: opts,
    correctOptionId: opts.find((o) => o.text === entry.definition)!.id,
    explanation: { en: `${entry.term}: ${entry.definition}. Example: ${entry.examples[0]}` },
  })
}

export function buildSentenceCompletion(entry: VocabularyEntry, bank: readonly VocabularyEntry[]): Exercise | null {
  const blanked = blankOut(entry.examples[0] ?? '', entry.term)
  if (!blanked) return null
  const distractors = pickDistractors(entry, bank, 3, 'sentence').map((e) => e.term)
  const opts = options(blanked.answer, distractors, `${entry.id}:sentence`)
  return ExerciseSchema.parse({
    id: `vs-${entry.id}`,
    type: 'multiple_choice',
    skill: 'vocabulary',
    instruction: { en: 'Choose the word that fits.' },
    prompt: blanked.text,
    options: opts,
    correctOptionId: opts.find((o) => o.text === blanked.answer)!.id,
    explanation: { en: `${entry.term}: ${entry.definition}` },
  })
}

export function buildMissingWord(entry: VocabularyEntry): Exercise | null {
  const blanked = blankOut(entry.examples[0] ?? '', entry.term)
  if (!blanked) return null
  const accepted = [...new Set([blanked.answer, entry.term])]
  return ExerciseSchema.parse({
    id: `vw-${entry.id}`,
    type: 'fill_blank',
    skill: 'vocabulary',
    instruction: { en: `Type the missing word. Meaning: ${entry.definition}` },
    text: blanked.text,
    blanks: [{ accepted }],
    hint: { en: `It starts with "${blanked.answer.slice(0, 1).toUpperCase()}" and has ${blanked.answer.length} letters.` },
    explanation: { en: `${entry.term}: ${entry.definition}` },
  })
}

export function buildMatching(group: readonly VocabularyEntry[]): Exercise | null {
  if (group.length < 2) return null
  return ExerciseSchema.parse({
    id: `vx-${group.map((e) => e.id).join('-')}`.slice(0, 120),
    type: 'matching',
    skill: 'vocabulary',
    prompt: 'Match each word to its meaning.',
    pairs: group.slice(0, 8).map((e) => ({ id: e.id, left: e.term, right: e.definition })),
  })
}

/** Entries whose first example can be blanked (needed by missing_word and sentence_completion). */
export function supportsBlank(entry: VocabularyEntry): boolean {
  return containsTerm(entry.examples[0] ?? '', entry.term) && blankOut(entry.examples[0] ?? '', entry.term) !== null
}
