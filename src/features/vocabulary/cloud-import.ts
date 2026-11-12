import { exportVocabularySnapshot, isUploadableStudentId, type VocabularySnapshot } from './migration'
import type { VocabularyRepository, VocabularyReviewRecord } from './ports'
import type { VocabularyApi } from './persistence/api'
import { toReviewPayload, type ReviewStatus } from './persistence/wire'

/**
 * Consent-based upload of device-local vocabulary history to the signed-in account.
 *
 * Rules (docs/VOCABULARY_PERSISTENCE.md, "Local-to-cloud migration"):
 * 1. Only on an explicit choice: `runLocalVocabularyImport` requires `consent: true`, and the UI
 *    asks first. Nothing is uploaded automatically.
 * 2. Only the account that created the records: the snapshot's student id must equal the
 *    signed-in user's id. Records are never re-keyed; preview (`preview-*`) records are refused.
 * 3. Never overwrite newer server data: local *states* are not uploaded at all. Local *reviews*
 *    are replayed through the same server function as live practice, which applies a review only
 *    if it is newer than the word's latest server review and the last reset; anything older is
 *    kept as history without touching the schedule. The plan below predicts that outcome so the
 *    learner sees it before agreeing; the server enforces it regardless of what the client sends.
 * 4. Idempotent: review ids are the server's primary key, so an interrupted upload can be re-run.
 * 5. The device copy is removed only after every review reached a final server status.
 */

export type EntryResolution = 'import' | 'merge' | 'server_newer'
export type SkipReason = 'already_on_server' | 'older_than_server' | 'before_reset'

export interface LocalImportPlan {
  readonly studentId: string
  readonly snapshot: VocabularySnapshot
  readonly upload: readonly VocabularyReviewRecord[]
  readonly skipped: readonly { readonly reviewId: string; readonly entryId: string; readonly reason: SkipReason }[]
  readonly entries: readonly { readonly entryId: string; readonly resolution: EntryResolution }[]
  /** Words with local progress but no local reviews left (trimmed history): cannot be imported. */
  readonly statesWithoutReviews: readonly string[]
}

export class LocalImportRefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocalImportRefusedError'
  }
}

export interface ServerView {
  /** Latest applied review instant per word on the server. */
  readonly lastReviewedAt: ReadonlyMap<string, string>
  readonly reviewIds: ReadonlySet<string>
  readonly resetAt: string | null
}

const t = (iso: string) => new Date(iso).getTime()

/** Pure: decides what an upload would do. Throws when the snapshot must never be uploaded. */
export function planLocalVocabularyImport(snapshot: VocabularySnapshot, sessionUserId: string, server: ServerView): LocalImportPlan {
  if (!isUploadableStudentId(snapshot.studentId)) throw new LocalImportRefusedError('Preview data is never uploaded.')
  if (snapshot.studentId !== sessionUserId) {
    throw new LocalImportRefusedError('This device’s saved practice belongs to a different account and cannot be added to yours.')
  }
  if ([...snapshot.states, ...snapshot.reviews].some((r) => r.studentId !== snapshot.studentId)) {
    throw new LocalImportRefusedError('The saved practice mixes accounts; nothing was uploaded.')
  }

  const upload: VocabularyReviewRecord[] = []
  const skipped: { reviewId: string; entryId: string; reason: SkipReason }[] = []
  const perEntry = new Map<string, { uploaded: number; skipped: number }>()
  const sorted = [...snapshot.reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id))
  for (const review of sorted) {
    const tally = perEntry.get(review.entryId) ?? { uploaded: 0, skipped: 0 }
    perEntry.set(review.entryId, tally)
    const serverLast = server.lastReviewedAt.get(review.entryId)
    let reason: SkipReason | null = null
    if (server.reviewIds.has(review.id)) reason = 'already_on_server'
    else if (server.resetAt && t(review.reviewedAt) <= t(server.resetAt)) reason = 'before_reset'
    else if (serverLast && t(review.reviewedAt) <= t(serverLast)) reason = 'older_than_server'
    if (reason) {
      skipped.push({ reviewId: review.id, entryId: review.entryId, reason })
      tally.skipped += 1
    } else {
      upload.push(review)
      tally.uploaded += 1
    }
  }

  const entries = [...perEntry].map(([entryId, tally]) => ({
    entryId,
    resolution: (tally.uploaded === 0 ? 'server_newer' : server.lastReviewedAt.has(entryId) ? 'merge' : 'import') as EntryResolution,
  }))
  const withReviews = new Set(snapshot.reviews.map((r) => r.entryId))
  const statesWithoutReviews = snapshot.states.filter((s) => s.lastReviewedAt && !withReviews.has(s.entryId)).map((s) => s.entryId)
  return { studentId: snapshot.studentId, snapshot, upload, skipped, entries, statesWithoutReviews }
}

export interface ImportSummary {
  readonly statuses: Partial<Record<ReviewStatus, number>>
  readonly rejected: readonly { readonly id: string | null; readonly reason: string }[]
  /** True when the device copy was deleted. */
  readonly clearedDevice: boolean
}

export interface LocalVocabularyImporter {
  /** Null when this device holds no uploadable vocabulary for the signed-in account. */
  inspect(studentId: string): Promise<LocalImportPlan | null>
  run(plan: LocalImportPlan, options: { readonly consent: true }): Promise<ImportSummary>
  /** The learner chose to throw the device copy away instead. */
  discard(studentId: string): Promise<void>
}

export function createLocalVocabularyImporter(deps: {
  readonly device: VocabularyRepository
  readonly api: VocabularyApi
  readonly getSessionUserId: () => Promise<string | null>
  readonly batchSize?: number
}): LocalVocabularyImporter {
  const { device, api, getSessionUserId } = deps
  const batchSize = deps.batchSize ?? 200

  async function signedIn(studentId: string) {
    const uid = await getSessionUserId()
    if (!uid || uid !== studentId) throw new LocalImportRefusedError('Sign in as the account that owns this practice first.')
    return uid
  }

  return {
    async inspect(studentId) {
      if (!isUploadableStudentId(studentId)) return null
      const uid = await signedIn(studentId)
      const [states, reviews] = await Promise.all([device.listStates(uid), device.listReviews(uid)])
      if (states.length === 0 && reviews.length === 0) return null
      const snapshot = await exportVocabularySnapshot(device, uid)
      const [serverStates, serverReviews, resetAt] = await Promise.all([api.fetchStates(uid), api.fetchReviews(uid), api.fetchResetAt(uid)])
      return planLocalVocabularyImport(snapshot, uid, {
        lastReviewedAt: new Map(serverStates.filter((s) => s.last_reviewed_at).map((s) => [s.entry_id, s.last_reviewed_at!])),
        reviewIds: new Set(serverReviews.map((r) => r.id)),
        resetAt,
      })
    },

    async run(plan, options) {
      if (options?.consent !== true) throw new LocalImportRefusedError('Uploading needs the learner’s explicit consent.')
      const uid = await signedIn(plan.studentId)
      const statuses: Partial<Record<ReviewStatus, number>> = {}
      const rejected: { id: string | null; reason: string }[] = []
      for (let i = 0; i < plan.upload.length; i += batchSize) {
        const batch = plan.upload.slice(i, i + batchSize)
        // Transient failures throw: the device copy stays, and re-running is safe (idempotent ids).
        const result = await api.recordReviews(uid, batch.map(toReviewPayload), 'import')
        for (const r of result.results) {
          statuses[r.status] = (statuses[r.status] ?? 0) + 1
          if (r.status === 'rejected') rejected.push({ id: r.id, reason: r.reason ?? 'rejected' })
        }
      }
      await device.clear(uid)
      return { statuses, rejected, clearedDevice: true }
    },

    async discard(studentId) {
      const uid = await signedIn(studentId)
      await device.clear(uid)
    },
  }
}
