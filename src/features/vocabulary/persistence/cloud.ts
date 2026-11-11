import type { VocabularyRepository, VocabularyReviewRecord, VocabularyState } from '../ports'
import { VocabularySyncError, type VocabularyApi } from './api'
import { createVocabularyOutbox, type OutboxItem, type VocabularyOutbox } from './outbox'
import { reviewFromRow, stateFromRow, toReviewPayload, type ReviewStatus } from './wire'

/**
 * Supabase-backed vocabulary repository (same port as the device repository, so no screen or
 * scheduler changes).
 *
 * - The server is authoritative. `upsertState` never writes to it: the browser's state is only
 *   an optimistic preview until `record_vocabulary_reviews` returns the server's own result.
 * - `recordReview` puts the review in a durable per-account outbox first, then tries to send it.
 *   Offline, it stays queued and is retried (on `online`, with backoff, and on the next read).
 *   Review ids make every retry idempotent.
 * - Every call checks that the requested student is the account signed in right now, so a
 *   component still holding the previous student's id after an account switch gets an error,
 *   not someone else's data.
 */
export class VocabularyAccountMismatchError extends Error {
  constructor() {
    super('The signed-in account changed; vocabulary records for the previous account are not available.')
    this.name = 'VocabularyAccountMismatchError'
  }
}

export interface SyncReport {
  readonly sent: number
  readonly statuses: Partial<Record<ReviewStatus, number>>
  readonly rejected: readonly { id: string | null; reason: string }[]
  readonly error?: VocabularySyncError
}

export interface CloudVocabularyOptions {
  readonly api: VocabularyApi
  /** Id of the account signed in right now (from the Supabase session), or null. */
  readonly getSessionUserId: () => Promise<string | null>
  readonly outbox?: VocabularyOutbox
  /** Called when the server permanently rejects reviews or a batch. */
  readonly onSyncProblem?: (report: SyncReport) => void
  /** Called after any flush that changed server state (lets the UI refetch). */
  readonly onSynced?: (studentId: string) => void
  readonly batchSize?: number
  /** Test seam for retry timers. */
  readonly scheduleRetry?: (run: () => void, delayMs: number) => () => void
}

export interface CloudVocabularyRepository extends VocabularyRepository {
  /** Sends the signed-in student's queued reviews. Never throws; returns what happened. */
  flush(): Promise<SyncReport>
  pendingCount(studentId: string): number
  /** Words due at or before `now` (server query), with queued optimistic states applied. */
  listDueStates(studentId: string, now: Date): Promise<readonly VocabularyState[]>
  /** Forgets everything held on this device: caches, the review queue and timers (sign-out, account switch). */
  dispose(): void
}

const EMPTY_REPORT: SyncReport = { sent: 0, statuses: {}, rejected: [] }

function laterThan(a: string | undefined, b: string | undefined): boolean {
  if (!a) return false
  if (!b) return true
  return new Date(a).getTime() > new Date(b).getTime()
}

export function createCloudVocabularyRepository(options: CloudVocabularyOptions): CloudVocabularyRepository {
  const { api, getSessionUserId, onSyncProblem, onSynced } = options
  const outbox = options.outbox ?? createVocabularyOutbox()
  const batchSize = options.batchSize ?? 200
  const scheduleRetry =
    options.scheduleRetry ??
    ((run: () => void, delayMs: number) => {
      const handle = setTimeout(run, delayMs)
      return () => clearTimeout(handle)
    })

  // Last states/reviews the server returned, per student: the offline fallback for reads.
  const stateCache = new Map<string, Map<string, VocabularyState>>()
  const reviewCache = new Map<string, VocabularyReviewRecord[]>()
  // Optimistic states handed to upsertState, waiting for their review.
  const preview = new Map<string, VocabularyState>()
  let inflight: Promise<SyncReport> | null = null
  let cancelRetry: (() => void) | null = null
  let retryDelay = 0

  const onOnline = () => void flush()
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

  async function requireOwner(studentId: string): Promise<string> {
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || sessionUserId !== studentId) throw new VocabularyAccountMismatchError()
    return sessionUserId
  }

  function cacheStates(studentId: string, states: readonly VocabularyState[], replace: boolean) {
    const map = replace ? new Map<string, VocabularyState>() : (stateCache.get(studentId) ?? new Map<string, VocabularyState>())
    for (const s of states) map.set(s.entryId, s)
    stateCache.set(studentId, map)
  }

  /** Server states with queued optimistic states laid over them (newest review wins). */
  function overlay(studentId: string, server: Map<string, VocabularyState>): VocabularyState[] {
    const merged = new Map(server)
    const items = [...outbox.list(studentId)].sort((a, b) => a.review.reviewedAt.localeCompare(b.review.reviewedAt))
    for (const item of items) {
      if (!item.state) continue
      const current = merged.get(item.review.entryId)
      if (!current || laterThan(item.state.lastReviewedAt, current.lastReviewedAt)) merged.set(item.review.entryId, item.state)
    }
    return [...merged.values()]
  }

  function armRetry() {
    if (cancelRetry) return
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 5_000, 300_000)
    cancelRetry = scheduleRetry(() => {
      cancelRetry = null
      void flush()
    }, retryDelay)
  }

  async function sendQueued(): Promise<SyncReport> {
    const owner = await getSessionUserId()
    if (!owner) return EMPTY_REPORT
    const statuses: Partial<Record<ReviewStatus, number>> = {}
    const rejected: { id: string | null; reason: string }[] = []
    let sent = 0
    let changed = false

    // Only the signed-in account's own queue is ever read, and each item is re-checked.
    let items: OutboxItem[] = outbox.list(owner).filter((i) => i.review.studentId === owner)
    items.sort((a, b) => a.review.reviewedAt.localeCompare(b.review.reviewedAt))
    while (items.length > 0) {
      const batch = items.slice(0, batchSize)
      items = items.slice(batchSize)
      const ids = batch.map((i) => i.review.id)
      try {
        const result = await api.recordReviews(owner, batch.map((i) => toReviewPayload(i.review)), 'live')
        sent += batch.length
        for (const r of result.results) {
          statuses[r.status] = (statuses[r.status] ?? 0) + 1
          if (r.status === 'rejected') rejected.push({ id: r.id, reason: r.reason ?? 'rejected' })
          if (r.status === 'applied') changed = true
        }
        cacheStates(owner, result.states.map(stateFromRow), false)
        // Every item in an answered batch reached a final status; none can succeed on retry.
        outbox.remove(owner, ids)
        retryDelay = 0
      } catch (error) {
        const syncError =
          error instanceof VocabularySyncError ? error : new VocabularySyncError('network', String(error), undefined, { cause: error })
        if (syncError.transient) {
          outbox.bumpAttempts(owner, ids)
          armRetry()
        } else if (syncError.kind === 'invalid') {
          // The batch itself was refused (malformed); retrying would loop forever.
          outbox.remove(owner, ids)
          rejected.push(...ids.map((id) => ({ id, reason: syncError.code ?? 'invalid' })))
        }
        // 'account': session and queue disagree. Keep the queue; it is purged on sign-out/switch.
        const report: SyncReport = { sent, statuses, rejected, error: syncError }
        if (!syncError.transient) onSyncProblem?.(report)
        if (changed) onSynced?.(owner)
        return report
      }
    }
    const report: SyncReport = { sent, statuses, rejected }
    if (rejected.length > 0) onSyncProblem?.(report)
    if (changed) onSynced?.(owner)
    return report
  }

  function flush(): Promise<SyncReport> {
    inflight ??= sendQueued().finally(() => {
      inflight = null
    })
    return inflight
  }

  async function loadStates(studentId: string, dueBefore?: string): Promise<Map<string, VocabularyState>> {
    try {
      const rows = await api.fetchStates(studentId, dueBefore ? { dueBefore } : {})
      const states = rows.map(stateFromRow)
      if (!dueBefore) cacheStates(studentId, states, true)
      return new Map(states.map((s) => [s.entryId, s]))
    } catch (error) {
      const cached = stateCache.get(studentId)
      if (error instanceof VocabularySyncError && error.transient && cached) {
        if (!dueBefore) return new Map(cached)
        return new Map([...cached].filter(([, s]) => s.dueAt !== null && s.dueAt <= dueBefore))
      }
      throw error
    }
  }

  return {
    async listStates(studentId) {
      await requireOwner(studentId)
      if (outbox.list(studentId).length > 0) await flush()
      return overlay(studentId, await loadStates(studentId))
    },

    async listDueStates(studentId, now) {
      await requireOwner(studentId)
      const nowIso = now.toISOString()
      const due = await loadStates(studentId, nowIso)
      return overlay(studentId, due).filter((s) => s.dueAt !== null && new Date(s.dueAt).getTime() <= now.getTime())
    },

    async upsertState(state) {
      await requireOwner(state.studentId)
      preview.set(`${state.studentId}:${state.entryId}`, state)
    },

    async recordReview(review) {
      await requireOwner(review.studentId)
      const k = `${review.studentId}:${review.entryId}`
      const state = preview.get(k)
      preview.delete(k)
      outbox.add(review.studentId, {
        review,
        ...(state && state.lastReviewedAt === review.reviewedAt ? { state } : {}),
        attempts: 0,
      })
      // Durably queued: a network failure here is not a failure to save.
      await flush()
    },

    async listReviews(studentId, filter) {
      await requireOwner(studentId)
      let server: VocabularyReviewRecord[]
      try {
        server = (await api.fetchReviews(studentId, filter ?? {})).map(reviewFromRow)
        if (!filter) reviewCache.set(studentId, server)
      } catch (error) {
        const cached = reviewCache.get(studentId)
        if (!(error instanceof VocabularySyncError && error.transient && cached)) throw error
        server = cached.filter(
          (r) => (filter?.entryId === undefined || r.entryId === filter.entryId) && (filter?.sinceIso === undefined || r.reviewedAt >= filter.sinceIso),
        )
      }
      const known = new Set(server.map((r) => r.id))
      const pending = outbox
        .list(studentId)
        .map((i) => i.review)
        .filter(
          (r) =>
            !known.has(r.id) &&
            (filter?.entryId === undefined || r.entryId === filter.entryId) &&
            (filter?.sinceIso === undefined || r.reviewedAt >= filter.sinceIso),
        )
      return [...server, ...pending].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
    },

    async clear(studentId) {
      await requireOwner(studentId)
      await api.reset(studentId)
      outbox.remove(studentId, outbox.list(studentId).map((i) => i.review.id))
      stateCache.delete(studentId)
      reviewCache.delete(studentId)
    },

    flush,

    pendingCount(studentId) {
      return outbox.list(studentId).length
    },

    dispose() {
      outbox.clearAll()
      stateCache.clear()
      reviewCache.clear()
      preview.clear()
      cancelRetry?.()
      cancelRetry = null
      retryDelay = 0
    },
  }
}
