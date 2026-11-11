import type { VocabularyEntry } from '../schema'

/**
 * Server mirror of the vocabulary bank.
 *
 * The full entries (definitions, examples, translations) ship in the app bundle. The database
 * only needs the identifiers, level, topics and chapter links so that reviews can reference real
 * words (foreign key) and the tutor can group progress by chapter. That mirror is a generated,
 * versioned migration: `bank-seed.test.ts` fails when the bank and the newest seed disagree.
 *
 * When the bank changes: bump `version`, choose a new timestamped file name, and run
 * `npx vitest run src/features/vocabulary/content/bank-seed.test.ts -u` to write it. Never edit a
 * seed that has already been applied anywhere; migrations are immutable.
 */
export const VOCABULARY_BANK_SEED = {
  version: 1,
  file: '20261112090100_vocabulary_bank_v1.sql',
} as const

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function textArray(values: readonly string[]): string {
  return values.length === 0 ? `'{}'::text[]` : `array[${values.map(quote).join(', ')}]::text[]`
}

export function renderVocabularyBankSeedSql(entries: readonly VocabularyEntry[], version: number): string {
  const rows = entries.map(
    (e) =>
      `  (${quote(e.id)}, ${quote(e.term)}, ${quote(e.level)}, ${textArray(e.topics)}, ${textArray(e.chapterIds)}, ${version})`,
  )
  return [
    `-- GENERATED from src/features/vocabulary/content/bank.ts by bank-seed.ts. Do not edit by hand.`,
    `-- Vocabulary bank v${version}: ${entries.length} entries (ids, level, topics, chapter links).`,
    `-- A later bank version is a NEW migration file; applied seeds are never changed.`,
    ``,
    `insert into public.vocabulary_items (entry_id, term, level, topics, chapter_ids, bank_version) values`,
    rows.join(',\n'),
    `on conflict (entry_id) do update set`,
    `  term = excluded.term,`,
    `  level = excluded.level,`,
    `  topics = excluded.topics,`,
    `  chapter_ids = excluded.chapter_ids,`,
    `  bank_version = excluded.bank_version,`,
    `  retired_at = null;`,
    ``,
    `-- Words removed from the bank are retired, not deleted: review history keeps referencing them.`,
    `update public.vocabulary_items set retired_at = now()`,
    `where retired_at is null and entry_id <> all (${textArray(entries.map((e) => e.id))});`,
    ``,
  ].join('\n')
}
