import { registerLocalDataCleaner } from '@/lib/local-data'
import { clearStoredVocabulary } from './local-storage'
import { createVocabularyOutbox } from './outbox'

/**
 * Vocabulary's part of M2's student-local data hygiene (`src/lib/local-data.ts`).
 *
 * M2's `clearLocalStudentData()` already deletes every `speaklab.*` storage key, which covers the
 * device repository (`speaklab.vocab.v1:*`) and the review queue (`speaklab.vocab.outbox.v1:*`).
 * This cleaner adds what storage purging cannot reach: in-memory caches, optimistic states and
 * retry timers held by live cloud repositories. It runs on sign-out, on the SIGNED_OUT event
 * and when a different account signs in on the same device.
 *
 * Registration happens from `VocabularyProvider` (this feature's entry point), so no auth file
 * has to know about vocabulary.
 */
interface Disposable {
  dispose(): void
}

const live = new Set<Disposable>()
let unregister: (() => void) | null = null

/** Every piece of vocabulary data on this device, for every account. Safe to call repeatedly. */
export function clearVocabularyDeviceData(storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined) {
  clearStoredVocabulary(storage)
  createVocabularyOutbox(storage).clearAll()
  for (const repo of live) repo.dispose()
}

/** Registers a repository whose in-memory state must be dropped with the student's data. */
export function trackVocabularyRepository(repo: Disposable): () => void {
  live.add(repo)
  return () => live.delete(repo)
}

/** Idempotent: registers the vocabulary cleaner with M2 once per page load. */
export function ensureVocabularyCleanupRegistered(): void {
  unregister ??= registerLocalDataCleaner(() => clearVocabularyDeviceData())
}

/** Test seam. */
export function resetVocabularyCleanupForTests(): void {
  unregister?.()
  unregister = null
  live.clear()
}
