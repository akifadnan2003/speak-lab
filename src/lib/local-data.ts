/**
 * Student-local data hygiene.
 *
 * Anything a feature keeps on the device for the signed-in student (cached progress, offline
 * queues, drafts, in-memory stores) must be registered here so it is wiped when the student signs
 * out and when a *different* account signs in on the same device. The auth provider calls
 * `clearLocalStudentData()` on sign-out, on the SIGNED_OUT event, and whenever the active user id
 * changes (shared phones, family laptops).
 *
 * Conventions:
 *  - Device-level preferences that are not personal stay (`speaklab.theme`).
 *  - The Supabase session storage key (`speaklab.auth`) is managed by supabase-js and is cleared by
 *    `auth.signOut()`; it is listed in KEEP so a user-switch purge does not sign out the new user.
 *  - Every other `speaklab.*` key in localStorage/sessionStorage is student data and is removed.
 *  - Feature modules (e.g. M3's localStorage progress repository) register a cleaner with
 *    `registerLocalDataCleaner(clearStoredProgress)`.
 */
export const LOCAL_DATA_PREFIX = 'speaklab.'
export const ACTIVE_USER_KEY = 'speaklab.active-user'

const KEEP: ReadonlySet<string> = new Set(['speaklab.theme', 'speaklab.auth'])

type Cleaner = () => void | Promise<void>
const cleaners = new Set<Cleaner>()

/** Registers a function that wipes a feature's student-local state. Returns an unregister function. */
export function registerLocalDataCleaner(cleaner: Cleaner): () => void {
  cleaners.add(cleaner)
  return () => cleaners.delete(cleaner)
}

function purgeStorage(storage: Storage | undefined): string[] {
  if (!storage) return []
  const removed: string[] = []
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i)
      if (key && key.startsWith(LOCAL_DATA_PREFIX) && !KEEP.has(key) && key !== ACTIVE_USER_KEY) {
        storage.removeItem(key)
        removed.push(key)
      }
    }
  } catch {
    /* storage unavailable (private mode, blocked) */
  }
  return removed
}

async function purgeIndexedDb(): Promise<void> {
  try {
    const idb = globalThis.indexedDB
    if (!idb || typeof idb.databases !== 'function') return
    const dbs = await idb.databases()
    await Promise.all(
      dbs
        .filter((db) => db.name?.startsWith(LOCAL_DATA_PREFIX))
        .map(
          (db) =>
            new Promise<void>((resolve) => {
              const req = idb.deleteDatabase(db.name!)
              req.onsuccess = req.onerror = req.onblocked = () => resolve()
            }),
        ),
    )
  } catch {
    /* ignore */
  }
}

/**
 * Removes every piece of student-local data on this device. Safe to call repeatedly.
 * Returns the storage keys that were removed (for tests and diagnostics).
 */
export async function clearLocalStudentData(): Promise<string[]> {
  const removed = [
    ...purgeStorage(typeof localStorage === 'undefined' ? undefined : localStorage),
    ...purgeStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage),
  ]
  for (const cleaner of cleaners) {
    try {
      await cleaner()
    } catch (error) {
      console.warn('[speaklab] local data cleaner failed', error)
    }
  }
  await purgeIndexedDb()
  return removed
}

/**
 * Records which account is active on this device. When the id differs from the previous one,
 * all student-local data is purged first so nothing from the previous student can leak into the
 * new session. Returns true when a purge happened.
 */
export async function activateLocalUser(userId: string): Promise<boolean> {
  let previous: string | null = null
  try {
    previous = localStorage.getItem(ACTIVE_USER_KEY)
  } catch {
    /* storage unavailable */
  }
  const switched = previous !== null && previous !== userId
  if (switched) await clearLocalStudentData()
  try {
    localStorage.setItem(ACTIVE_USER_KEY, userId)
  } catch {
    /* storage unavailable */
  }
  return switched
}

/** Forgets the active user marker (called after sign-out, once data is cleared). */
export function deactivateLocalUser(): void {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY)
  } catch {
    /* storage unavailable */
  }
}
