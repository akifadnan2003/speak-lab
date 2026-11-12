// @vitest-environment node
/**
 * The browser scheduler (`schedule()`) and the server one (`public.vocabulary_schedule`, reached
 * through `record_vocabulary_reviews`) must agree exactly, otherwise a word would jump between
 * two different due dates as the app swaps its optimistic state for the server's.
 *
 * Runs the real migrations on real Postgres 17 (PGlite), replays seeded random review sequences
 * through both, and compares every scheduling field after every review, under several session
 * time zones and across daylight-saving transitions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createStudent, createTestDatabase, type TestDatabase } from '../../../../supabase/tests/pglite/database.ts'
import { VOCABULARY_BANK } from '../content'
import { VOCABULARY_MODES } from '../modes'
import type { VocabularyReviewRecord, VocabularyState } from '../ports'
import { stateFromRow, toReviewPayload, type RecordReviewsResult } from '../persistence/wire'
import { createInitialState, schedule, type SelfGrade } from './scheduler'
import { DAY_MS } from './time'

const sqlFiles = import.meta.glob<string>('/supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true })
const migrations = Object.entries(sqlFiles).map(([path, sql]) => ({ name: path.split('/').pop() ?? path, sql }))

const MODES = VOCABULARY_MODES.filter((m) => m.available)
const GRADES: readonly SelfGrade[] = ['again', 'hard', 'good', 'easy']
const ZONES = ['UTC', 'America/New_York', 'Asia/Baku', 'Australia/Lord_Howe', 'Pacific/Chatham'] as const

/** Small deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let t: TestDatabase
let studentId: string
let reviewSeq = 0

beforeAll(async () => {
  t = await createTestDatabase(migrations)
  studentId = await createStudent(t, 'parity@example.test', { createdAt: '2020-01-01T00:00:00Z' })
}, 60_000)

afterAll(async () => {
  await t?.close()
})

async function submit(review: VocabularyReviewRecord, zone: string): Promise<VocabularyState> {
  await t.db.exec(`set timezone = '${zone}'`)
  const rows = await t.query<{ r: RecordReviewsResult }>(
    { kind: 'user', id: studentId },
    `select public.record_vocabulary_reviews($1, $2::jsonb, 'live') as r`,
    [studentId, JSON.stringify([toReviewPayload(review)])],
  )
  const result = rows[0]!.r
  expect(result.results[0]?.status, JSON.stringify(result.results)).toBe('applied')
  const row = result.states.find((s) => s.entry_id === review.entryId)
  if (!row) throw new Error('no state returned')
  return stateFromRow(row)
}

function comparable(s: VocabularyState) {
  // updatedAt is the server's clock on one side and the review time on the other; not compared.
  const { updatedAt: _ignored, ...rest } = s
  return rest
}

async function replay(entryId: string, zone: string, steps: readonly { at: Date; modeIndex: number; correct: boolean; hint: boolean; grade: SelfGrade }[]) {
  let local = createInitialState(studentId, entryId, steps[0]!.at)
  for (const step of steps) {
    const mode = MODES[step.modeIndex % MODES.length]!
    const input =
      mode.id === 'flashcards'
        ? { skill: mode.skill, correct: step.grade !== 'again', selfGrade: step.grade, now: step.at }
        : { skill: mode.skill, correct: step.correct, hintUsed: step.hint, now: step.at }
    const { state, quality } = schedule(local, input)
    reviewSeq += 1
    const review: VocabularyReviewRecord = {
      id: `parity-${reviewSeq.toString().padStart(8, '0')}`,
      studentId,
      entryId,
      modeId: mode.id,
      skill: mode.skill,
      correct: quality >= 3,
      quality,
      hintUsed: 'hintUsed' in input ? Boolean(input.hintUsed) : false,
      reviewedAt: step.at.toISOString(),
      intervalDaysAfter: state.intervalDays,
      stageAfter: state.stage,
    }
    const server = await submit(review, zone)
    expect(comparable(server), `${entryId} in ${zone} after review ${reviewSeq} (${mode.id}, q=${quality})`).toEqual(comparable(state))
    local = state
  }
  return local
}

describe('scheduler parity: TypeScript schedule() ≡ SQL vocabulary_schedule()', () => {
  it('agrees on 40 seeded random review sequences across time zones', async () => {
    const stopAt = Date.now() - DAY_MS
    let stagesSeen = new Set<string>()
    let lapses = 0
    for (let n = 0; n < 40; n++) {
      const rand = mulberry32(1000 + n)
      const entry = VOCABULARY_BANK[n]!
      let at = Date.UTC(2023, 0, 1) + Math.floor(rand() * 200) * DAY_MS + Math.floor(rand() * DAY_MS)
      let interval = 0
      const steps = []
      for (let i = 0; i < 30 && at < stopAt; i++) {
        steps.push({ at: new Date(at), modeIndex: Math.floor(rand() * 100), correct: rand() < 0.78, hint: rand() < 0.2, grade: GRADES[Math.floor(rand() * 4)]! })
        // Next answer somewhere around the due date: early, on time or late.
        const factor = 0.3 + rand() * 1.6
        interval = Math.max(1, interval ? interval * 2 : 1)
        at += Math.max(60_000, Math.floor(interval * factor * DAY_MS * rand()) + Math.floor(rand() * 6 * 3_600_000))
      }
      const final = await replay(entry.id, ZONES[n % ZONES.length]!, steps)
      stagesSeen = stagesSeen.add(final.stage)
      lapses += final.lapses
    }
    // The sequences must actually exercise the interesting branches.
    expect(lapses).toBeGreaterThan(0)
    expect(stagesSeen.size).toBeGreaterThanOrEqual(2)
  })

  it('reaches mastery identically through active recall, then lapses identically', async () => {
    const entry = VOCABULARY_BANK[60]!
    const steps = []
    let at = Date.UTC(2024, 0, 10, 9)
    for (const gap of [0, 1, 3, 6, 15, 37]) {
      at += gap * DAY_MS
      steps.push({ at: new Date(at), modeIndex: MODES.findIndex((m) => m.id === 'active_recall'), correct: true, hint: false, grade: 'good' as const })
    }
    steps.push({ at: new Date(at + 90 * DAY_MS), modeIndex: MODES.findIndex((m) => m.id === 'meaning_choice'), correct: false, hint: false, grade: 'good' as const })
    const final = await replay(entry.id, 'Asia/Baku', steps)
    expect(final).toMatchObject({ stage: 'learning', lapses: 1, intervalDays: 1 })
  })

  it('keeps "hard" flashcard grades within the 1.2× stretch identically', async () => {
    const entry = VOCABULARY_BANK[61]!
    const flash = MODES.findIndex((m) => m.id === 'flashcards')
    const grades: SelfGrade[] = ['good', 'good', 'good', 'hard', 'hard', 'easy', 'hard']
    let at = Date.UTC(2024, 5, 1, 7)
    const steps = grades.map((grade, i) => {
      at += [0, 1, 3, 6, 9, 11, 30][i]! * DAY_MS
      return { at: new Date(at), modeIndex: flash, correct: true, hint: false, grade }
    })
    await replay(entry.id, 'UTC', steps)
  })

  it('schedules in whole 24-hour days across DST changes, whatever the session time zone', async () => {
    // 2025-03-09 (US spring forward) and 2025-10-26 (EU fall back) fall inside these intervals.
    for (const [i, zone] of (['America/New_York', 'Europe/London', 'UTC'] as const).entries()) {
      const entry = VOCABULARY_BANK[70 + i]!
      const recall = MODES.findIndex((m) => m.id === 'active_recall')
      const start = Date.UTC(2025, 2, 7, 23, 30)
      const steps = [0, 1, 3].map((d) => ({ at: new Date(start + d * DAY_MS), modeIndex: recall, correct: true, hint: false, grade: 'good' as const }))
      steps.push({ at: new Date(Date.UTC(2025, 9, 24, 23, 30)), modeIndex: recall, correct: true, hint: false, grade: 'good' })
      const final = await replay(entry.id, zone, steps)
      expect(new Date(final.dueAt!).getTime() - new Date(final.lastReviewedAt!).getTime()).toBe(final.intervalDays * DAY_MS)
    }
  })
})
