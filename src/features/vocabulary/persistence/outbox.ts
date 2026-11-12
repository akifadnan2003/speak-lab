import type { VocabularyReviewRecord, VocabularyState } from '../ports'

/**
 * Durable queue of reviews not yet accepted by the server, one queue per account.
 *
 * Keyed by the owner id so a queue written while student A was signed in can never be flushed
 * with student B's session (the cloud repository only ever reads the current session's queue,
 * and the server refuses a batch whose expected owner differs). The `speaklab.` prefix means
 * M2's `clearLocalStudentData()` removes it on sign-out and account switch.
 *
 * Not authoritative: the server's response replaces every optimistic state stored here.
 */
export const OUTBOX_STORAGE_PREFIX = 'speaklab.vocab.outbox.v1'
const MAX_ITEMS = 2000

export interface OutboxItem {
  readonly review: VocabularyReviewRecord
  /** The browser's optimistic state after this review, shown until the server answers. */
  readonly state?: VocabularyState
  readonly attempts: number
}

export interface VocabularyOutbox {
  list(ownerId: string): OutboxItem[]
  add(ownerId: string, item: OutboxItem): void
  remove(ownerId: string, reviewIds: Iterable<string>): void
  bumpAttempts(ownerId: string, reviewIds: Iterable<string>): void
  /** Every owner's queue (sign-out / account switch). */
  clearAll(): void
}

function key(ownerId: string) {
  return `${OUTBOX_STORAGE_PREFIX}:${ownerId}`
}

export function createVocabularyOutbox(
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): VocabularyOutbox {
  const memory = new Map<string, OutboxItem[]>()

  // Memory is only a fallback for when storage is missing or refuses writes (quota, private
  // mode). Otherwise storage is the single source, so a purge of storage is a purge of the queue.
  let useMemory = !storage

  function read(ownerId: string): OutboxItem[] {
    if (useMemory || !storage) return memory.get(ownerId) ?? []
    try {
      const raw = storage.getItem(key(ownerId))
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      // Belt and braces: never return an item recorded for someone else.
      return (parsed as OutboxItem[]).filter((i) => i?.review?.studentId === ownerId && typeof i.review.id === 'string')
    } catch {
      return []
    }
  }

  function write(ownerId: string, items: OutboxItem[]) {
    const trimmed = items.slice(-MAX_ITEMS)
    if (!useMemory && storage) {
      try {
        if (trimmed.length === 0) storage.removeItem(key(ownerId))
        else storage.setItem(key(ownerId), JSON.stringify(trimmed))
        return
      } catch {
        /* quota exceeded or storage unavailable: keep syncing from memory for this session */
        useMemory = true
      }
    }
    memory.set(ownerId, trimmed)
  }

  return {
    list: read,
    add(ownerId, item) {
      if (item.review.studentId !== ownerId) throw new Error('Refusing to queue a review under another account')
      const items = read(ownerId)
      if (items.some((i) => i.review.id === item.review.id)) return
      write(ownerId, [...items, item])
    },
    remove(ownerId, reviewIds) {
      const ids = new Set(reviewIds)
      write(ownerId, read(ownerId).filter((i) => !ids.has(i.review.id)))
    },
    bumpAttempts(ownerId, reviewIds) {
      const ids = new Set(reviewIds)
      write(ownerId, read(ownerId).map((i) => (ids.has(i.review.id) ? { ...i, attempts: i.attempts + 1 } : i)))
    },
    clearAll() {
      memory.clear()
      if (!storage) return
      try {
        const keys: string[] = []
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i)
          if (k?.startsWith(`${OUTBOX_STORAGE_PREFIX}:`)) keys.push(k)
        }
        for (const k of keys) storage.removeItem(k)
      } catch {
        /* storage unavailable */
      }
    },
  }
}
