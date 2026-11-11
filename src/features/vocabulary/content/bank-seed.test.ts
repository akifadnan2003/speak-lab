import { describe, expect, it } from 'vitest'
import { renderVocabularyBankSeedSql, VOCABULARY_BANK_SEED } from './bank-seed'
import { VOCABULARY_BANK } from './index'

const seeds = import.meta.glob<string>('/supabase/migrations/*_vocabulary_bank_v*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function versionOf(path: string): number {
  return Number(/_vocabulary_bank_v(\d+)\.sql$/.exec(path)?.[1] ?? Number.NaN)
}

describe('vocabulary bank server seed', () => {
  it('the newest seed migration is the one the app declares', () => {
    const paths = Object.keys(seeds)
    expect(paths.length).toBeGreaterThan(0)
    const newest = paths.reduce((a, b) => (versionOf(b) > versionOf(a) ? b : a))
    expect(newest.endsWith(`/${VOCABULARY_BANK_SEED.file}`)).toBe(true)
    expect(versionOf(newest)).toBe(VOCABULARY_BANK_SEED.version)
  })

  it('matches the bundled bank exactly (regenerate into a NEW file when the bank changes)', async () => {
    const sql = renderVocabularyBankSeedSql(VOCABULARY_BANK, VOCABULARY_BANK_SEED.version)
    await expect(sql).toMatchFileSnapshot(`../../../../supabase/migrations/${VOCABULARY_BANK_SEED.file}`)
  })

  it('escapes quotes and keeps every id, chapter link and level', () => {
    const sql = renderVocabularyBankSeedSql(
      [{ ...VOCABULARY_BANK[0]!, id: 'v-x', term: "what's up", chapterIds: ['a0-01'], topics: ['introductions'], level: 'A1' }],
      7,
    )
    expect(sql).toContain(`('v-x', 'what''s up', 'A1', array['introductions']::text[], array['a0-01']::text[], 7)`)
    expect(sql).toContain(`entry_id <> all (array['v-x']::text[])`)
  })
})
