/**
 * Text normalisation for deterministic answer comparison.
 *
 * The goal is to forgive presentation differences (case, spacing, curly
 * quotes, a trailing full stop) while never forgiving grammar. Anything that
 * changes meaning stays significant: word order, apostrophes inside words
 * ("Im" is not "I'm"), question marks when the exercise asks for a question.
 */

const CURLY_QUOTES = /[‘’‚‛′]/g
const CURLY_DOUBLE = /[“”„‟″]/g

export interface NormalizeOptions {
  /** Keep a final `?` significant (used for question formation). Default false. */
  keepQuestionMark?: boolean
}

export function normalizeText(input: string, options: NormalizeOptions = {}): string {
  let text = input
    .replace(CURLY_QUOTES, "'")
    .replace(CURLY_DOUBLE, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  // Spaces before punctuation ("name ?" → "name?")
  text = text.replace(/\s+([?!.,;:])/g, '$1')

  // Drop a single trailing full stop or exclamation mark; keep "?" when asked.
  if (options.keepQuestionMark) {
    text = text.replace(/[.!]+$/, '')
  } else {
    text = text.replace(/[.!?]+$/, '')
  }
  return text
}

/** True when `candidate` equals any accepted answer after normalisation. */
export function matchesAccepted(candidate: string, accepted: readonly string[], options?: NormalizeOptions): boolean {
  const value = normalizeText(candidate, options)
  if (value.length === 0) return false
  return accepted.some((a) => normalizeText(a, options) === value)
}

/** Word count used by guided writing (letters/digits/apostrophes form a word). */
export function countWords(text: string): number {
  const words = text.match(/[\p{L}\p{N}']+/gu)
  return words ? words.length : 0
}

/** Case-insensitive containment test on whitespace-normalised text. */
export function containsPhrase(text: string, phrase: string): boolean {
  const haystack = normalizeText(text)
  const needle = normalizeText(phrase)
  return needle.length > 0 && haystack.includes(needle)
}
