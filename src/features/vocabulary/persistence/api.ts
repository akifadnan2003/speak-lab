import type { SupabaseClient } from '@supabase/supabase-js'
import {
  REVIEW_COLUMNS,
  STATE_COLUMNS,
  type RecordReviewsResult,
  type ReviewPayload,
  type StudentVocabularyRow,
  type VocabularyReviewRow,
} from './wire'

/**
 * The server calls the cloud vocabulary repository needs, behind a narrow port so the sync logic
 * can be unit-tested without imitating PostgREST. `createSupabaseVocabularyApi` is the only
 * implementation that talks to the network.
 *
 * Authorization never depends on anything sent from here: the database takes the student from
 * the verified JWT and RLS limits every read (supabase/migrations/20261112090000_*.sql).
 */
export interface VocabularyApi {
  fetchStates(studentId: string, options?: { dueBefore?: string }): Promise<StudentVocabularyRow[]>
  fetchReviews(studentId: string, options?: { entryId?: string; sinceIso?: string }): Promise<VocabularyReviewRow[]>
  fetchResetAt(studentId: string): Promise<string | null>
  recordReviews(expectedStudentId: string, reviews: readonly ReviewPayload[], source: 'live' | 'import'): Promise<RecordReviewsResult>
  reset(expectedStudentId: string): Promise<string>
}

export type VocabularySyncErrorKind = 'network' | 'auth' | 'account' | 'invalid' | 'server'

/**
 * `transient` errors keep queued reviews for a retry; permanent ones mean the request itself is
 * wrong and retrying cannot help.
 */
export class VocabularySyncError extends Error {
  readonly kind: VocabularySyncErrorKind
  readonly transient: boolean
  readonly code: string | undefined

  constructor(kind: VocabularySyncErrorKind, message: string, code?: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'VocabularySyncError'
    this.kind = kind
    this.transient = kind === 'network' || kind === 'auth' || kind === 'server'
    this.code = code
  }
}

interface PostgrestLikeError {
  message: string
  code?: string
}
interface PostgrestLikeResponse<T> {
  data: T | null
  error: PostgrestLikeError | null
  status: number
}

/** Maps a supabase-js response onto data or a classified error. */
export function unwrap<T>(response: PostgrestLikeResponse<T>): T {
  const { data, error, status } = response
  if (!error) return data as T
  const code = error.code || undefined
  if (status === 0 || status === 408 || status === 429 || status >= 500) {
    throw new VocabularySyncError(status >= 500 ? 'server' : 'network', error.message, code)
  }
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303') {
    throw new VocabularySyncError('auth', error.message, code)
  }
  if (code === '42501' || status === 403) {
    throw new VocabularySyncError('account', error.message, code)
  }
  throw new VocabularySyncError('invalid', error.message, code)
}

/** Wraps thrown fetch failures (offline, DNS, CORS) as transient network errors. */
async function guard<T>(run: () => PromiseLike<PostgrestLikeResponse<T>>): Promise<T> {
  let response: PostgrestLikeResponse<T>
  try {
    response = await run()
  } catch (cause) {
    throw new VocabularySyncError('network', cause instanceof Error ? cause.message : 'Network request failed', undefined, { cause })
  }
  return unwrap(response)
}

const PAGE = 1000

export function createSupabaseVocabularyApi(client: SupabaseClient): VocabularyApi {
  return {
    async fetchStates(studentId, options = {}) {
      const rows: StudentVocabularyRow[] = []
      for (let from = 0; ; from += PAGE) {
        const page = await guard<StudentVocabularyRow[]>(() => {
          let q = client.from('student_vocabulary').select(STATE_COLUMNS).eq('student_id', studentId)
          if (options.dueBefore) q = q.lte('due_at', options.dueBefore)
          return q.order('entry_id').range(from, from + PAGE - 1)
        })
        rows.push(...(page ?? []))
        if (!page || page.length < PAGE) return rows
      }
    },

    async fetchReviews(studentId, options = {}) {
      const rows: VocabularyReviewRow[] = []
      for (let from = 0; ; from += PAGE) {
        const page = await guard<VocabularyReviewRow[]>(() => {
          let q = client.from('vocabulary_reviews').select(REVIEW_COLUMNS).eq('student_id', studentId).is('voided_at', null)
          if (options.entryId) q = q.eq('entry_id', options.entryId)
          if (options.sinceIso) q = q.gte('reviewed_at', options.sinceIso)
          return q.order('reviewed_at').order('id').range(from, from + PAGE - 1)
        })
        rows.push(...(page ?? []))
        if (!page || page.length < PAGE) return rows
      }
    },

    async fetchResetAt(studentId) {
      const row = await guard<{ reset_at: string | null } | null>(() =>
        client.from('vocabulary_student_meta').select('reset_at').eq('student_id', studentId).maybeSingle(),
      )
      return row?.reset_at ?? null
    },

    async recordReviews(expectedStudentId, reviews, source) {
      const result = await guard<RecordReviewsResult>(() =>
        client.rpc('record_vocabulary_reviews', { p_expected_student: expectedStudentId, p_reviews: reviews, p_source: source }),
      )
      if (!result || !Array.isArray(result.results)) throw new VocabularySyncError('server', 'Malformed response from record_vocabulary_reviews')
      return result
    },

    async reset(expectedStudentId) {
      return guard<string>(() => client.rpc('reset_vocabulary_progress', { p_expected_student: expectedStudentId }))
    },
  }
}
