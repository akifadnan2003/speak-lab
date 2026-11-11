import { findMode } from '../../modes'
import type { VocabularySkill, VocabularyState } from '../../ports'
import { createInitialState, schedule, type SelfGrade } from '../../srs/scheduler'
import { VocabularySyncError, type VocabularyApi } from '../api'
import type { RecordReviewsResult, ReviewPayload, StudentVocabularyRow, VocabularyReviewRow } from '../wire'

/**
 * In-memory behavioural model of the vocabulary server, for client sync tests ONLY.
 *
 * It mirrors the rules of `record_vocabulary_reviews` (identity from the "session", idempotent
 * ids, monotonic per-word ordering, reset watermark) using the TypeScript scheduler. It is not
 * security evidence: RLS, grants and the SQL implementation are proven against Postgres in
 * `supabase/tests/pglite/` and `src/features/vocabulary/srs/scheduler.sql-parity.test.ts`.
 */
export interface FakeVocabularyServer {
  /** The account whose JWT the next requests carry (null = signed out). */
  sessionUserId: string | null
  online: boolean
  /** Number of further requests to fail with a transient error before succeeding. */
  failNext: number
  readonly calls: { method: string; expected?: string; count?: number }[]
  readonly states: Map<string, StudentVocabularyRow>
  readonly reviews: Map<string, VocabularyReviewRow>
  readonly resets: Map<string, string>
  api(): VocabularyApi
}

function rowFromState(s: VocabularyState, extra: { review_count: number; last_review_id: string | null }): StudentVocabularyRow {
  return {
    student_id: s.studentId,
    entry_id: s.entryId,
    stage: s.stage,
    ease: s.ease,
    interval_days: s.intervalDays,
    repetitions: s.repetitions,
    recall_streak: s.recallStreak,
    lapses: s.lapses,
    due_at: s.dueAt,
    last_reviewed_at: s.lastReviewedAt ?? null,
    first_learned_at: s.firstLearnedAt ?? null,
    last_result_correct: s.lastResultCorrect ?? null,
    recognition_correct: s.recognition.correct,
    recognition_incorrect: s.recognition.incorrect,
    recall_correct: s.recall.correct,
    recall_incorrect: s.recall.incorrect,
    spoken_count: s.spokenCount,
    review_count: extra.review_count,
    last_review_id: extra.last_review_id,
    created_at: s.updatedAt,
    updated_at: s.updatedAt,
  }
}

function stateOf(row: StudentVocabularyRow): VocabularyState {
  return {
    studentId: row.student_id,
    entryId: row.entry_id,
    stage: row.stage,
    ease: Number(row.ease),
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    recallStreak: row.recall_streak,
    lapses: row.lapses,
    dueAt: row.due_at,
    ...(row.last_reviewed_at ? { lastReviewedAt: row.last_reviewed_at } : {}),
    ...(row.first_learned_at ? { firstLearnedAt: row.first_learned_at } : {}),
    ...(row.last_result_correct !== null ? { lastResultCorrect: row.last_result_correct } : {}),
    recognition: { correct: row.recognition_correct, incorrect: row.recognition_incorrect },
    recall: { correct: row.recall_correct, incorrect: row.recall_incorrect },
    spokenCount: row.spoken_count,
    updatedAt: row.updated_at,
  }
}

export function createFakeVocabularyServer(now: () => Date = () => new Date()): FakeVocabularyServer {
  const server: FakeVocabularyServer = {
    sessionUserId: null,
    online: true,
    failNext: 0,
    calls: [],
    states: new Map(),
    reviews: new Map(),
    resets: new Map(),
    api: () => api,
  }
  const k = (student: string, entry: string) => `${student}:${entry}`

  function gate(method: string, extra: { expected?: string; count?: number } = {}) {
    server.calls.push({ method, ...extra })
    if (!server.online) throw new VocabularySyncError('network', 'TypeError: Failed to fetch')
    if (server.failNext > 0) {
      server.failNext -= 1
      throw new VocabularySyncError('server', 'Service unavailable')
    }
  }
  function uid(): string {
    if (!server.sessionUserId) throw new VocabularySyncError('auth', 'not authenticated', 'PGRST301')
    return server.sessionUserId
  }

  const api: VocabularyApi = {
    async fetchStates(studentId, options = {}) {
      gate('fetchStates')
      const me = uid()
      if (me !== studentId) return [] // RLS: nothing visible for anyone else
      return [...server.states.values()].filter(
        (r) => r.student_id === me && (!options.dueBefore || (r.due_at !== null && r.due_at <= options.dueBefore)),
      )
    },
    async fetchReviews(studentId, options = {}) {
      gate('fetchReviews')
      const me = uid()
      if (me !== studentId) return []
      return [...server.reviews.values()]
        .filter(
          (r) =>
            r.student_id === me &&
            r.voided_at === null &&
            (!options.entryId || r.entry_id === options.entryId) &&
            (!options.sinceIso || r.reviewed_at >= options.sinceIso),
        )
        .sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at))
    },
    async fetchResetAt(studentId) {
      gate('fetchResetAt')
      return uid() === studentId ? (server.resets.get(studentId) ?? null) : null
    },
    async recordReviews(expected, payloads, source) {
      gate('recordReviews', { expected, count: payloads.length })
      const me = uid()
      if (expected !== me) throw new VocabularySyncError('account', 'vocabulary: these reviews were recorded under a different account', '42501')
      const resetAt = server.resets.get(me) ?? null
      const results: RecordReviewsResult['results'] = []
      const touched = new Set<string>()
      for (const p of [...payloads].sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at) || a.id.localeCompare(b.id))) {
        const existing = server.reviews.get(p.id)
        if (existing) {
          results.push(existing.student_id === me ? { id: p.id, status: 'duplicate' } : { id: p.id, status: 'rejected', reason: 'id_conflict' })
          if (existing.student_id === me) touched.add(p.entry_id)
          continue
        }
        const mode = findMode(p.mode_id)
        if (!mode || mode.skill !== p.skill) {
          results.push({ id: p.id, status: 'rejected', reason: mode ? 'skill_mismatch' : 'unknown_mode' })
          continue
        }
        const at = new Date(Math.min(new Date(p.reviewed_at).getTime(), now().getTime()))
        const row = server.states.get(k(me, p.entry_id))
        const current = row ? stateOf(row) : createInitialState(me, p.entry_id, at)
        const voided = resetAt !== null && at.toISOString() <= resetAt
        const applied = !voided && (!current.lastReviewedAt || at.getTime() > new Date(current.lastReviewedAt).getTime())
        const input = { skill: mode.skill as VocabularySkill, correct: p.correct, hintUsed: p.hint_used, now: at, ...(p.self_grade ? { selfGrade: p.self_grade as SelfGrade } : {}) }
        const { state, quality } = schedule(current, input)
        if (applied) {
          server.states.set(k(me, p.entry_id), rowFromState(state, { review_count: (row?.review_count ?? 0) + 1, last_review_id: p.id }))
        }
        const after = applied ? state : current
        server.reviews.set(p.id, {
          id: p.id,
          student_id: me,
          entry_id: p.entry_id,
          mode_id: p.mode_id,
          skill: mode.skill,
          correct: p.correct,
          quality,
          hint_used: p.hint_used,
          self_grade: p.self_grade ?? null,
          answer: p.answer ?? null,
          reviewed_at: at.toISOString(),
          received_at: now().toISOString(),
          source,
          applied,
          stage_after: after.stage,
          interval_days_after: after.intervalDays,
          due_at_after: after.dueAt,
          voided_at: voided ? now().toISOString() : null,
        })
        results.push({ id: p.id, status: applied ? 'applied' : 'recorded', reason: voided ? 'before_reset' : applied ? null : 'older_than_state' })
        if (applied || row) touched.add(p.entry_id)
      }
      return {
        results,
        states: [...touched].map((e) => server.states.get(k(me, e))).filter((r): r is StudentVocabularyRow => r !== undefined),
        reset_at: resetAt,
      }
    },
    async reset(expected) {
      gate('reset', { expected })
      const me = uid()
      if (expected !== me) throw new VocabularySyncError('account', 'vocabulary: reset requested for a different account', '42501')
      const at = now().toISOString()
      server.resets.set(me, at)
      for (const [key, row] of server.states) if (row.student_id === me) server.states.delete(key)
      for (const [id, r] of server.reviews) if (r.student_id === me && r.voided_at === null) server.reviews.set(id, { ...r, voided_at: at })
      return at
    },
  }
  return server
}

export type { ReviewPayload }
