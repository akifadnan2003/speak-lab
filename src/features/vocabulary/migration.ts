import type { VocabularyRepository, VocabularyReviewRecord, VocabularyState } from './ports'

/**
 * Migration path from device-local records to authenticated server records.
 *
 * Rules (see docs/DECISIONS.md ADR-017):
 * - Local records are namespaced by the student id they were created under.
 *   A snapshot can only be exported for that exact id; records are never
 *   re-keyed to another account.
 * - Preview/demo ids are refused so M1 preview sessions can never be uploaded.
 * - Upload is explicit (user-confirmed) and idempotent: every review carries
 *   a client-generated id, and states are keyed by (studentId, entryId), so
 *   the server can upsert safely if the upload is retried.
 * - After a confirmed upload the caller clears the local namespace.
 */

export interface VocabularySnapshot {
  readonly version: 1
  readonly studentId: string
  readonly exportedAt: string
  readonly states: readonly VocabularyState[]
  readonly reviews: readonly VocabularyReviewRecord[]
}

export function isUploadableStudentId(studentId: string): boolean {
  return studentId.length > 0 && !studentId.startsWith('preview-')
}

export async function exportVocabularySnapshot(
  repository: VocabularyRepository,
  studentId: string,
  now: Date = new Date(),
): Promise<VocabularySnapshot> {
  if (!isUploadableStudentId(studentId)) {
    throw new Error(`Refusing to export local vocabulary for non-uploadable id "${studentId}"`)
  }
  const [states, reviews] = await Promise.all([repository.listStates(studentId), repository.listReviews(studentId)])
  const foreign = [...states, ...reviews].find((r) => r.studentId !== studentId)
  if (foreign) throw new Error('Snapshot contains records for another student; aborting')
  return { version: 1, studentId, exportedAt: now.toISOString(), states, reviews }
}
