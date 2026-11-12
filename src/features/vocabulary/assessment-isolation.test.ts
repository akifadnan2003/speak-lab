import { describe, expect, it } from 'vitest'

/**
 * Vocabulary practice is client-graded, formative self-practice (ADR-018). It must never feed an
 * official assessment: the `assessment` Edge Function and the curriculum tables know nothing about
 * vocabulary tables or functions, and the vocabulary migrations never touch curriculum tables.
 * This test pins that separation at the source level; the RLS suites prove the grants.
 */
const files = import.meta.glob<string>(
  [
    '/supabase/functions/assessment/index.ts',
    '/supabase/migrations/*.sql',
    '/src/features/curriculum/assessment-rules.ts',
    '/src/features/curriculum/progression.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
)
const read = (path: string): string => {
  const source = files[path]
  if (source === undefined) throw new Error(`not loaded: ${path}`)
  return source
}

const VOCABULARY_OBJECTS = ['student_vocabulary', 'vocabulary_reviews', 'vocabulary_items', 'vocabulary_student_meta', 'record_vocabulary_reviews', 'reset_vocabulary_progress', 'vocabulary_schedule']
const CURRICULUM_OBJECTS = ['lesson_progress', 'exercise_attempts', 'assessment_attempts', 'chapter_access_overrides']

describe('vocabulary results stay out of official assessments', () => {
  it('the assessment Edge Function does not read or write vocabulary tables', () => {
    const source = read('/supabase/functions/assessment/index.ts')
    for (const name of VOCABULARY_OBJECTS) expect(source, name).not.toContain(name)
  })

  it('the curriculum migration and the vocabulary migrations do not reference each other', () => {
    const curriculum = read('/supabase/migrations/20261111150000_curriculum_progress.sql')
    for (const name of VOCABULARY_OBJECTS) expect(curriculum, name).not.toContain(name)
    const vocabulary = Object.entries(files)
      .filter(([path]) => /_vocabulary_/.test(path))
      .map(([, source]) => source)
    expect(vocabulary.length).toBeGreaterThanOrEqual(2)
    for (const source of vocabulary) for (const name of CURRICULUM_OBJECTS) expect(source, name).not.toContain(name)
  })

  it('assessment rules and progression never consult vocabulary progress', () => {
    const rules = read('/src/features/curriculum/assessment-rules.ts') + read('/src/features/curriculum/progression.ts')
    expect(rules).not.toMatch(/vocabulary/i)
  })
})
