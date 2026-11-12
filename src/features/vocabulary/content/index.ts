import type { VocabularyBankSource } from '../ports'
import { parseVocabularyBank, type VocabularyEntry } from '../schema'
import { VOCABULARY_BANK_INPUT } from './bank'

/** Validated at module load; a bad entry fails tests, never a learner's screen. */
export const VOCABULARY_BANK: readonly VocabularyEntry[] = parseVocabularyBank(VOCABULARY_BANK_INPUT)

export function createStaticVocabularyBank(entries: readonly VocabularyEntry[] = VOCABULARY_BANK): VocabularyBankSource {
  return {
    async listEntries() {
      return entries
    },
  }
}

export function findEntrySync(id: string): VocabularyEntry | undefined {
  return VOCABULARY_BANK.find((e) => e.id === id)
}
